import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';

export type OrderScope = { customerAccountId?: string };
export type OrderListFilters = {
  page: number;
  search?: string | undefined;
  status?: string | undefined;
};

interface OrderReadRow {
  id: string;
  order_number: string;
  contract_id: string;
  contract_reference: string | null;
  customer_account_id: string;
  company_name: string | null;
  status: string;
  fulfilment_type: 'PICKUP' | 'DELIVERY';
  requested_quantity_tons: string;
  remaining_contract_quantity_snapshot: string;
  approved_customer_rate_per_ton: string;
  amount: string;
  vat_rate: string;
  vat_amount: string;
  grand_total: string;
  preferred_delivery_date: Date | string | null;
  delivery_notes: string | null;
  ship_to_snapshot: unknown;
  pickup_location_id: string | null;
  pickup_location_name: string | null;
  hader_city_name: string | null;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  product_id: string;
  product_code: string;
  product_name: string;
  packaging: string;
  contract_uom: string;
  shipment_count?: string;
  latest_shipment_status?: string | null;
}

const pageSize = 10;

export class OrdersRepository {
  async getByIdempotencyKey(
    customerAccountId: string,
    clientRequestId: string,
    client: PoolClient,
  ) {
    const result = await client.query<OrderReadRow>(
      `${orderSelectSql}
       where orders.customer_account_id = $1
         and orders.client_request_id = $2`,
      [customerAccountId, clientRequestId],
    );
    return result.rows[0] ? mapOrderReadRow(result.rows[0]) : null;
  }

  async list(
    scope: OrderScope,
    filters: OrderListFilters,
    options: { includeShipmentSummary?: boolean } = {},
  ) {
    const values: unknown[] = [];
    const clauses: string[] = [];
    if (scope.customerAccountId) {
      values.push(scope.customerAccountId);
      clauses.push(`orders.customer_account_id = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`orders.status = $${values.length}`);
    }
    if (filters.search) {
      values.push(`%${filters.search.toLowerCase()}%`);
      clauses.push(`(
        lower(orders.order_number) like $${values.length}
        or lower(coalesce(contracts.reference, '')) like $${values.length}
        or lower(order_items.product_name) like $${values.length}
        or lower(order_items.product_code) like $${values.length}
        or lower(coalesce(customer_accounts.company_name, '')) like $${values.length}
      )`);
    }
    const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const count = await pool.query<{ total: string }>(
      `select count(*)::text as total ${orderJoinSql} ${where}`,
      values,
    );
    const offset = (filters.page - 1) * pageSize;
    const listValues = [...values, pageSize, offset];
    const result = await pool.query<OrderReadRow>(
      `${options.includeShipmentSummary ? orderSelectWithShipmentSql : orderSelectSql}
       ${where}
       order by orders.created_at desc
       limit $${listValues.length - 1} offset $${listValues.length}`,
      listValues,
    );
    const total = Number(count.rows[0]?.total ?? 0);
    return {
      items: result.rows.map(mapOrderReadRow),
      pagination: {
        page: filters.page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getById(id: string, scope: OrderScope) {
    const values: unknown[] = [id];
    const clauses = ['orders.id = $1'];
    if (scope.customerAccountId) {
      values.push(scope.customerAccountId);
      clauses.push(`orders.customer_account_id = $${values.length}`);
    }
    const result = await pool.query<OrderReadRow>(
      `${orderSelectSql} where ${clauses.join(' and ')}`,
      values,
    );
    return result.rows[0] ? mapOrderReadRow(result.rows[0]) : null;
  }
}

export const ordersRepository = new OrdersRepository();

const orderJoinSql = `from orders
 inner join contracts on contracts.id = orders.contract_id
 inner join customer_accounts on customer_accounts.id = orders.customer_account_id
 inner join lateral (
   select order_items.*
   from order_items
   where order_items.order_id = orders.id
   order by order_items.created_at asc
   limit 1
 ) order_items on true`;

const orderSelectSql = `select orders.*,
  contracts.reference as contract_reference,
  customer_accounts.company_name,
  order_items.product_id,
  order_items.product_code,
  order_items.product_name,
  order_items.packaging,
 order_items.contract_uom
 ${orderJoinSql}`;

const orderSelectWithShipmentSql = `select orders.*,
  contracts.reference as contract_reference,
  customer_accounts.company_name,
  order_items.product_id,
  order_items.product_code,
  order_items.product_name,
  order_items.packaging,
  order_items.contract_uom,
  shipment_summary.shipment_count,
  shipment_summary.latest_shipment_status
 ${orderJoinSql}
 left join lateral (
   select count(*)::text as shipment_count,
     (array_agg(shipments.status order by shipments.created_at desc))[1] as latest_shipment_status
   from shipments where shipments.order_id=orders.id
 ) shipment_summary on true`;

function mapOrderReadRow(row: OrderReadRow) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    contract: { id: row.contract_id, reference: row.contract_reference },
    customer: { id: row.customer_account_id, companyName: row.company_name },
    status: row.status,
    fulfilmentType: row.fulfilment_type,
    requestedQuantityTons: Number(row.requested_quantity_tons),
    remainingContractQuantityTons: Number(row.remaining_contract_quantity_snapshot),
    preferredDeliveryDate: dateOnly(row.preferred_delivery_date),
    deliveryNotes: row.delivery_notes,
    shipTo: objectValue(row.ship_to_snapshot),
    pickupLocation: row.pickup_location_id
      ? { id: row.pickup_location_id, name: row.pickup_location_name }
      : null,
    haderCity: row.hader_city_name,
    product: {
      id: row.product_id,
      code: row.product_code,
      name: row.product_name,
      packaging: row.packaging,
      uom: row.contract_uom,
    },
    customerRatePerTon: Number(row.approved_customer_rate_per_ton),
    subtotal: Number(row.amount),
    vatRate: Number(row.vat_rate),
    vatAmount: Number(row.vat_amount),
    grandTotal: Number(row.grand_total),
    submittedAt: dateTime(row.submitted_at),
    createdAt: dateTime(row.created_at),
    updatedAt: dateTime(row.updated_at),
    ...(row.shipment_count !== undefined
      ? {
          shipmentSummary: {
            count: Number(row.shipment_count),
            latestStatus: row.latest_shipment_status,
          },
        }
      : {}),
  };
}

function objectValue(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function dateOnly(value: Date | string | null) {
  return value ? new Date(String(value)).toISOString().slice(0, 10) : null;
}

function dateTime(value: Date | string | null) {
  return value ? new Date(String(value)).toISOString() : null;
}
