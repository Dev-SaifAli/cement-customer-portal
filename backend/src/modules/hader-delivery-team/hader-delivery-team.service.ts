import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { DeliveryTeamListQuery } from './hader-delivery-team.validation.js';

const PAGE_SIZE = 10;

type DeliveryExecutionStatus = 'LOADED' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'CLOSED';

interface DeliveryTeamRow {
  id: string;
  shipment_number: string;
  shipment_status: string;
  loading_status: string | null;
  quantity_ton: string;
  scheduled_date: Date | string | null;
  scheduled_time: string | null;
  dispatched_at: Date | string | null;
  in_transit_at: Date | string | null;
  delivered_at: Date | string | null;
  closed_at: Date | string | null;
  order_id: string;
  order_number: string;
  contract_id: string | null;
  contract_reference: string | null;
  company_name: string;
  product_id: string;
  product_code: string;
  product_name: string;
  packaging: string;
  contract_uom: string;
  unit_weight_kg: string | null;
  hader_city_id: string | null;
  hader_city_name: string | null;
  ship_to_snapshot: unknown;
  requested_date: Date | string | null;
  transporter_id: string | null;
  transporter_name: string | null;
  hader_truck_id: string | null;
  truck_number: string | null;
  plate_number: string | null;
  vehicle_type: string | null;
  truck_capacity_ton: string | null;
  hader_driver_id: string | null;
  driver_name: string | null;
  driver_mobile: string | null;
  driver_license_number: string | null;
}

export class HaderDeliveryTeamService {
  async list(query: DeliveryTeamListQuery) {
    const values: unknown[] = [];
    const clauses = [
      `((s.status='ASSIGNED' and s.loading_status='LOADED')
        or s.status in ('DISPATCHED','IN_TRANSIT','DELIVERED','CLOSED'))`,
    ];

    if (query.status) {
      if (query.status === 'LOADED') {
        clauses.push("s.status='ASSIGNED' and s.loading_status='LOADED'");
      } else {
        values.push(query.status);
        clauses.push(`s.status=$${values.length}`);
      }
    }
    if (query.haderCityId) {
      values.push(query.haderCityId);
      clauses.push(`dr.hader_city_id=$${values.length}`);
    }
    if (query.deliveryDate) {
      values.push(query.deliveryDate);
      clauses.push(`s.scheduled_date=$${values.length}`);
    }
    if (query.driverId) {
      values.push(query.driverId);
      clauses.push(`s.hader_driver_id=$${values.length}`);
    }
    if (query.truckId) {
      values.push(query.truckId);
      clauses.push(`s.hader_truck_id=$${values.length}`);
    }
    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      clauses.push(`(lower(s.shipment_number) like $${values.length}
        or lower(o.order_number) like $${values.length}
        or lower(ca.company_name) like $${values.length}
        or lower(oi.product_name) like $${values.length})`);
    }

    const where = `where ${clauses.join(' and ')}`;
    const count = await pool.query<{ total: string }>(
      `select count(*)::text total ${deliveryTeamFrom} ${where}`,
      values,
    );
    const offset = (query.page - 1) * PAGE_SIZE;
    const rows = await pool.query<DeliveryTeamRow>(
      `${deliveryTeamSelect} ${where}
       order by coalesce(s.scheduled_date,dr.requested_date),s.created_at
       limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, PAGE_SIZE, offset],
    );
    const total = Number(count.rows[0]?.total ?? 0);
    return {
      items: rows.rows.map(mapShipment),
      pagination: {
        page: query.page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    };
  }

  async detail(id: string) {
    const result = await pool.query<DeliveryTeamRow>(`${deliveryTeamSelect} where s.id=$1`, [id]);
    const row = result.rows[0];
    if (!row) throw new AppError('Shipment was not found.', 404, 'SHIPMENT_NOT_FOUND');
    if (!isDeliveryExecutionShipment(row)) {
      throw new AppError(
        'Only loaded delivery shipments are available to the Delivery Team.',
        409,
        'SHIPMENT_NOT_READY_FOR_DELIVERY',
      );
    }
    const history = await pool.query<{
      event_type: string;
      previous_status: string | null;
      new_status: string | null;
      notes: string | null;
      created_at: Date | string;
      actor_name: string | null;
    }>(
      `select event.event_type,event.previous_status,event.new_status,event.notes,event.created_at,
        actor.name actor_name from shipment_events event
       left join sales_users actor on actor.id=event.changed_by_sales_user_id
       where event.shipment_id=$1 order by event.created_at,event.id`,
      [id],
    );
    return {
      ...mapShipment(row),
      history: history.rows.map((event) => ({
        eventType: event.event_type,
        previousStatus: event.previous_status,
        newStatus: event.new_status,
        notes: event.notes,
        actor: event.actor_name ?? 'Internal user',
        createdAt: new Date(String(event.created_at)).toISOString(),
      })),
    };
  }

  async startDelivery(id: string, actor: SalesUser) {
    return this.transition(id, actor, {
      from: 'DISPATCHED',
      to: 'IN_TRANSIT',
      event: 'SHIPMENT_IN_TRANSIT',
      timestampColumn: 'in_transit_at',
      actorColumn: 'in_transit_by_sales_user_id',
    });
  }

  async deliver(id: string, actor: SalesUser) {
    return this.transition(id, actor, {
      from: 'IN_TRANSIT',
      to: 'DELIVERED',
      event: 'SHIPMENT_DELIVERED',
      timestampColumn: 'delivered_at',
      actorColumn: 'delivered_by_sales_user_id',
    });
  }

  async close(id: string, actor: SalesUser) {
    return this.transition(id, actor, {
      from: 'DELIVERED',
      to: 'CLOSED',
      event: 'SHIPMENT_CLOSED',
      timestampColumn: 'closed_at',
      actorColumn: 'closed_by_sales_user_id',
      requiresPod: true,
    });
  }

  private async transition(
    id: string,
    actor: SalesUser,
    change: {
      from: DeliveryExecutionStatus;
      to: DeliveryExecutionStatus;
      event: string;
      timestampColumn: 'in_transit_at' | 'delivered_at' | 'closed_at';
      actorColumn:
        'in_transit_by_sales_user_id' | 'delivered_by_sales_user_id' | 'closed_by_sales_user_id';
      requiresPod?: boolean;
    },
  ) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await client.query<{ status: string }>(
        'select status from shipments where id=$1 for update',
        [id],
      );
      const status = current.rows[0]?.status;
      if (!status) throw new AppError('Shipment was not found.', 404, 'SHIPMENT_NOT_FOUND');
      if (status !== change.from) {
        throw new AppError(
          `Shipment must be ${label(change.from)} before it can move to ${label(change.to)}.`,
          409,
          'DELIVERY_TEAM_TRANSITION_INVALID',
        );
      }
      if (change.requiresPod) {
        const pod = await client.query<{ exists: boolean }>(
          'select exists(select 1 from shipment_pods where shipment_id=$1) as exists',
          [id],
        );
        if (!pod.rows[0]?.exists) {
          throw new AppError(
            'Proof of delivery is required before the shipment can be closed.',
            409,
            'SHIPMENT_POD_REQUIRED',
          );
        }
      }
      await client.query(
        `update shipments set status=$2,${change.timestampColumn}=now(),${change.actorColumn}=$3,
          updated_at=now() where id=$1`,
        [id, change.to, actor.id],
      );
      await addEvent(client, id, change.event, change.from, change.to, actor.id);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.detail(id);
  }
}

export const haderDeliveryTeamService = new HaderDeliveryTeamService();

const deliveryTeamFrom = `from shipments s
 join orders o on o.id=s.order_id
 left join contracts c on c.id=o.contract_id
 join delivery_requests dr on dr.id=s.delivery_request_id
 join customer_accounts ca on ca.id=s.customer_account_id
 join lateral (select item.* from order_items item where item.order_id=o.id order by item.created_at limit 1) oi on true
 join product_catalog p on p.id=oi.product_id
 left join ksa_cities city on city.id=dr.hader_city_id
 left join transporters t on t.id=s.transporter_id
 left join hader_trucks truck on truck.id=s.hader_truck_id
 left join hader_drivers driver on driver.id=s.hader_driver_id`;

const deliveryTeamSelect = `select s.id,s.shipment_number,s.status shipment_status,s.loading_status,
 s.quantity_ton,s.scheduled_date,s.scheduled_time,s.dispatched_at,s.in_transit_at,s.delivered_at,
 s.closed_at,o.id order_id,o.order_number,c.id contract_id,c.reference contract_reference,
 ca.company_name,oi.product_id,oi.product_code,oi.product_name,oi.packaging,oi.contract_uom,
 p.unit_weight_kg,dr.hader_city_id,city.name hader_city_name,o.ship_to_snapshot,dr.requested_date,
 s.transporter_id,t.name transporter_name,s.hader_truck_id,truck.truck_number,truck.plate_number,
 truck.vehicle_type,truck.capacity_ton truck_capacity_ton,s.hader_driver_id,driver.name driver_name,
 driver.mobile driver_mobile,driver.license_number driver_license_number ${deliveryTeamFrom}`;

function mapShipment(row: DeliveryTeamRow) {
  const quantityTon = Number(row.quantity_ton);
  const weight = Number(row.unit_weight_kg ?? 0);
  return {
    id: row.id,
    shipmentNumber: row.shipment_number,
    status: executionStatus(row),
    quantityTon,
    equivalentBags:
      weight > 0 && row.packaging.toLowerCase() !== 'bulk'
        ? Math.round((quantityTon * 1000) / weight)
        : null,
    scheduledDate: dateOnly(row.scheduled_date),
    scheduledTime: row.scheduled_time ? String(row.scheduled_time).slice(0, 5) : null,
    requestedDate: dateOnly(row.requested_date),
    dispatchedAt: dateTime(row.dispatched_at),
    inTransitAt: dateTime(row.in_transit_at),
    deliveredAt: dateTime(row.delivered_at),
    closedAt: dateTime(row.closed_at),
    order: { id: row.order_id, number: row.order_number },
    contract: row.contract_id ? { id: row.contract_id, reference: row.contract_reference } : null,
    customer: { companyName: row.company_name },
    product: {
      id: row.product_id,
      code: row.product_code,
      name: row.product_name,
      packaging: row.packaging,
      uom: row.contract_uom,
    },
    haderCity: { id: row.hader_city_id, name: row.hader_city_name },
    shipTo: objectValue(row.ship_to_snapshot),
    assignment: row.transporter_id
      ? {
          transporter: { id: row.transporter_id, name: row.transporter_name },
          truck: row.hader_truck_id
            ? {
                id: row.hader_truck_id,
                number: row.truck_number,
                plateNumber: row.plate_number,
                vehicleType: row.vehicle_type,
                capacityTon: Number(row.truck_capacity_ton ?? 0),
              }
            : null,
          driver: row.hader_driver_id
            ? {
                id: row.hader_driver_id,
                name: row.driver_name,
                mobile: row.driver_mobile,
                licenseNumber: row.driver_license_number,
              }
            : null,
        }
      : null,
  };
}

function executionStatus(row: DeliveryTeamRow): DeliveryExecutionStatus {
  return row.shipment_status === 'ASSIGNED' && row.loading_status === 'LOADED'
    ? 'LOADED'
    : (row.shipment_status as DeliveryExecutionStatus);
}

function isDeliveryExecutionShipment(row: DeliveryTeamRow) {
  return ['LOADED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED'].includes(
    executionStatus(row),
  );
}

async function addEvent(
  client: PoolClient,
  shipmentId: string,
  eventType: string,
  previousStatus: string,
  newStatus: string,
  actorId: string,
) {
  await client.query(
    `insert into shipment_events (shipment_id,event_type,previous_status,new_status,
      changed_by_sales_user_id,event_data) values ($1,$2,$3,$4,$5,'{}'::jsonb)`,
    [shipmentId, eventType, previousStatus, newStatus, actorId],
  );
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

function label(value: string) {
  return value.replaceAll('_', ' ').toLowerCase();
}
