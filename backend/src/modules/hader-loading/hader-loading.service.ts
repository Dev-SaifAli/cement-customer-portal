import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import { haderDispatchService } from '../hader-dispatch/hader-dispatch.service.js';
import { loadingPointsService } from '../loading-points/loading-points.service.js';
import { notificationsService } from '../notifications/notifications.service.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { LoadingListQuery } from './hader-loading.validation.js';

const pageSize = 10;
type LoadingStatus = 'WAITING' | 'NOTIFIED' | 'AT_GATE' | 'LOADING' | 'LOADED';

export class HaderLoadingService {
  async list(query: LoadingListQuery) {
    const values: unknown[] = [];
    const clauses = ["s.status='ASSIGNED'", 's.loading_status is not null'];
    if (query.status) {
      values.push(query.status);
      clauses.push(`s.loading_status=$${values.length}`);
    }
    if (query.productId) {
      values.push(query.productId);
      clauses.push(`oi.product_id=$${values.length}`);
    }
    const where = `where ${clauses.join(' and ')}`;
    const count = await pool.query<{ total: string }>(
      `select count(*)::text total from shipments s join order_items oi on oi.order_id=s.order_id ${where}`,
      values,
    );
    const [summary, products] = await Promise.all([
      pool.query<{ status: string; total: string }>(
        `select loading_status status,count(*)::text total from shipments
       where status='ASSIGNED' and loading_status is not null group by loading_status`,
      ),
      pool.query<{ id: string; code: string; name: string }>(
        `select distinct p.id,p.product_code code,p.product_name name from shipments s
       join order_items oi on oi.order_id=s.order_id join product_catalog p on p.id=oi.product_id
       where s.status='ASSIGNED' and s.loading_status is not null order by p.product_name`,
      ),
    ]);
    const offset = (query.page - 1) * pageSize;
    const result = await pool.query<LoadingRow>(
      `${loadingSelect} ${where} order by oi.product_code,s.queue_position,s.assigned_at
       limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, pageSize, offset],
    );
    const total = Number(count.rows[0]?.total ?? 0);
    const counters = Object.fromEntries(summary.rows.map((row) => [row.status, Number(row.total)]));
    return {
      items: result.rows.map(mapLoading),
      counters: {
        waiting: counters.WAITING ?? 0,
        notified: counters.NOTIFIED ?? 0,
        atGate: counters.AT_GATE ?? 0,
        loading: counters.LOADING ?? 0,
        completed: counters.LOADED ?? 0,
      },
      products: products.rows,
      pagination: {
        page: query.page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async detail(id: string) {
    const [shipment, loading] = await Promise.all([
      haderDispatchService.detail(id),
      pool.query<LoadingRow>(`${loadingSelect} where s.id=$1`, [id]),
    ]);
    const row = loading.rows[0];
    if (!row) throw new AppError('Shipment was not found.', 404, 'SHIPMENT_NOT_FOUND');
    const points = await loadingPointsService.availableForShipment(id);
    if (row.loading_point_id && !points.some((point) => point.id === row.loading_point_id)) {
      points.push(await loadingPointsService.get(row.loading_point_id));
    }
    return {
      ...shipment,
      loading: mapLoading(row),
      compatibleLoadingPoints: points,
    };
  }

  async notify(id: string, remind: boolean, actor: SalesUser) {
    const shipment = await this.change(id, actor, async (client, row) => {
      if (row.loading_status !== 'WAITING' && !(remind && row.loading_status === 'NOTIFIED'))
        invalid('Driver can only be notified for a waiting shipment.');
      await client.query(
        `update shipments set loading_status='NOTIFIED',notified_at=now(),updated_at=now() where id=$1`,
        [id],
      );
      await event(client, id, 'DRIVER_NOTIFIED', row.loading_status, 'NOTIFIED', actor.id, {
        remind,
      });
    });
    await notificationsService.publishSafely({
      recipients: {
        kind: 'SALES_ROLES',
        roles: ['HADER_OPERATIONS', 'DISPATCH_USER', 'LOADING_USER'],
      },
      type: 'DRIVER_NOTIFIED',
      title: remind ? 'Driver reminder recorded' : 'Driver notified',
      message: driverNotificationMessage(shipment),
      entityType: 'SHIPMENT',
      entityId: id,
      actionUrl: `/hader/loading-control/${id}`,
      eventKey: `DRIVER_NOTIFIED:${id}:${Date.now()}`,
    });
    return shipment;
  }

  async arrival(id: string, stage: 'PARKING' | 'GATE', actor: SalesUser) {
    return this.change(id, actor, async (client, row) => {
      if (row.loading_status !== 'NOTIFIED')
        invalid('Only a notified shipment can record arrival.');
      if (stage === 'PARKING') {
        await client.query('update shipments set arrived_at=now(),updated_at=now() where id=$1', [
          id,
        ]);
        await event(client, id, 'TRUCK_ARRIVED', 'NOTIFIED', 'NOTIFIED', actor.id, {});
      } else {
        if (!row.arrived_at) invalid('Record parking arrival before marking the truck at gate.');
        await client.query(
          `update shipments set loading_status='AT_GATE',at_gate_at=now(),updated_at=now() where id=$1`,
          [id],
        );
        await event(client, id, 'TRUCK_AT_GATE', 'NOTIFIED', 'AT_GATE', actor.id, {});
      }
    });
  }

  async assignPoint(id: string, pointId: string, actor: SalesUser) {
    return this.change(id, actor, async (client, row) => {
      if (row.loading_status !== 'AT_GATE')
        invalid('Loading point can only be assigned at the gate.');
      const expected = row.packaging.toLowerCase() === 'bulk' ? 'SILO' : 'BAGGING_LINE';
      const point = await client.query<LoadingPointRow & { product_id: string | null }>(
        `select id,code,name,point_type,capacity_ton,capacity_ton_per_hour,max_trucks,
          status,product_id
         from hader_loading_points where id=$1 for update`,
        [pointId],
      );
      const selected = point.rows[0];
      if (!selected || !['AVAILABLE', 'BUSY'].includes(selected.status))
        throw new AppError('Selected loading point is not free.', 409, 'LOADING_POINT_UNAVAILABLE');
      if (
        selected.point_type !== expected ||
        (selected.product_id && selected.product_id !== row.product_id)
      )
        throw new AppError(
          'Selected loading point is incompatible with this shipment.',
          400,
          'LOADING_POINT_INCOMPATIBLE',
        );
      if (
        selected.point_type === 'SILO' &&
        selected.capacity_ton &&
        Number(selected.capacity_ton) < Number(row.quantity_ton)
      )
        throw new AppError(
          'Selected loading point capacity is insufficient.',
          400,
          'LOADING_POINT_CAPACITY',
        );
      const active = await client.query<{ total: string }>(
        `select count(*)::text total from shipments
         where loading_point_id=$1 and loading_status in ('AT_GATE','LOADING')`,
        [pointId],
      );
      const activeTrucks = Number(active.rows[0]?.total ?? 0);
      if (activeTrucks >= selected.max_trucks) {
        throw new AppError(
          'Selected loading point has reached its maximum truck capacity.',
          409,
          'LOADING_POINT_TRUCK_CAPACITY',
        );
      }
      await client.query(
        'update shipments set loading_point_id=$2,loading_point_type=$3,updated_at=now() where id=$1',
        [id, pointId, selected.point_type],
      );
      await client.query(`update hader_loading_points set status=$2,updated_at=now() where id=$1`, [
        pointId,
        activeTrucks + 1 >= selected.max_trucks ? 'BUSY' : 'AVAILABLE',
      ]);
      await event(client, id, 'LOADING_POINT_ASSIGNED', 'AT_GATE', 'AT_GATE', actor.id, {
        loadingPointId: pointId,
      });
    });
  }

  async start(id: string, actor: SalesUser) {
    return this.change(id, actor, async (client, row) => {
      if (row.loading_status !== 'AT_GATE') invalid('Only a truck at gate can start loading.');
      if (
        !row.loading_point_id ||
        !row.transporter_id ||
        !row.hader_truck_id ||
        !row.hader_driver_id ||
        !row.scheduled_date
      )
        throw new AppError(
          'Assignment, schedule and loading point are required.',
          400,
          'LOADING_REQUIREMENTS_MISSING',
        );
      const resources = await client.query<{
        transporter_active: boolean;
        truck_operational: boolean;
        driver_active: boolean;
      }>(
        `select
           exists(select 1 from transporters where id=$1 and status='ACTIVE') transporter_active,
           exists(select 1 from hader_trucks where id=$2 and status in ('AVAILABLE','ASSIGNED')) truck_operational,
           exists(select 1 from hader_drivers where id=$3 and status='ACTIVE'
             and (license_expiry is null or license_expiry >= current_date)) driver_active`,
        [row.transporter_id, row.hader_truck_id, row.hader_driver_id],
      );
      const assigned = resources.rows[0];
      if (!assigned?.transporter_active || !assigned.truck_operational || !assigned.driver_active)
        throw new AppError(
          'The assigned transporter, truck or driver is no longer available for loading.',
          400,
          'LOADING_RESOURCE_INACTIVE',
        );
      await client.query(
        `update shipments set loading_status='LOADING',loading_started_at=now(),
         loading_started_by_sales_user_id=$2,updated_at=now() where id=$1`,
        [id, actor.id],
      );
      await event(client, id, 'LOADING_STARTED', 'AT_GATE', 'LOADING', actor.id, {
        loadingPointId: row.loading_point_id,
      });
    });
  }

  async complete(id: string, actor: SalesUser) {
    return this.change(id, actor, async (client, row) => {
      if (row.loading_status !== 'LOADING') invalid('Only a loading shipment can be completed.');
      await client.query(
        `update shipments set loading_status='LOADED',loading_completed_at=now(),
         loading_completed_by_sales_user_id=$2,updated_at=now() where id=$1`,
        [id, actor.id],
      );
      if (row.loading_point_id)
        await client.query(
          `update hader_loading_points points
           set status=case
             when points.status='INACTIVE' then 'INACTIVE'
             when (select count(*) from shipments active_shipments
                   where active_shipments.loading_point_id=points.id
                     and active_shipments.loading_status in ('AT_GATE','LOADING')) >= points.max_trucks
               then 'BUSY'
             else 'AVAILABLE'
           end,updated_at=now()
           where points.id=$1`,
          [row.loading_point_id],
        );
      await event(client, id, 'LOADING_COMPLETED', 'LOADING', 'LOADED', actor.id, {
        loadingPointId: row.loading_point_id,
      });
    });
  }

  private async change(
    id: string,
    actor: SalesUser,
    work: (client: PoolClient, row: LockedRow) => Promise<void>,
  ) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query<LockedRow>(
        `select s.*,oi.product_id,oi.packaging from shipments s
         join order_items oi on oi.order_id=s.order_id where s.id=$1 for update of s`,
        [id],
      );
      const row = result.rows[0];
      if (!row) throw new AppError('Shipment was not found.', 404, 'SHIPMENT_NOT_FOUND');
      if (row.status !== 'ASSIGNED') invalid('Shipment is not eligible for loading control.');
      await work(client, row);
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
export const haderLoadingService = new HaderLoadingService();

interface LockedRow {
  status: string;
  loading_status: LoadingStatus | null;
  quantity_ton: string;
  product_id: string;
  packaging: string;
  loading_point_id: string | null;
  transporter_id: string | null;
  hader_truck_id: string | null;
  hader_driver_id: string | null;
  scheduled_date: Date | string | null;
  arrived_at: Date | string | null;
}
interface LoadingRow extends LockedRow {
  id: string;
  shipment_number: string;
  order_number: string;
  company_name: string;
  product_code: string;
  product_name: string;
  truck_plate: string | null;
  driver_name: string | null;
  queue_position: number | null;
  notified_at: Date | string | null;
  at_gate_at: Date | string | null;
  loading_started_at: Date | string | null;
  loading_completed_at: Date | string | null;
  loading_point_name: string | null;
  loading_point_type: string | null;
}
interface LoadingPointRow {
  id: string;
  code: string;
  name: string;
  point_type: string;
  capacity_ton: string | null;
  capacity_ton_per_hour: string | null;
  max_trucks: number;
  status: string;
}
const loadingSelect = `select s.*,o.order_number,ca.company_name,oi.product_id,oi.product_code,oi.product_name,
 oi.packaging,ht.plate_number truck_plate,hd.name driver_name,lp.name loading_point_name
 from shipments s join orders o on o.id=s.order_id join customer_accounts ca on ca.id=s.customer_account_id
 join lateral (select * from order_items where order_id=o.id order by created_at limit 1) oi on true
 left join hader_trucks ht on ht.id=s.hader_truck_id left join hader_drivers hd on hd.id=s.hader_driver_id
 left join hader_loading_points lp on lp.id=s.loading_point_id`;
function mapLoading(row: LoadingRow) {
  return {
    id: row.id,
    shipmentNumber: row.shipment_number,
    orderNumber: row.order_number,
    customer: row.company_name,
    product: {
      id: row.product_id,
      code: row.product_code,
      name: row.product_name,
      packaging: row.packaging,
    },
    quantityTon: Number(row.quantity_ton),
    truck: row.truck_plate,
    driver: row.driver_name,
    loadingStatus: row.loading_status,
    queuePosition: row.queue_position,
    loadingPoint: row.loading_point_id
      ? { id: row.loading_point_id, name: row.loading_point_name, type: row.loading_point_type }
      : null,
    notifiedAt: iso(row.notified_at),
    arrivedAt: iso(row.arrived_at),
    atGateAt: iso(row.at_gate_at),
    loadingStartedAt: iso(row.loading_started_at),
    loadingCompletedAt: iso(row.loading_completed_at),
  };
}
async function event(
  client: PoolClient,
  id: string,
  type: string,
  previous: string | null,
  next: string,
  actor: string,
  data: object,
) {
  await client.query(
    `insert into shipment_events (shipment_id,event_type,previous_status,new_status,changed_by_sales_user_id,event_data)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    [id, type, previous, next, actor, JSON.stringify(data)],
  );
}
function invalid(message: string): never {
  throw new AppError(message, 409, 'LOADING_TRANSITION_INVALID');
}
function iso(value: Date | string | null) {
  return value ? new Date(String(value)).toISOString() : null;
}
function driverNotificationMessage(shipment: Record<string, unknown>) {
  const point = objectValue(shipment.loadingPoint, 'name') ?? 'to be assigned at the gate';
  const scheduledDate = String(shipment.scheduledDate ?? 'not scheduled');
  const scheduledTime = shipment.scheduledTime ? ` at ${String(shipment.scheduledTime)}` : '';
  return `${String(shipment.shipmentNumber)}: report to the plant gate for loading on ${scheduledDate}${scheduledTime}. Loading point: ${point}. Follow gate check-in instructions on arrival.`;
}
function objectValue(value: unknown, key: string) {
  return value && typeof value === 'object' && key in value
    ? String((value as Record<string, unknown>)[key] ?? '') || null
    : null;
}
