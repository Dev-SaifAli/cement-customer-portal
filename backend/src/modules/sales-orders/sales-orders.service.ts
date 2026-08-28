import { AppError } from '../../errors/app-error.js';
import { pool } from '../../database/pool.js';
import { ordersRepository } from '../customer-orders/orders.repository.js';
import { createDeliveryRequestForOrder } from '../hader-delivery/hader-delivery.service.js';
import { notificationEvents } from '../notifications/notification-events.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { ListSalesOrdersQuery } from './sales-orders.validation.js';

export class SalesOrdersService {
  async list(query: ListSalesOrdersQuery) {
    return ordersRepository.list({}, query, { includeShipmentSummary: true });
  }

  async getById(id: string) {
    const order = await ordersRepository.getById(id, {});
    if (!order) throw new AppError('Order was not found.', 404, 'SALES_ORDER_NOT_FOUND');
    return order;
  }

  async startProcessing(id: string, salesUser: SalesUser) {
    const client = await pool.connect();
    let createdDeliveryRequest: Awaited<ReturnType<typeof createDeliveryRequestForOrder>> | null =
      null;
    try {
      await client.query('begin');
      const order = await ordersRepository.getProcessingCandidateForUpdate(id, client);
      if (!order) throw new AppError('Order was not found.', 404, 'SALES_ORDER_NOT_FOUND');
      validateOrderForProcessing(order);

      if (order.fulfilment_type === 'DELIVERY') {
        createdDeliveryRequest = await createDeliveryRequestForOrder(client, {
          orderId: order.id,
          customerAccountId: order.customer_account_id,
          haderCityId: order.hader_city_id,
          shipToLocationId: order.ship_to_location_id,
          quantityTon: Number(order.requested_quantity_tons),
          requestedDate: order.preferred_delivery_date as Date | string,
          salesUserId: salesUser.id,
        });
      }

      await ordersRepository.markProcessing(order.id, salesUser.id, client);
      await ordersRepository.addProcessingStartedEvent(order, salesUser.id, client);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    const order = await this.getById(id);
    await notificationEvents.orderProcessingStarted(order.customer.id, order.id, order.orderNumber);
    if (createdDeliveryRequest?.created) {
      await notificationEvents.deliveryRequestCreated(createdDeliveryRequest.id, order.orderNumber);
    }
    return order;
  }
}

export const salesOrdersService = new SalesOrdersService();

function validateOrderForProcessing(order: {
  status: string;
  customer_status: string;
  product_active: boolean;
  requested_quantity_tons: string;
  fulfilment_type: 'PICKUP' | 'DELIVERY';
  hader_city_id: string | null;
  hader_city_name: string | null;
  ship_to_location_id: string | null;
  ship_to_snapshot: unknown;
  pickup_location_id: string | null;
  pickup_location_name: string | null;
  customer_account_id: string;
  preferred_delivery_date: Date | string | null;
}) {
  if (order.status !== 'SUBMITTED') {
    throw new AppError(
      order.status === 'PROCESSING'
        ? 'Order processing has already started.'
        : 'Only submitted orders can start processing.',
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
  if (order.fulfilment_type === 'DELIVERY') {
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
    return;
  }
  if (order.fulfilment_type === 'PICKUP') {
    if (!order.pickup_location_id || !order.pickup_location_name?.trim()) {
      throw new AppError(
        'Pick-up order requires a valid pickup location.',
        409,
        'ORDER_PICKUP_DETAILS_INVALID',
      );
    }
    return;
  }
  throw new AppError('Order fulfilment is invalid.', 409, 'ORDER_FULFILMENT_INVALID');
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
    snapshot.city.trim(),
  );
}
