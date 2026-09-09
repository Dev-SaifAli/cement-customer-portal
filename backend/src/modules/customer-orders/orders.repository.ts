import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';

export type OrderScope = {
  customerAccountId?: string;
  fulfilmentType?: 'PICKUP' | 'DELIVERY';
  contractOrdersOnly?: boolean;
};
export type OrderListFilters = {
  page: number;
  search?: string | undefined;
  orderType?: 'DIRECT' | 'CONTRACT' | undefined;
  status?: string | undefined;
};

interface OrderReadRow {
  id: string;
  order_number: string;
  contract_id: string | null;
  contract_reference: string | null;
  customer_account_id: string;
  company_name: string | null;
  status: string;
  fulfilment_type: 'PICKUP' | 'DELIVERY';
  requested_quantity_tons: string;
  remaining_contract_quantity_snapshot: string | null;
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
  pickup_location_city: string | null;
  customer_truck_id: string | null;
  customer_driver_id: string | null;
  pickup_truck_snapshot: unknown;
  pickup_driver_snapshot: unknown;
  hader_city_name: string | null;
  pallet_required: boolean;
  pallet_type: string | null;
  pallet_quantity: number | null;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  processed_by_sales_user_id: string | null;
  processed_at: Date | string | null;
  product_id: string;
  product_code: string;
  product_name: string;
  packaging: string;
  contract_uom: string;
  unit_weight_kg: string | null;
  packaging_quantity: string | null;
  shipment_count?: string;
  latest_shipment_status?: string | null;
  first_shipment_id?: string | null;
  first_shipment_number?: string | null;
  delivery_request_id: string | null;
  delivery_request_number: string | null;
  delivery_request_status: string | null;
  hader_zone_status: 'WITHIN_HADER_ZONE' | 'OUTSIDE_HADER_ZONE' | null;
  created_by_customer_user_id: string | null;
  created_by_sales_user_id: string | null;
  creator_customer_name: string | null;
  creator_sales_name: string | null;
  creator_sales_role: string | null;
}

export interface OrderProcessingCandidate {
  id: string;
  order_number: string;
  contract_id: string | null;
  status: string;
  customer_status: string;
  product_active: boolean;
  requested_quantity_tons: string;
  fulfilment_type: 'PICKUP' | 'DELIVERY';
  hader_city_id: string | null;
  hader_city_name: string | null;
  customer_account_id: string;
  preferred_delivery_date: Date | string | null;
  ship_to_location_id: string | null;
  ship_to_snapshot: unknown;
  pickup_location_id: string | null;
  pickup_location_name: string | null;
  hader_zone_status: 'WITHIN_HADER_ZONE' | 'OUTSIDE_HADER_ZONE' | null;
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
    if (scope.fulfilmentType) {
      values.push(scope.fulfilmentType);
      clauses.push(`orders.fulfilment_type = $${values.length}`);
    }
    if (scope.contractOrdersOnly) {
      clauses.push("orders.contract_id is not null and orders.order_number not like 'DO%'");
    }
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`orders.status = $${values.length}`);
    }
    if (filters.orderType === 'DIRECT') clauses.push("orders.order_number like 'DO%'");
    if (filters.orderType === 'CONTRACT')
      clauses.push("orders.contract_id is not null and orders.order_number not like 'DO%'");
    if (filters.search) {
      values.push(`%${filters.search.toLowerCase()}%`);
      clauses.push(`(
        lower(orders.order_number) like $${values.length}
        or lower(coalesce(contracts.reference, '')) like $${values.length}
        or lower(order_items.product_name) like $${values.length}
        or lower(order_items.product_code) like $${values.length}
        or lower(coalesce(customer_accounts.company_name, '')) like $${values.length}
        or lower(coalesce(creator_customer.name, '')) like $${values.length}
        or lower(coalesce(creator_sales.name, '')) like $${values.length}
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
    if (scope.fulfilmentType) {
      values.push(scope.fulfilmentType);
      clauses.push(`orders.fulfilment_type = $${values.length}`);
    }
    if (scope.contractOrdersOnly) {
      clauses.push("orders.contract_id is not null and orders.order_number not like 'DO%'");
    }
    const result = await pool.query<OrderReadRow>(
      `${orderSelectSql} where ${clauses.join(' and ')}`,
      values,
    );
    return result.rows[0] ? mapOrderReadRow(result.rows[0]) : null;
  }

  async getProcessingCandidateForUpdate(id: string, client: PoolClient) {
    const result = await client.query<OrderProcessingCandidate>(
      `select orders.id, orders.order_number, orders.contract_id, orders.status, orders.customer_account_id,
              customer_accounts.status as customer_status,
              product_catalog.is_active as product_active,
              orders.requested_quantity_tons, orders.fulfilment_type, orders.preferred_delivery_date,
              orders.hader_city_id, orders.hader_city_name,
              orders.hader_zone_status,
              orders.ship_to_location_id, orders.ship_to_snapshot,
              orders.pickup_location_id, orders.pickup_location_name
       from orders
       inner join customer_accounts on customer_accounts.id = orders.customer_account_id
       inner join lateral (
         select order_items.product_id
         from order_items
         where order_items.order_id = orders.id
         order by order_items.created_at asc
         limit 1
       ) order_item on true
       inner join product_catalog on product_catalog.id = order_item.product_id
       where orders.id = $1
       for update of orders`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async markProcessing(id: string, internalUserId: string, client: PoolClient) {
    await client.query(
      `update orders
       set status = 'PROCESSING', processed_by_sales_user_id = $2,
           processed_at = now(), updated_at = now()
       where id = $1`,
      [id, internalUserId],
    );
  }

  async addProcessingStartedEvent(
    order: Pick<OrderProcessingCandidate, 'id' | 'order_number' | 'status'>,
    internalUserId: string,
    actorRole: string,
    client: PoolClient,
  ) {
    await client.query(
      `insert into order_events (
         order_id, event_type, previous_status, new_status,
         changed_by_sales_user_id, event_data
       ) values ($1, 'ORDER_PROCESSING_STARTED', $2, 'PROCESSING', $3, $4::jsonb)`,
      [
        order.id,
        order.status,
        internalUserId,
        JSON.stringify({
          orderReference: order.order_number,
          actorType: 'HADER',
          actorRole,
        }),
      ],
    );
  }
}

export const ordersRepository = new OrdersRepository();

const orderJoinSql = `from orders
 left join contracts on contracts.id = orders.contract_id
 left join delivery_requests on delivery_requests.order_id = orders.id
 left join pickup_locations on pickup_locations.id::text = orders.pickup_location_id
 left join ksa_cities pickup_cities on pickup_cities.id = pickup_locations.city_id
 inner join customer_accounts on customer_accounts.id = orders.customer_account_id
 left join customer_users creator_customer on creator_customer.id = orders.created_by_customer_user_id
 left join sales_users creator_sales on creator_sales.id = orders.created_by_sales_user_id
 inner join lateral (
   select order_items.*
   from order_items
   where order_items.order_id = orders.id
   order by order_items.created_at asc
   limit 1
 ) order_items on true`;

const orderSelectSql = `select orders.*,
  contracts.reference as contract_reference,
  delivery_requests.id as delivery_request_id,
  delivery_requests.request_number as delivery_request_number,
  delivery_requests.status as delivery_request_status,
  customer_accounts.company_name,
  creator_customer.name as creator_customer_name,
  creator_sales.name as creator_sales_name,
  creator_sales.role as creator_sales_role,
  order_items.product_id,
  order_items.product_code,
  order_items.product_name,
  order_items.packaging,
  order_items.contract_uom,
  order_items.unit_weight_kg,
  order_items.packaging_quantity,
  pickup_cities.name as pickup_location_city
 ${orderJoinSql}`;

const orderSelectWithShipmentSql = `select orders.*,
  contracts.reference as contract_reference,
  delivery_requests.id as delivery_request_id,
  delivery_requests.request_number as delivery_request_number,
  delivery_requests.status as delivery_request_status,
  customer_accounts.company_name,
  creator_customer.name as creator_customer_name,
  creator_sales.name as creator_sales_name,
  creator_sales.role as creator_sales_role,
  order_items.product_id,
  order_items.product_code,
  order_items.product_name,
  order_items.packaging,
  order_items.contract_uom,
  order_items.unit_weight_kg,
  order_items.packaging_quantity,
  pickup_cities.name as pickup_location_city,
  shipment_summary.shipment_count,
  shipment_summary.latest_shipment_status,
  shipment_summary.first_shipment_id,
  shipment_summary.first_shipment_number
 ${orderJoinSql}
 left join lateral (
   select count(*)::text as shipment_count,
     (array_agg(shipments.status order by shipments.created_at desc))[1] as latest_shipment_status,
     (array_agg(shipments.id order by shipments.created_at asc))[1] as first_shipment_id,
     (array_agg(shipments.shipment_number order by shipments.created_at asc))[1] as first_shipment_number
   from shipments where shipments.order_id=orders.id
 ) shipment_summary on true`;

function mapOrderReadRow(row: OrderReadRow) {
  const isDirectOrder = row.order_number.startsWith('DO');
  return {
    id: row.id,
    orderNumber: row.order_number,
    contract: row.contract_id ? { id: row.contract_id, reference: row.contract_reference } : null,
    orderType: isDirectOrder ? ('DIRECT' as const) : ('CONTRACT' as const),
    customer: { id: row.customer_account_id, companyName: row.company_name },
    creator: row.created_by_customer_user_id && row.creator_customer_name
      ? {
          type: 'CUSTOMER' as const,
          id: row.created_by_customer_user_id,
          name: row.creator_customer_name,
          role: null,
        }
      : row.created_by_sales_user_id && row.creator_sales_name
        ? {
            type: 'INTERNAL' as const,
            id: row.created_by_sales_user_id,
            name: row.creator_sales_name,
            role: row.creator_sales_role,
          }
        : null,
    status: row.status,
    fulfilmentType: row.fulfilment_type,
    requestedQuantityTons: Number(row.requested_quantity_tons),
    remainingContractQuantityTons:
      row.remaining_contract_quantity_snapshot === null
        ? null
        : Number(row.remaining_contract_quantity_snapshot),
    preferredDeliveryDate: dateOnly(row.preferred_delivery_date),
    deliveryNotes: row.delivery_notes,
    palletRequired: row.pallet_required,
    palletType: row.pallet_type,
    palletQuantity: row.pallet_quantity,
    shipTo: objectValue(row.ship_to_snapshot),
    pickupLocation: row.pickup_location_id
      ? {
          id: row.pickup_location_id,
          name: row.pickup_location_name,
          city:
            row.pickup_location_city ??
            (row.pickup_location_id === 'ALSAFWA_PLANT_MAIN' ? 'Jeddah' : null),
        }
      : null,
    pickupTruck: objectValue(row.pickup_truck_snapshot),
    pickupDriver: objectValue(row.pickup_driver_snapshot),
    haderCity: row.hader_city_name,
    haderZoneStatus: row.hader_zone_status,
    product: {
      id: row.product_id,
      code: row.product_code,
      name: row.product_name,
      packaging: row.packaging,
      uom: row.contract_uom,
      unitWeightKg: row.unit_weight_kg == null ? null : Number(row.unit_weight_kg),
      equivalentPackagingUnits:
        row.packaging_quantity == null ? null : Number(row.packaging_quantity),
    },
    customerRatePerTon: Number(row.approved_customer_rate_per_ton),
    subtotal: Number(row.amount),
    vatRate: Number(row.vat_rate),
    vatAmount: Number(row.vat_amount),
    grandTotal: Number(row.grand_total),
    submittedAt: dateTime(row.submitted_at),
    createdAt: dateTime(row.created_at),
    updatedAt: dateTime(row.updated_at),
    processing: row.processed_at
      ? {
          processedBySalesUserId: row.processed_by_sales_user_id,
          processedAt: dateTime(row.processed_at),
        }
      : null,
    deliveryRequest: row.delivery_request_id
      ? {
          id: row.delivery_request_id,
          requestNumber: row.delivery_request_number,
          status: row.delivery_request_status,
        }
      : null,
    ...(row.shipment_count !== undefined
      ? {
          shipmentSummary: {
            count: Number(row.shipment_count),
            latestStatus: row.latest_shipment_status,
            firstShipment:
              row.first_shipment_id && row.first_shipment_number
                ? { id: row.first_shipment_id, shipmentNumber: row.first_shipment_number }
                : null,
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
