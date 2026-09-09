import { AppError } from '../../errors/app-error.js';
import { pool } from '../../database/pool.js';
import {
  ordersRepository,
  type OrderProcessingCandidate,
} from '../customer-orders/orders.repository.js';
import { createDeliveryRequestForOrder } from '../hader-delivery/hader-delivery.service.js';
import { notificationEvents } from '../notifications/notification-events.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { ListCustomerOrdersQuery } from '../customer-orders/customer-orders.validation.js';

export class OperationalOrdersService {
  async list(user: SalesUser, query: ListCustomerOrdersQuery) {
    const fulfilmentType = operationalOrderFulfilment(user);
    const result = await ordersRepository.list(
      { fulfilmentType, contractOrdersOnly: true },
      query,
      { includeShipmentSummary: true },
    );
    return { ...result, items: result.items.map(mapOperationalOrder) };
  }

  async getById(user: SalesUser, id: string) {
    const fulfilmentType = operationalOrderFulfilment(user);
    const order = await ordersRepository.getById(id, {
      fulfilmentType,
      contractOrdersOnly: true,
    });
    if (!order) {
      throw new AppError('Order was not found.', 404, 'OPERATIONAL_ORDER_NOT_FOUND');
    }
    return mapOperationalOrder(order);
  }

  async startProcessing(user: SalesUser, id: string) {
    requireHaderProcessingRole(user);
    const client = await pool.connect();
    let deliveryRequest: Awaited<ReturnType<typeof createDeliveryRequestForOrder>> | null = null;

    try {
      await client.query('begin');
      const order = await ordersRepository.getProcessingCandidateForUpdate(id, client);
      if (!order) {
        throw new AppError('Order was not found.', 404, 'OPERATIONAL_ORDER_NOT_FOUND');
      }
      validateHaderOrderForProcessing(order);

      deliveryRequest = await createDeliveryRequestForOrder(client, {
        orderId: order.id,
        customerAccountId: order.customer_account_id,
        haderCityId: order.hader_city_id,
        shipToLocationId: order.ship_to_location_id,
        quantityTon: Number(order.requested_quantity_tons),
        requestedDate: order.preferred_delivery_date as Date | string,
        haderZoneStatus: order.hader_zone_status,
        salesUserId: user.id,
      });
      await ordersRepository.markProcessing(order.id, user.id, client);
      await ordersRepository.addProcessingStartedEvent(order, user.id, user.role, client);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    const order = await this.getById(user, id);
    await notificationEvents.orderProcessingStarted(order.customer.id, order.id, order.orderNumber);
    if (deliveryRequest?.created) {
      await notificationEvents.deliveryRequestCreated(deliveryRequest.id, order.orderNumber);
    }
    return order;
  }
}

type OrderReadModel = NonNullable<Awaited<ReturnType<typeof ordersRepository.getById>>>;

function mapOperationalOrder(order: OrderReadModel) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    contract: order.contract,
    customer: order.customer,
    product: order.product,
    requestedQuantityTons: order.requestedQuantityTons,
    fulfilmentType: order.fulfilmentType,
    preferredDeliveryDate: order.preferredDeliveryDate,
    haderCity: order.haderCity,
    shipTo: order.shipTo,
    pickupLocation: order.pickupLocation,
    pickupTruck: order.pickupTruck,
    pickupDriver: order.pickupDriver,
    status: order.status,
    creator: order.creator,
    processing: order.processing,
    deliveryRequest: order.deliveryRequest,
    shipmentSummary: order.shipmentSummary,
    createdAt: order.createdAt,
  };
}

function requireHaderProcessingRole(user: SalesUser) {
  if (user.role !== 'HADER_MANAGER' && user.role !== 'HADER_OPERATIONS') {
    throw new AppError(
      'Only Hader users can start Delivery Order processing.',
      403,
      'HADER_ORDER_PROCESSING_FORBIDDEN',
    );
  }
}

function validateHaderOrderForProcessing(order: OrderProcessingCandidate) {
  if (!order.contract_id || order.order_number.startsWith('DO')) {
    throw new AppError(
      'Only contract orders can be processed for fulfilment.',
      409,
      'ORDER_TYPE_INVALID',
    );
  }
  if (order.fulfilment_type !== 'DELIVERY') {
    throw new AppError(
      'Only Delivery Orders can be processed by Hader.',
      409,
      'ORDER_FULFILMENT_INVALID',
    );
  }
  if (!['SUBMITTED', 'APPROVED'].includes(order.status)) {
    throw new AppError(
      order.status === 'PROCESSING'
        ? 'Order processing has already started.'
        : 'Only submitted or approved orders can start processing.',
      409,
      order.status === 'PROCESSING' ? 'ORDER_ALREADY_PROCESSING' : 'ORDER_STATUS_INVALID',
    );
  }
  if (order.customer_status !== 'ACTIVE') {
    throw new AppError('The customer account is not active.', 409, 'ORDER_CUSTOMER_INACTIVE');
  }
  if (!order.product_active) {
    throw new AppError('The order product is inactive.', 409, 'ORDER_PRODUCT_INACTIVE');
  }
  if (!(Number(order.requested_quantity_tons) > 0)) {
    throw new AppError(
      'Order quantity must be greater than zero TON.',
      409,
      'ORDER_QUANTITY_INVALID',
    );
  }
  if (
    !order.hader_city_id ||
    !order.hader_city_name?.trim() ||
    !order.ship_to_location_id ||
    !order.preferred_delivery_date ||
    !validShipToSnapshot(order.ship_to_snapshot, order.ship_to_location_id)
  ) {
    throw new AppError(
      'Delivery order requires a valid Hader city and ship-to location.',
      409,
      'ORDER_DELIVERY_DETAILS_INVALID',
    );
  }
}

function validShipToSnapshot(value: unknown, locationId: string) {
  let snapshot: Record<string, unknown> | null = null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    snapshot = value as Record<string, unknown>;
  }
  if (typeof value !== 'string' && !snapshot) return false;
  try {
    if (!snapshot) {
      const parsed = JSON.parse(value as string) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        snapshot = parsed as Record<string, unknown>;
      }
    }
  } catch {
    return false;
  }
  return Boolean(
    snapshot &&
    snapshot.id === locationId &&
    typeof snapshot.name === 'string' &&
    snapshot.name.trim() &&
    typeof snapshot.city === 'string' &&
    snapshot.city.trim()
  );
}

function operationalOrderFulfilment(user: SalesUser) {
  if (user.role === 'HADER_MANAGER' || user.role === 'HADER_OPERATIONS') return 'DELIVERY' as const;
  if (user.role === 'DISPATCH_USER') return 'PICKUP' as const;
  throw new AppError(
    'Operational order access is forbidden.',
    403,
    'OPERATIONAL_ORDER_FORBIDDEN',
  );
}

export const operationalOrdersService = new OperationalOrdersService();
