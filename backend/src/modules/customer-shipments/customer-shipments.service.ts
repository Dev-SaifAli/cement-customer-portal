import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type { ListCustomerShipmentsQuery } from './customer-shipments.validation.js';

const PAGE_SIZE = 10;

interface CustomerShipmentRow {
  id: string;
  shipment_number: string;
  status: string;
  quantity_ton: string;
  scheduled_date: Date | string | null;
  delivered_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  order_id: string;
  order_number: string;
  fulfilment_type: 'DELIVERY' | 'PICKUP';
  ship_to_snapshot: unknown;
  hader_city_name: string | null;
  requested_date: Date | string | null;
  contract_id: string | null;
  contract_reference: string | null;
  product_id: string;
  product_code: string;
  product_name: string;
  packaging: string;
  contract_uom: string;
  unit_weight_kg: string | null;
  total_count?: string;
}

interface CustomerShipmentEventRow {
  id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  created_at: Date | string;
}

export class CustomerShipmentsService {
  async list(customerUser: CustomerUser, query: ListCustomerShipmentsQuery) {
    const values: unknown[] = [customerUser.account.id];
    const conditions = ['s.customer_account_id = $1', 'o.customer_account_id = $1'];

    if (query.search) {
      values.push(`%${query.search}%`);
      conditions.push(
        `(s.shipment_number ilike $${values.length} or o.order_number ilike $${values.length})`,
      );
    }
    if (query.status) {
      values.push(query.status);
      conditions.push(`s.status = $${values.length}`);
    }
    if (query.dateFrom) {
      values.push(query.dateFrom);
      conditions.push(`s.created_at >= $${values.length}::date`);
    }
    if (query.dateTo) {
      values.push(query.dateTo);
      conditions.push(`s.created_at < $${values.length}::date + interval '1 day'`);
    }

    values.push(PAGE_SIZE, (query.page - 1) * PAGE_SIZE);
    const result = await pool.query<CustomerShipmentRow>(
      `${customerShipmentSelect}
       where ${conditions.join(' and ')}
       order by s.created_at desc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    const total = Number(result.rows[0]?.total_count ?? 0);

    return {
      items: result.rows.map(mapShipment),
      pagination: {
        page: query.page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    };
  }

  async getById(customerUser: CustomerUser, id: string) {
    const result = await pool.query<CustomerShipmentRow>(
      `${customerShipmentSelect}
       where s.id = $2
         and s.customer_account_id = $1
         and o.customer_account_id = $1`,
      [customerUser.account.id, id],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('Shipment was not found.', 404, 'CUSTOMER_SHIPMENT_NOT_FOUND');

    const events = await pool.query<CustomerShipmentEventRow>(
      `select id, event_type, previous_status, new_status, created_at
       from shipment_events
       where shipment_id = $1
         and event_type not in ('DRIVER_NOTIFIED','TRUCK_ARRIVED','TRUCK_AT_GATE','LOADING_POINT_ASSIGNED')
       order by created_at asc, id asc`,
      [id],
    );

    return { ...mapShipment(row), events: events.rows.map(mapEvent) };
  }
}

export const customerShipmentsService = new CustomerShipmentsService();

const customerShipmentSelect = `select s.id,s.shipment_number,s.status,s.quantity_ton,
 s.scheduled_date,s.delivered_at,s.created_at,s.updated_at,
 o.id as order_id,o.order_number,o.fulfilment_type,o.ship_to_snapshot,o.hader_city_name,
 dr.requested_date,c.id as contract_id,c.reference as contract_reference,
 oi.product_id,oi.product_code,oi.product_name,oi.packaging,oi.contract_uom,
 p.unit_weight_kg,count(*) over()::text as total_count
 from shipments s
 inner join orders o on o.id=s.order_id
 left join contracts c on c.id=o.contract_id
 inner join delivery_requests dr on dr.id=s.delivery_request_id
 inner join lateral (
   select item.* from order_items item where item.order_id=o.id order by item.created_at limit 1
 ) oi on true
 inner join product_catalog p on p.id=oi.product_id`;

function mapShipment(row: CustomerShipmentRow) {
  const quantityTon = Number(row.quantity_ton);
  const unitWeightKg = Number(row.unit_weight_kg ?? 0);
  return {
    id: row.id,
    shipmentNumber: row.shipment_number,
    status: row.status,
    quantityTon,
    equivalentBags:
      unitWeightKg > 0 && row.packaging.toLowerCase() !== 'bulk'
        ? Math.round((quantityTon * 1000) / unitWeightKg)
        : null,
    scheduledDate: dateOnly(row.scheduled_date),
    deliveredAt: dateTime(row.delivered_at),
    createdAt: dateTime(row.created_at),
    updatedAt: dateTime(row.updated_at),
    order: { id: row.order_id, number: row.order_number },
    contract: { id: row.contract_id, reference: row.contract_reference },
    product: {
      id: row.product_id,
      code: row.product_code,
      name: row.product_name,
      packaging: row.packaging,
      uom: row.contract_uom,
    },
    fulfilmentType: row.fulfilment_type,
    haderCity: row.hader_city_name,
    shipTo: objectValue(row.ship_to_snapshot),
    requestedDate: dateOnly(row.requested_date),
  };
}

function mapEvent(row: CustomerShipmentEventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    createdAt: dateTime(row.created_at),
  };
}

function objectValue(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
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
