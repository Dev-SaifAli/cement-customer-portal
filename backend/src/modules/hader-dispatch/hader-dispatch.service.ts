import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import { haderDeliveryService } from '../hader-delivery/hader-delivery.service.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type {
  AssignShipmentInput,
  DispatchListQuery,
  ScheduleShipmentInput,
} from './hader-dispatch.validation.js';

const activeShipmentStatuses = ['ASSIGNED', 'LOADING', 'DISPATCHED', 'IN_TRANSIT'];

export class HaderDispatchService {
  async list(query: DispatchListQuery) {
    return haderDeliveryService.listShipments(query);
  }

  async detail(id: string) {
    const [shipment, history] = await Promise.all([
      haderDeliveryService.getShipment(id),
      pool.query<{
        event_type: string;
        previous_status: string | null;
        new_status: string | null;
        notes: string | null;
        event_data: unknown;
        created_at: Date | string;
        actor_name: string | null;
      }>(
        `select e.event_type,e.previous_status,e.new_status,e.notes,e.event_data,e.created_at,
          u.name as actor_name
         from shipment_events e
         left join sales_users u on u.id=e.changed_by_sales_user_id
         where e.shipment_id=$1 order by e.created_at asc`,
        [id],
      ),
    ]);
    return {
      ...shipment,
      history: history.rows.map((event) => ({
        eventType: event.event_type,
        previousStatus: event.previous_status,
        newStatus: event.new_status,
        notes: event.notes,
        data: objectValue(event.event_data),
        actor: event.actor_name ?? 'Internal user',
        createdAt: new Date(String(event.created_at)).toISOString(),
      })),
    };
  }

  async filters() {
    const [cities, products] = await Promise.all([
      pool.query<{ id: string; name: string }>(
        `select distinct c.id,c.name from shipments s
         join delivery_requests dr on dr.id=s.delivery_request_id
         join ksa_cities c on c.id=dr.hader_city_id order by c.name`,
      ),
      pool.query<{ id: string; code: string; name: string }>(
        `select distinct p.id,p.product_code as code,p.product_name as name from shipments s
         join orders o on o.id=s.order_id
         join order_items oi on oi.order_id=o.id
         join product_catalog p on p.id=oi.product_id order by p.product_name`,
      ),
    ]);
    return { cities: cities.rows, products: products.rows };
  }

  async assign(id: string, input: AssignShipmentInput, actor: SalesUser) {
    return this.transaction(async (client) => {
      const shipment = await lockShipment(client, id);
      if (shipment.status !== 'CREATED') {
        throw new AppError(
          'Only created shipments can be assigned.',
          409,
          'SHIPMENT_ASSIGNMENT_INVALID',
        );
      }
      await validateTransporter(client, input.transporterId);
      await validateTruck(client, input.truckId, Number(shipment.quantity_ton), id);
      await validateDriver(client, input.driverId, id);
      const queue = await client.query<{ position: string }>(
        `select (coalesce(max(s2.queue_position),0)+1)::text position
         from shipments current_s join order_items current_i on current_i.order_id=current_s.order_id
         left join order_items other_i on other_i.product_id=current_i.product_id
         left join shipments s2 on s2.order_id=other_i.order_id and s2.loading_status<>'LOADED'
         where current_s.id=$1`,
        [id],
      );
      await client.query(
        `update shipments set transporter_id=$2,hader_truck_id=$3,hader_driver_id=$4,
          assigned_by_sales_user_id=$5,assigned_at=now(),status='ASSIGNED',
          loading_status='WAITING',queue_position=$6,updated_at=now()
         where id=$1`,
        [
          id,
          input.transporterId,
          input.truckId,
          input.driverId,
          actor.id,
          Number(queue.rows[0]?.position ?? 1),
        ],
      );
      await addEvent(client, id, 'SHIPMENT_ASSIGNED', 'CREATED', 'ASSIGNED', actor.id, {
        transporterId: input.transporterId,
        truckId: input.truckId,
        driverId: input.driverId,
      });
      return id;
    }).then(() => this.detail(id));
  }

  async schedule(id: string, input: ScheduleShipmentInput, actor: SalesUser) {
    return this.transaction(async (client) => {
      const shipment = await lockShipment(client, id);
      if (shipment.status !== 'ASSIGNED') {
        throw new AppError(
          'Only assigned shipments can be scheduled.',
          409,
          'SHIPMENT_SCHEDULE_INVALID',
        );
      }
      await client.query(
        `update shipments set scheduled_date=$2,scheduled_time=$3,updated_at=now() where id=$1`,
        [id, input.scheduledDate, input.scheduledTime],
      );
      await addEvent(client, id, 'SHIPMENT_SCHEDULED', 'ASSIGNED', 'ASSIGNED', actor.id, {
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
      });
      return id;
    }).then(() => this.detail(id));
  }

  async dispatch(id: string, actor: SalesUser) {
    return this.transaction(async (client) => {
      const shipment = await lockShipment(client, id);
      if (shipment.status !== 'ASSIGNED') {
        throw new AppError(
          'Only assigned shipments can be dispatched.',
          409,
          'SHIPMENT_DISPATCH_INVALID',
        );
      }
      if (
        !shipment.transporter_id ||
        !shipment.hader_truck_id ||
        !shipment.hader_driver_id ||
        !shipment.scheduled_date ||
        !shipment.scheduled_time
      ) {
        throw new AppError(
          'Transporter, truck, driver and schedule are required before dispatch.',
          400,
          'SHIPMENT_DISPATCH_INCOMPLETE',
        );
      }
      if (shipment.loading_status !== 'LOADED') {
        throw new AppError(
          'Shipment loading must be completed before dispatch.',
          409,
          'SHIPMENT_LOADING_INCOMPLETE',
        );
      }
      await validateTransporter(client, shipment.transporter_id);
      await validateTruck(client, shipment.hader_truck_id, Number(shipment.quantity_ton), id);
      await validateDriver(client, shipment.hader_driver_id, id);
      await client.query(
        `update shipments set status='DISPATCHED',dispatched_by_sales_user_id=$2,
          dispatched_at=now(),updated_at=now() where id=$1`,
        [id, actor.id],
      );
      await addEvent(client, id, 'SHIPMENT_DISPATCHED', 'ASSIGNED', 'DISPATCHED', actor.id, {
        transporterId: shipment.transporter_id,
        truckId: shipment.hader_truck_id,
        driverId: shipment.hader_driver_id,
      });
      return id;
    }).then(() => this.detail(id));
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const value = await work(client);
      await client.query('commit');
      return value;
    } catch (error) {
      await client.query('rollback');
      if (isUniqueViolation(error)) {
        throw new AppError(
          'The selected truck or driver is already assigned to an active shipment.',
          409,
          'DISPATCH_RESOURCE_BUSY',
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

export const haderDispatchService = new HaderDispatchService();

interface LockedShipment {
  id: string;
  status: string;
  quantity_ton: string;
  transporter_id: string | null;
  hader_truck_id: string | null;
  hader_driver_id: string | null;
  scheduled_date: Date | string | null;
  scheduled_time: string | null;
  loading_status: string | null;
}

async function lockShipment(client: PoolClient, id: string) {
  const result = await client.query<LockedShipment>(
    `select id,status,quantity_ton,transporter_id,hader_truck_id,hader_driver_id,
      scheduled_date,scheduled_time,loading_status from shipments where id=$1 for update`,
    [id],
  );
  const shipment = result.rows[0];
  if (!shipment) throw new AppError('Shipment was not found.', 404, 'SHIPMENT_NOT_FOUND');
  return shipment;
}

async function validateTransporter(client: PoolClient, id: string) {
  const result = await client.query<{ status: string }>(
    'select status from transporters where id=$1',
    [id],
  );
  if (result.rows[0]?.status !== 'ACTIVE') {
    throw new AppError('Selected transporter is not active.', 400, 'TRANSPORTER_NOT_ACTIVE');
  }
}

async function validateTruck(
  client: PoolClient,
  id: string,
  quantityTon: number,
  shipmentId: string,
) {
  const result = await client.query<{ status: string; capacity_ton: string }>(
    'select status,capacity_ton from hader_trucks where id=$1',
    [id],
  );
  const truck = result.rows[0];
  if (!truck || truck.status !== 'AVAILABLE') {
    throw new AppError('Selected truck is not available.', 400, 'HADER_TRUCK_NOT_AVAILABLE');
  }
  if (Number(truck.capacity_ton) < quantityTon) {
    throw new AppError(
      'Selected truck capacity is insufficient for this shipment.',
      400,
      'HADER_TRUCK_CAPACITY_INSUFFICIENT',
    );
  }
  await assertNotBusy(client, 'hader_truck_id', id, shipmentId, 'truck');
}

async function validateDriver(client: PoolClient, id: string, shipmentId: string) {
  const result = await client.query<{ status: string; license_expiry: Date | string | null }>(
    'select status,license_expiry from hader_drivers where id=$1',
    [id],
  );
  const driver = result.rows[0];
  if (!driver || driver.status !== 'ACTIVE') {
    throw new AppError('Selected driver is not active.', 400, 'HADER_DRIVER_NOT_ACTIVE');
  }
  if (driver.license_expiry && new Date(String(driver.license_expiry)) < startOfToday()) {
    throw new AppError('Selected driver license has expired.', 400, 'HADER_DRIVER_LICENSE_EXPIRED');
  }
  await assertNotBusy(client, 'hader_driver_id', id, shipmentId, 'driver');
}

async function assertNotBusy(
  client: PoolClient,
  column: 'hader_truck_id' | 'hader_driver_id',
  resourceId: string,
  shipmentId: string,
  label: string,
) {
  const result = await client.query<{ id: string }>(
    `select id from shipments where ${column}=$1 and id<>$2 and status=any($3::text[]) limit 1`,
    [resourceId, shipmentId, activeShipmentStatuses],
  );
  if (result.rows[0]) {
    throw new AppError(
      `Selected ${label} is already assigned to an active shipment.`,
      409,
      `HADER_${label.toUpperCase()}_BUSY`,
    );
  }
}

async function addEvent(
  client: PoolClient,
  shipmentId: string,
  eventType: string,
  previousStatus: string,
  newStatus: string,
  actorId: string,
  data: Record<string, unknown>,
) {
  await client.query(
    `insert into shipment_events (shipment_id,event_type,previous_status,new_status,
      changed_by_sales_user_id,event_data) values ($1,$2,$3,$4,$5,$6::jsonb)`,
    [shipmentId, eventType, previousStatus, newStatus, actorId, JSON.stringify(data)],
  );
}

function objectValue(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as object;
    } catch {
      return {};
    }
  }
  return {};
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}
