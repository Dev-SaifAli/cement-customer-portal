import type { PoolClient } from 'pg';
import { AppError } from '../../errors/app-error.js';
import { pool } from '../../database/pool.js';
import { ordersRepository } from '../customer-orders/orders.repository.js';
import { createDeliveryRequestForOrder } from '../hader-delivery/hader-delivery.service.js';
import { nextDocumentReference } from '../document-numbering/document-numbering.service.js';
import { notificationEvents } from '../notifications/notification-events.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { ListSalesOrdersQuery, RejectDirectOrderPayload } from './sales-orders.validation.js';

interface DirectOrderApprovalRow {
  id: string;
  order_number: string;
  contract_id: string | null;
  customer_account_id: string;
  customer_status: string;
  created_by_customer_user_id: string;
  status: string;
  requested_quantity_tons: string;
  fulfilment_type: 'PICKUP' | 'DELIVERY';
  hader_city_id: string | null;
  hader_city_name: string | null;
  ship_to_location_id: string | null;
  ship_to_snapshot: unknown;
  pickup_location_id: string | null;
  pickup_location_name: string | null;
  approved_customer_rate_per_ton: string;
  amount: string;
  vat_rate: string;
  vat_amount: string;
  grand_total: string;
  preferred_delivery_date: Date | string | null;
  delivery_notes: string | null;
  product_id: string;
  product_code: string;
  product_name: string;
  packaging: string;
  contract_uom: string;
  unit_weight_kg: string | null;
  packaging_quantity: string | null;
  product_active: boolean;
  existing_contract_id: string | null;
}

export class SalesOrdersService {
  async list(query: ListSalesOrdersQuery) {
    return ordersRepository.list({}, query, { includeShipmentSummary: true });
  }

  async getById(id: string) {
    const order = await ordersRepository.getById(id, {});
    if (!order) throw new AppError('Order was not found.', 404, 'SALES_ORDER_NOT_FOUND');
    return order;
  }

  async approveDirectOrder(id: string, salesUser: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const order = await getDirectOrderApprovalCandidate(id, client);
      if (!order) throw new AppError('Order was not found.', 404, 'SALES_ORDER_NOT_FOUND');
      if (order.status === 'APPROVED') {
        if (!order.existing_contract_id) {
          throw new AppError(
            'Approved Direct Order is missing its Contract reference.',
            409,
            'DIRECT_ORDER_CONTRACT_REFERENCE_MISSING',
          );
        }
        await client.query('commit');
      } else {
        validateDirectOrderApprovalCandidate(order);

        await client.query(
          `update orders
           set status = 'APPROVED', updated_at = now()
           where id = $1`,
          [order.id],
        );
        await client.query(
          `insert into order_events (
             order_id, event_type, previous_status, new_status,
             changed_by_sales_user_id, event_data
           ) values ($1, 'DIRECT_ORDER_APPROVED', 'PENDING_APPROVAL', 'APPROVED', $2, $3::jsonb)`,
          [
            order.id,
            salesUser.id,
            JSON.stringify({ orderReference: order.order_number, actorType: 'SALES' }),
          ],
        );
        const contractId = await createApprovedDirectOrderContract(client, order, salesUser.id);
        await client.query(
          `update orders
           set contract_id = $2, updated_at = now()
           where id = $1`,
          [order.id, contractId],
        );
        await client.query('commit');
      }
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getById(id);
  }

  async rejectDirectOrder(id: string, salesUser: SalesUser, payload: RejectDirectOrderPayload) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const order = await getDirectOrderApprovalCandidate(id, client);
      if (!order) throw new AppError('Order was not found.', 404, 'SALES_ORDER_NOT_FOUND');
      if (order.status !== 'PENDING_APPROVAL') {
        throw new AppError(
          'Only pending Direct Orders can be rejected.',
          409,
          'DIRECT_ORDER_APPROVAL_STATUS_INVALID',
        );
      }
      if (order.contract_id || order.existing_contract_id) {
        throw new AppError(
          'This Direct Order already has a Contract.',
          409,
          'DIRECT_ORDER_CONTRACT_ALREADY_EXISTS',
        );
      }
      await client.query(
        `update orders
         set status = 'REJECTED', updated_at = now()
         where id = $1`,
        [order.id],
      );
      await client.query(
        `insert into order_events (
           order_id, event_type, previous_status, new_status,
           changed_by_sales_user_id, event_data
         ) values ($1, 'DIRECT_ORDER_REJECTED', 'PENDING_APPROVAL', 'REJECTED', $2, $3::jsonb)`,
        [
          order.id,
          salesUser.id,
          JSON.stringify({
            orderReference: order.order_number,
            actorType: 'SALES',
            reason: payload.reason ?? null,
          }),
        ],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getById(id);
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
          haderZoneStatus: order.hader_zone_status,
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

async function getDirectOrderApprovalCandidate(id: string, client: PoolClient) {
  const result = await client.query<DirectOrderApprovalRow>(
    `select orders.id,
            orders.order_number,
            orders.contract_id,
            orders.customer_account_id,
            customer_accounts.status as customer_status,
            orders.created_by_customer_user_id,
            orders.status,
            orders.requested_quantity_tons,
            orders.fulfilment_type,
            orders.hader_city_id,
            orders.hader_city_name,
            orders.ship_to_location_id,
            orders.ship_to_snapshot,
            orders.pickup_location_id,
            orders.pickup_location_name,
            orders.approved_customer_rate_per_ton,
            orders.amount,
            orders.vat_rate,
            orders.vat_amount,
            orders.grand_total,
            orders.preferred_delivery_date,
            orders.delivery_notes,
            order_items.product_id,
            order_items.product_code,
            order_items.product_name,
            order_items.packaging,
            order_items.contract_uom,
            order_items.unit_weight_kg,
            order_items.packaging_quantity,
            product_catalog.is_active as product_active,
            existing_contracts.id as existing_contract_id
     from orders
     inner join customer_accounts on customer_accounts.id = orders.customer_account_id
     inner join lateral (
       select order_items.*
       from order_items
       where order_items.order_id = orders.id
       order by order_items.created_at asc
       limit 1
     ) order_items on true
     inner join product_catalog on product_catalog.id = order_items.product_id
     left join contracts existing_contracts on existing_contracts.source_direct_order_id = orders.id
     where orders.id = $1
       and orders.contract_id is null
     for update of orders`,
    [id],
  );
  return result.rows[0] ?? null;
}

function validateDirectOrderApprovalCandidate(order: DirectOrderApprovalRow) {
  if (order.status !== 'PENDING_APPROVAL') {
    throw new AppError(
      'Only pending Direct Orders can be approved.',
      409,
      'DIRECT_ORDER_APPROVAL_STATUS_INVALID',
    );
  }
  if (order.contract_id || order.existing_contract_id) {
    throw new AppError(
      'This Direct Order already has a Contract.',
      409,
      'DIRECT_ORDER_CONTRACT_ALREADY_EXISTS',
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
}

async function createApprovedDirectOrderContract(
  client: PoolClient,
  order: DirectOrderApprovalRow,
  salesUserId: string,
) {
  const existing = await client.query<{ id: string }>(
    `select id from contracts where source_direct_order_id = $1 limit 1`,
    [order.id],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const reference = await nextDocumentReference(client, 'contract_reference_seq', 'CT');
  const quantityTons = Number(order.requested_quantity_tons);
  const customerRate = Number(order.approved_customer_rate_per_ton);
  const contractDate =
    order.preferred_delivery_date instanceof Date
      ? order.preferred_delivery_date.toISOString().slice(0, 10)
      : String(order.preferred_delivery_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const itemSnapshot = {
    orderId: order.id,
    productId: order.product_id,
    productCode: order.product_code,
    productName: order.product_name,
    packagingType: order.packaging,
    uom: order.contract_uom,
    quantity: quantityTons,
    quantityTon: quantityTons,
    equivalentTons: quantityTons,
    packagingQuantity: order.packaging_quantity == null ? null : Number(order.packaging_quantity),
    productListPrice: customerRate,
    productPrice: customerRate,
    deliveryPrice: null,
    customerRate,
    amount: Number(order.amount),
    displayOrder: 0,
    source: 'DIRECT_ORDER',
  };

  const result = await client.query<{ id: string }>(
    `insert into contracts (
       reference, customer_account_id, product_id, packaging, uom, quantity,
       start_date, end_date, fulfilment, pickup_location_id, delivery_location_id,
       delivery_city, pallet_required, pallet_type, product_list_price, product_price,
       delivery_list_price, delivery_price, sales_user_id, status, source_document_type,
       source_document_number, source_direct_order_id, accepted_at, pricing_city_id,
       total_quantity_tons, shipped_quantity_tons, remaining_quantity_tons, subtotal,
       vat_rate, vat_amount, grand_total, payment_terms, customer_notes, items_snapshot,
       activated_at
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, false, null,
       $12, $12, null, null, $13, 'ACTIVE', 'DIRECT_ORDER', $14, $15, now(),
       $16, $6, 0, $6, $17, $18, $19, $20, 'List price Direct Order approved.',
       $21, $22::jsonb, now()
     )
     on conflict (source_direct_order_id) do nothing
     returning id`,
    [
      reference,
      order.customer_account_id,
      order.product_id,
      order.packaging,
      order.contract_uom,
      quantityTons,
      contractDate,
      order.fulfilment_type,
      order.pickup_location_id,
      order.ship_to_location_id,
      order.fulfilment_type === 'DELIVERY' ? order.hader_city_name : null,
      customerRate,
      salesUserId,
      order.order_number,
      order.id,
      order.hader_city_id,
      Number(order.amount),
      Number(order.vat_rate),
      Number(order.vat_amount),
      Number(order.grand_total),
      order.delivery_notes,
      JSON.stringify([itemSnapshot]),
    ],
  );
  const contractId =
    result.rows[0]?.id ??
    (await client.query<{ id: string }>(
      `select id from contracts where source_direct_order_id = $1 limit 1`,
      [order.id],
    )).rows[0]?.id;
  if (!contractId) {
    throw new AppError('Contract could not be created.', 503, 'DIRECT_ORDER_CONTRACT_CREATE_FAILED');
  }

  await client.query(
    `insert into contract_items (
       contract_id, source_quotation_item_id, product_id, product_code, product_name,
       packaging, original_uom, original_quantity, equivalent_tons,
       approved_product_price_per_ton, discount_mode, discount_value,
       discount_amount_per_ton, hader_delivery_price_per_ton,
       approved_customer_rate_per_ton, amount, display_order
     ) values ($1, null, $2, $3, $4, $5, $6, $7, $7, $8, null, null, null, null, $8, $9, 0)
     on conflict (contract_id, display_order) do nothing`,
    [
      contractId,
      order.product_id,
      order.product_code,
      order.product_name,
      order.packaging,
      order.contract_uom,
      order.packaging_quantity == null ? quantityTons : Number(order.packaging_quantity),
      customerRate,
      Number(order.amount),
    ],
  );

  await client.query(
    `insert into contract_events (
       contract_id, event_type, previous_status, new_status, reason,
       changed_by_sales_user_id, event_data
     ) values ($1, 'DIRECT_ORDER_APPROVED', null, 'ACTIVE', $2, $3, $4::jsonb)`,
    [
      contractId,
      `List price Direct Order ${order.order_number} approved and converted to Contract ${reference}.`,
      salesUserId,
      JSON.stringify({
        sourceDocumentType: 'DIRECT_ORDER',
        sourceDocumentNumber: order.order_number,
        sourceDirectOrderId: order.id,
        approvalMode: 'MUST_APPROVE',
      }),
    ],
  );
  return contractId;
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
