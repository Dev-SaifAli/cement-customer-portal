import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { CreateShipmentInput, HaderListQuery } from './hader-delivery.validation.js';

const PAGE_SIZE = 10;

interface DeliveryRequestRow {
  id: string;
  request_number: string;
  order_id: string;
  order_number: string;
  contract_id: string;
  contract_reference: string | null;
  customer_account_id: string;
  company_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  product_id: string;
  product_code: string;
  product_name: string;
  packaging: string;
  contract_uom: string;
  unit_weight_kg: string | null;
  quantity_ton: string;
  hader_city_id: string | null;
  hader_city_name: string | null;
  ship_to_location_id: string | null;
  ship_to_snapshot: unknown;
  requested_date: Date | string;
  delivery_notes: string | null;
  customer_rate_per_ton: string;
  total_amount: string;
  status: string;
  rejection_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: string;
  shipped_ton?: string;
}

interface ShipmentRow extends DeliveryRequestRow {
  shipment_id: string;
  shipment_number: string;
  shipment_quantity_ton: string;
  shipment_status: string;
  scheduled_date: Date | string | null;
  delivered_at: Date | string | null;
  shipment_created_at: Date | string;
}

export class HaderDeliveryService {
  async listRequests(query: HaderListQuery) {
    const { values, where } = buildFilters(query, 'dr.status', [
      'dr.request_number',
      'o.order_number',
      'ca.company_name',
      'oi.product_name',
      'oi.product_code',
    ]);
    return listRows<DeliveryRequestRow>(
      `${deliveryRequestSelect} ${where} order by dr.created_at desc`,
      values,
      query.page,
      mapRequest,
    );
  }

  async getRequest(id: string) {
    const result = await pool.query<DeliveryRequestRow>(`${deliveryRequestSelect} where dr.id=$1`, [
      id,
    ]);
    const row = result.rows[0];
    if (!row)
      throw new AppError('Delivery request was not found.', 404, 'DELIVERY_REQUEST_NOT_FOUND');
    return mapRequest(row);
  }

  async approve(id: string, user: SalesUser) {
    return this.changeRequestStatus(id, user, 'APPROVED', 'DELIVERY_REQUEST_APPROVED');
  }

  async reject(id: string, user: SalesUser, reason: string) {
    return this.changeRequestStatus(id, user, 'REJECTED', 'DELIVERY_REQUEST_REJECTED', reason);
  }

  async createShipment(id: string, user: SalesUser, input: CreateShipmentInput) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query<DeliveryRequestRow>(
        `${deliveryRequestSelect} where dr.id=$1 for update of dr`,
        [id],
      );
      const request = locked.rows[0];
      if (!request)
        throw new AppError('Delivery request was not found.', 404, 'DELIVERY_REQUEST_NOT_FOUND');
      if (!['APPROVED', 'CONVERTED_TO_SHIPMENT'].includes(request.status)) {
        throw new AppError(
          'Only approved delivery requests can create shipments.',
          409,
          'DELIVERY_REQUEST_NOT_APPROVED',
        );
      }
      if (input.clientRequestId) {
        const existing = await client.query<{ id: string }>(
          `select id from shipments where delivery_request_id=$1 and client_request_id=$2`,
          [id, input.clientRequestId],
        );
        const existingId = existing.rows[0]?.id;
        if (existingId) {
          await client.query('commit');
          return this.getShipment(existingId);
        }
      }
      const shipped = await client.query<{ total: string }>(
        `select coalesce(sum(quantity_ton),0)::text as total from shipments where delivery_request_id=$1`,
        [id],
      );
      const shippedTon = Number(shipped.rows[0]?.total ?? 0);
      const remainingTon = round(Number(request.quantity_ton) - shippedTon, 3);
      const quantityTon = round(input.quantityTon, 3);
      if (quantityTon <= 0 || quantityTon > remainingTon) {
        throw new AppError(
          'Shipment quantity exceeds the delivery request remaining quantity.',
          409,
          'SHIPMENT_QUANTITY_EXCEEDS_REMAINING',
        );
      }
      const number = await nextReference(client, 'shipment_number_seq', 'SHP');
      const result = await client.query<{ id: string }>(
        `insert into shipments (shipment_number,delivery_request_id,order_id,customer_account_id,
          quantity_ton,status,scheduled_date,created_by_sales_user_id,client_request_id)
         values ($1,$2,$3,$4,$5,'CREATED',$6,$7,$8) returning id`,
        [
          number,
          id,
          request.order_id,
          request.customer_account_id,
          quantityTon,
          input.scheduledDate ?? null,
          user.id,
          input.clientRequestId ?? null,
        ],
      );
      const shipmentId = result.rows[0]?.id;
      if (!shipmentId)
        throw new AppError('Shipment could not be created.', 503, 'SHIPMENT_CREATE_FAILED');
      await client.query(
        `insert into shipment_events (shipment_id,event_type,previous_status,new_status,
        changed_by_sales_user_id,notes) values ($1,'SHIPMENT_CREATED',null,'CREATED',$2,null)`,
        [shipmentId, user.id],
      );
      const orderStatus = await client.query<{ status: string }>(
        `update orders set status='PROCESSING',updated_at=now()
         where id=$1 and status='SUBMITTED' returning status`,
        [request.order_id],
      );
      if (orderStatus.rows[0]) {
        await client.query(
          `insert into order_events (order_id,event_type,previous_status,new_status,
           changed_by_sales_user_id,event_data)
           values ($1,'SHIPMENT_CREATED','SUBMITTED','PROCESSING',$2,$3::jsonb)`,
          [request.order_id, user.id, JSON.stringify({ shipmentId, shipmentNumber: number })],
        );
      }
      if (request.status !== 'CONVERTED_TO_SHIPMENT') {
        await client.query(
          `update delivery_requests set status='CONVERTED_TO_SHIPMENT',updated_at=now() where id=$1`,
          [id],
        );
        await client.query(
          `insert into delivery_request_events (delivery_request_id,event_type,previous_status,
          new_status,changed_by_sales_user_id) values ($1,'SHIPMENT_CREATED',$2,'CONVERTED_TO_SHIPMENT',$3)`,
          [id, request.status, user.id],
        );
      }
      await client.query('commit');
      return this.getShipment(shipmentId);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async listShipments(query: HaderListQuery) {
    const { values, where } = buildFilters(query, 's.status', [
      's.shipment_number',
      'o.order_number',
      'ca.company_name',
      'oi.product_name',
      'oi.product_code',
    ]);
    return listRows<ShipmentRow>(
      `${shipmentSelect} ${where} order by s.created_at desc`,
      values,
      query.page,
      mapShipment,
    );
  }

  async getShipment(id: string) {
    const result = await pool.query<ShipmentRow>(`${shipmentSelect} where s.id=$1`, [id]);
    const row = result.rows[0];
    if (!row) throw new AppError('Shipment was not found.', 404, 'SHIPMENT_NOT_FOUND');
    return mapShipment(row);
  }

  private async changeRequestStatus(
    id: string,
    user: SalesUser,
    nextStatus: 'APPROVED' | 'REJECTED',
    eventType: string,
    reason?: string,
  ) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await client.query<{ status: string }>(
        'select status from delivery_requests where id=$1 for update',
        [id],
      );
      const previous = current.rows[0]?.status;
      if (!previous)
        throw new AppError('Delivery request was not found.', 404, 'DELIVERY_REQUEST_NOT_FOUND');
      if (!['PENDING', 'UNDER_REVIEW'].includes(previous))
        throw new AppError(
          'Delivery request can no longer be reviewed.',
          409,
          'DELIVERY_REQUEST_TRANSITION_INVALID',
        );
      await client.query(
        `update delivery_requests set status=$2,rejection_reason=$3,
        reviewed_by_sales_user_id=$4,reviewed_at=now(),updated_at=now() where id=$1`,
        [id, nextStatus, reason ?? null, user.id],
      );
      await client.query(
        `insert into delivery_request_events (delivery_request_id,event_type,previous_status,
        new_status,changed_by_sales_user_id,reason) values ($1,$2,$3,$4,$5,$6)`,
        [id, eventType, previous, nextStatus, user.id, reason ?? null],
      );
      await client.query('commit');
      return this.getRequest(id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const haderDeliveryService = new HaderDeliveryService();

export async function createDeliveryRequestForOrder(
  client: PoolClient,
  input: {
    orderId: string;
    customerAccountId: string;
    haderCityId: string | null;
    shipToLocationId: string | null;
    quantityTon: number;
    requestedDate: string;
    customerUserId: string;
  },
) {
  const number = await nextReference(client, 'delivery_request_number_seq', 'DR');
  const result = await client.query<{ id: string }>(
    `insert into delivery_requests (request_number,order_id,customer_account_id,hader_city_id,
      ship_to_location_id,quantity_ton,requested_date,status)
     values ($1,$2,$3,$4,$5,$6,$7,'PENDING') on conflict (order_id) do nothing returning id`,
    [
      number,
      input.orderId,
      input.customerAccountId,
      input.haderCityId,
      input.shipToLocationId,
      input.quantityTon,
      input.requestedDate,
    ],
  );
  const id = result.rows[0]?.id;
  if (id)
    await client.query(
      `insert into delivery_request_events (delivery_request_id,event_type,
    previous_status,new_status,changed_by_customer_user_id) values ($1,'DELIVERY_REQUEST_CREATED',null,'PENDING',$2)`,
      [id, input.customerUserId],
    );
  return id ?? null;
}

async function nextReference(client: PoolClient, sequence: string, prefix: string) {
  const result = await client.query<{ sequence: string }>(
    `select nextval('${sequence}')::text as sequence`,
  );
  return `${prefix}-${new Date().getFullYear()}-${String(result.rows[0]?.sequence ?? '1').padStart(6, '0')}`;
}
function buildFilters(query: HaderListQuery, statusColumn: string, searchColumns: string[]) {
  const values: unknown[] = [];
  const clauses: string[] = [];
  if (query.status) {
    values.push(query.status);
    clauses.push(`${statusColumn}=$${values.length}`);
  }
  if (query.search) {
    values.push(`%${query.search.toLowerCase()}%`);
    clauses.push(
      `(${searchColumns.map((c) => `lower(coalesce(${c},'')) like $${values.length}`).join(' or ')})`,
    );
  }
  return { values, where: clauses.length ? `where ${clauses.join(' and ')}` : '' };
}
async function listRows<TRow extends QueryResultRow>(
  sql: string,
  filterValues: unknown[],
  page: number,
  mapper: (row: TRow) => unknown,
) {
  const countResult = await pool.query<{ total: string }>(
    `select count(*)::text as total from (${sql}) q`,
    filterValues,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  const offset = (page - 1) * PAGE_SIZE;
  const values = [...filterValues, PAGE_SIZE, offset];
  const result = await pool.query<TRow>(
    `${sql} limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return {
    items: result.rows.map(mapper),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  };
}
function mapRequest(row: DeliveryRequestRow) {
  const quantityTon = Number(row.quantity_ton);
  const unitWeight = Number(row.unit_weight_kg ?? 0);
  return {
    id: row.id,
    requestNumber: row.request_number,
    status: row.status,
    order: { id: row.order_id, number: row.order_number },
    contract: { id: row.contract_id, reference: row.contract_reference },
    customer: {
      id: row.customer_account_id,
      companyName: row.company_name,
      contact: row.contact_name,
      phone: row.contact_phone,
    },
    product: {
      id: row.product_id,
      code: row.product_code,
      name: row.product_name,
      packaging: row.packaging,
      uom: row.contract_uom,
    },
    quantityTon,
    equivalentBags:
      unitWeight > 0 && row.packaging.toLowerCase() !== 'bulk'
        ? Math.round((quantityTon * 1000) / unitWeight)
        : null,
    haderCity: { id: row.hader_city_id, name: row.hader_city_name },
    shipTo: objectValue(row.ship_to_snapshot),
    requestedDate: dateOnly(row.requested_date),
    notes: row.delivery_notes,
    customerRatePerTon: Number(row.customer_rate_per_ton),
    totalAmount: Number(row.total_amount),
    shippedTon: Number(row.shipped_ton ?? 0),
    remainingTon: round(quantityTon - Number(row.shipped_ton ?? 0), 3),
    rejectionReason: row.rejection_reason,
    createdAt: dateTime(row.created_at),
    updatedAt: dateTime(row.updated_at),
  };
}
function mapShipment(row: ShipmentRow) {
  return {
    id: row.shipment_id,
    shipmentNumber: row.shipment_number,
    status: row.shipment_status,
    quantityTon: Number(row.shipment_quantity_ton),
    scheduledDate: dateOnly(row.scheduled_date),
    deliveredAt: dateTime(row.delivered_at),
    createdAt: dateTime(row.shipment_created_at),
    deliveryRequest: mapRequest(row),
  };
}
function objectValue(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as object;
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
function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

const commonJoin = `from delivery_requests dr
 inner join orders o on o.id=dr.order_id inner join contracts c on c.id=o.contract_id
 inner join customer_accounts ca on ca.id=dr.customer_account_id
 inner join lateral (select oi.* from order_items oi where oi.order_id=o.id order by oi.created_at limit 1) oi on true
 inner join product_catalog p on p.id=oi.product_id
 left join lateral (select cu.name,cu.phone from customer_users cu where cu.customer_account_id=ca.id and cu.is_active=true order by (cu.role='CUSTOMER_ADMIN') desc,cu.created_at limit 1) contact on true`;
const deliveryRequestColumns = `dr.*,o.order_number,o.contract_id,c.reference as contract_reference,ca.company_name,
 contact.name as contact_name,contact.phone as contact_phone,oi.product_id,oi.product_code,oi.product_name,
 oi.packaging,oi.contract_uom,p.unit_weight_kg,o.hader_city_name,o.ship_to_snapshot,o.delivery_notes,
 o.approved_customer_rate_per_ton as customer_rate_per_ton,o.amount as total_amount,
 (select coalesce(sum(sx.quantity_ton),0)::text from shipments sx where sx.delivery_request_id=dr.id) as shipped_ton`;
const deliveryRequestSelect = `select ${deliveryRequestColumns} ${commonJoin}`;
const shipmentSelect = `select ${deliveryRequestColumns},s.id as shipment_id,s.shipment_number,
 s.quantity_ton as shipment_quantity_ton,s.status as shipment_status,s.scheduled_date,s.delivered_at,
 s.created_at as shipment_created_at ${commonJoin} inner join shipments s on s.delivery_request_id=dr.id`;
