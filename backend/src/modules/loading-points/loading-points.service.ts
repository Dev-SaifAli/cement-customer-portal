import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { LoadingPointInput, LoadingPointListQuery } from './loading-points.validation.js';

const PAGE_SIZE = 10;
type Executor = Pick<PoolClient, 'query'>;

interface LoadingPointRow extends QueryResultRow {
  id: string;
  code: string;
  name: string;
  point_type: 'SILO' | 'BAGGING_LINE';
  product_id: string | null;
  product_code: string | null;
  product_name: string | null;
  packaging_type: string | null;
  uom: string | null;
  capacity_ton: string | null;
  capacity_ton_per_hour: string | null;
  max_trucks: number;
  status: 'AVAILABLE' | 'BUSY' | 'FULL' | 'INACTIVE';
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: string;
}

interface ProductRow extends QueryResultRow {
  id: string;
  product_code: string;
  product_name: string;
  packaging_type: string;
  uom: string;
}

export class LoadingPointsService {
  async list(query: LoadingPointListQuery) {
    const values: unknown[] = [];
    const clauses: string[] = [];
    if (query.search) {
      values.push(query.search);
      clauses.push(
        `(points.code ilike '%'||$${values.length}||'%' or products.product_code ilike '%'||$${values.length}||'%' or products.product_name ilike '%'||$${values.length}||'%')`,
      );
    }
    if (query.pointType) {
      values.push(query.pointType);
      clauses.push(`points.point_type=$${values.length}`);
    }
    if (query.status) {
      values.push(query.status);
      clauses.push(`points.status=$${values.length}`);
    }
    const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const offset = (query.page - 1) * PAGE_SIZE;
    const [points, products] = await Promise.all([
      pool.query<LoadingPointRow>(
        `${pointSelect},count(*) over()::text total_count
         from hader_loading_points points
         left join product_catalog products on products.id=points.product_id
         ${where}
         order by points.point_type,points.code
         limit $${values.length + 1} offset $${values.length + 2}`,
        [...values, PAGE_SIZE, offset],
      ),
      this.products(),
    ]);
    const total = Number(points.rows[0]?.total_count ?? 0);
    return {
      items: points.rows.map(mapPoint),
      products,
      pagination: {
        page: query.page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    };
  }

  async create(input: LoadingPointInput, actor: SalesUser) {
    validateOperationalConfiguration(input);
    await this.validateProduct(input.pointType, input.productId);
    try {
      const result = await pool.query<LoadingPointRow>(
        `insert into hader_loading_points
         (code,name,point_type,product_id,capacity_ton,capacity_ton_per_hour,max_trucks,
          status,created_by_sales_user_id)
         select generated.code,generated.code,$1,$2,$3,$4,$5,$6,$7
         from (
           select case
             when $1='SILO' then 'SILO-' || lpad(nextval('hader_silo_number_seq')::text, 6, '0')
             else 'BL-' || lpad(nextval('hader_bagging_line_number_seq')::text, 6, '0')
           end as code
         ) generated
         returning *,null::text product_code,null::text product_name,null::text packaging_type`,
        [
          input.pointType,
          input.productId,
          input.pointType === 'SILO' ? input.capacityTon : null,
          input.pointType === 'BAGGING_LINE' ? input.capacityTonPerHour : null,
          input.pointType === 'BAGGING_LINE' ? input.maxTrucks : 1,
          input.status,
          actor.id,
        ],
      );
      const created = result.rows[0];
      if (!created) throw new AppError('Loading point could not be created.', 503, 'CREATE_FAILED');
      await audit(created.id, 'LOADING_POINT_CREATED', actor.id, null, input);
      return this.get(created.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          'A loading point with this ID already exists.',
          409,
          'LOADING_POINT_DUPLICATE',
        );
      }
      throw error;
    }
  }

  async update(id: string, input: Partial<LoadingPointInput>, actor: SalesUser) {
    const current = await this.get(id);
    const pointType = input.pointType ?? current.pointType;
    const productId = input.productId ?? current.product?.id;
    if (!productId) {
      throw new AppError(
        'Product is required for this loading point.',
        400,
        'LOADING_POINT_PRODUCT_REQUIRED',
      );
    }
    validateOperationalConfiguration({
      pointType,
      capacityTon: input.capacityTon ?? current.capacityTon,
      capacityTonPerHour: input.capacityTonPerHour ?? current.capacityTonPerHour,
      maxTrucks: input.maxTrucks ?? current.maxTrucks,
    });
    await this.validateProduct(pointType, productId);
    const fields: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      values.push(value);
      fields.push(`${column}=$${values.length}`);
    };
    if (input.pointType !== undefined) set('point_type', input.pointType);
    if (input.productId !== undefined) set('product_id', input.productId);
    if (input.capacityTon !== undefined) set('capacity_ton', input.capacityTon);
    if (input.capacityTonPerHour !== undefined) {
      set('capacity_ton_per_hour', input.capacityTonPerHour);
    }
    if (input.maxTrucks !== undefined) set('max_trucks', input.maxTrucks);
    if (input.status !== undefined) set('status', input.status);
    if (!fields.length) return current;
    values.push(id);
    try {
      const result = await pool.query<{ id: string }>(
        `update hader_loading_points set ${fields.join(',')},updated_at=now()
         where id=$${values.length} returning id`,
        values,
      );
      if (!result.rows[0]) notFound();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          'A loading point with this ID already exists.',
          409,
          'LOADING_POINT_DUPLICATE',
        );
      }
      throw error;
    }
    const updated = await this.get(id);
    const events = ['LOADING_POINT_UPDATED'];
    if (current.product?.id !== updated.product?.id) events.push('LOADING_POINT_PRODUCT_CHANGED');
    if (current.status !== 'INACTIVE' && updated.status === 'INACTIVE') {
      events.push('LOADING_POINT_DEACTIVATED');
    }
    for (const eventType of events) {
      await audit(id, eventType, actor.id, current, updated);
    }
    return updated;
  }

  async get(id: string) {
    const result = await pool.query<LoadingPointRow>(
      `${pointSelect}
       from hader_loading_points points
       left join product_catalog products on products.id=points.product_id
       where points.id=$1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) notFound();
    return mapPoint(row);
  }

  async availableForShipment(shipmentId: string, executor: Executor = pool) {
    const shipment = await executor.query<{
      product_id: string;
      packaging: string;
      quantity_ton: string;
    }>(
      `select items.product_id,items.packaging,shipments.quantity_ton
       from shipments
       join lateral (
         select product_id,packaging from order_items where order_id=shipments.order_id
         order by created_at limit 1
       ) items on true
       where shipments.id=$1`,
      [shipmentId],
    );
    const row = shipment.rows[0];
    if (!row) throw new AppError('Shipment was not found.', 404, 'SHIPMENT_NOT_FOUND');
    const expectedType = pointTypeForPackaging(row.packaging);
    const result = await executor.query<LoadingPointRow>(
      `${pointSelect}
       from hader_loading_points points
       join product_catalog products on products.id=points.product_id
       where points.point_type=$1 and points.product_id=$2
         and products.is_active=true
         and points.status in ('AVAILABLE','BUSY')
         and (points.point_type='BAGGING_LINE' or points.capacity_ton >= $3)
         and (
           select count(*) from shipments active_shipments
           where active_shipments.loading_point_id=points.id
             and active_shipments.loading_status in ('AT_GATE','LOADING')
         ) < points.max_trucks
       order by points.code`,
      [expectedType, row.product_id, Number(row.quantity_ton)],
    );
    return result.rows.map(mapPoint);
  }

  async products() {
    const result = await pool.query<ProductRow>(
      `select id,product_code,product_name,packaging_type,uom
       from product_catalog where is_active=true
         and lower(packaging_type) in ('bulk','bag')
       order by product_name,product_code`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      code: row.product_code,
      name: row.product_name,
      packagingType: row.packaging_type,
      uom: row.uom,
      compatiblePointType: pointTypeForPackaging(row.packaging_type),
    }));
  }

  private async validateProduct(pointType: string, productId: string) {
    const result = await pool.query<ProductRow>(
      `select id,product_code,product_name,packaging_type,uom
       from product_catalog where id=$1 and is_active=true`,
      [productId],
    );
    const product = result.rows[0];
    if (!product) {
      throw new AppError('Active product was not found.', 400, 'LOADING_POINT_PRODUCT_INVALID');
    }
    if (pointTypeForPackaging(product.packaging_type) !== pointType) {
      throw new AppError(
        pointType === 'SILO'
          ? 'Only bulk products can be assigned to a silo.'
          : 'Only bag products can be assigned to a bagging line.',
        400,
        'LOADING_POINT_PRODUCT_INCOMPATIBLE',
      );
    }
  }
}

export const loadingPointsService = new LoadingPointsService();

export function pointTypeForPackaging(packaging: string): 'SILO' | 'BAGGING_LINE' {
  const normalized = packaging.trim().toLowerCase();
  if (normalized === 'bulk') return 'SILO';
  if (normalized === 'bag') return 'BAGGING_LINE';
  throw new AppError(
    'Product packaging is not compatible with a loading point.',
    400,
    'LOADING_POINT_PACKAGING_UNSUPPORTED',
  );
}

const pointSelect = `select points.id,points.code,points.name,points.point_type,points.product_id,
 products.product_code,products.product_name,products.packaging_type,products.uom,
 points.capacity_ton,points.capacity_ton_per_hour,points.max_trucks,
 points.status,points.created_at,points.updated_at`;

function mapPoint(row: LoadingPointRow) {
  return {
    id: row.id,
    pointNumber: row.code,
    pointType: row.point_type,
    code: row.code,
    name: row.name,
    type: row.point_type,
    product:
      row.product_id && row.product_code && row.product_name && row.packaging_type
        ? {
            id: row.product_id,
            code: row.product_code,
            name: row.product_name,
            packagingType: row.packaging_type,
            uom: row.uom ?? undefined,
          }
        : null,
    capacityTon: row.capacity_ton ? Number(row.capacity_ton) : 0,
    capacityTonPerHour: row.capacity_ton_per_hour
      ? Number(row.capacity_ton_per_hour)
      : row.point_type === 'BAGGING_LINE' && row.capacity_ton
        ? Number(row.capacity_ton)
        : null,
    maxTrucks: Number(row.max_trucks ?? 1),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function audit(
  id: string,
  eventType: string,
  actorId: string,
  oldValue: unknown,
  newValue: unknown,
) {
  await pool.query(
    `insert into internal_logistics_events
     (entity_type,entity_id,event_type,changed_by_sales_user_id,old_value,new_value)
     values ('LOADING_POINT',$1,$2,$3,$4::jsonb,$5::jsonb)`,
    [id, eventType, actorId, json(oldValue), json(newValue)],
  );
}

function json(value: unknown) {
  return value === null ? null : JSON.stringify(value);
}

function notFound(): never {
  throw new AppError('Loading point was not found.', 404, 'LOADING_POINT_NOT_FOUND');
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}

function validateOperationalConfiguration(input: {
  pointType: 'SILO' | 'BAGGING_LINE';
  capacityTon?: number | null | undefined;
  capacityTonPerHour?: number | null | undefined;
  maxTrucks?: number | null | undefined;
}) {
  if (input.pointType === 'SILO' && (!input.capacityTon || input.capacityTon <= 0)) {
    throw new AppError(
      'Silo capacity must be greater than zero.',
      400,
      'LOADING_POINT_CAPACITY_INVALID',
    );
  }
  if (
    input.pointType === 'BAGGING_LINE' &&
    (!input.capacityTonPerHour || input.capacityTonPerHour <= 0)
  ) {
    throw new AppError(
      'Bagging Line capacity must be greater than zero.',
      400,
      'BAGGING_LINE_CAPACITY_INVALID',
    );
  }
  if (
    input.pointType === 'BAGGING_LINE' &&
    (!input.maxTrucks || !Number.isInteger(input.maxTrucks) || input.maxTrucks < 1)
  ) {
    throw new AppError(
      'Maximum Trucks must be at least one.',
      400,
      'BAGGING_LINE_MAX_TRUCKS_INVALID',
    );
  }
}
