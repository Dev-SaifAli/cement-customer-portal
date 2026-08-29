import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { GeoJsonPolygon, HaderCityBoundary, HaderZoneStatus } from './hader-zone.types.js';
import { geoJsonPolygonSchema } from './hader-zone.validation.js';

type QueryExecutor = Pick<PoolClient, 'query'>;

interface CityBoundaryRow {
  id: string;
  name: string;
  is_hader_enabled: boolean;
  is_active: boolean;
  delivery_boundary: unknown;
  boundary_updated_at: Date | string | null;
  boundary_updated_by: string | null;
}

export class HaderZoneService {
  async listCities(): Promise<HaderCityBoundary[]> {
    const result = await pool.query<CityBoundaryRow>(
      `select cities.id,cities.name,cities.is_hader_enabled,cities.is_active,
              cities.delivery_boundary,cities.boundary_updated_at,
              users.name as boundary_updated_by
       from ksa_cities cities
       left join sales_users users on users.id=cities.boundary_updated_by_sales_user_id
       order by cities.name`,
    );
    return result.rows.map(mapCity);
  }

  async getCity(cityId: string, executor: QueryExecutor = pool): Promise<HaderCityBoundary> {
    const result = await executor.query<CityBoundaryRow>(
      `select cities.id,cities.name,cities.is_hader_enabled,cities.is_active,
              cities.delivery_boundary,cities.boundary_updated_at,
              users.name as boundary_updated_by
       from ksa_cities cities
       left join sales_users users on users.id=cities.boundary_updated_by_sales_user_id
       where cities.id=$1 limit 1`,
      [cityId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('Hader city was not found.', 404, 'HADER_CITY_NOT_FOUND');
    return mapCity(row);
  }

  async saveBoundary(cityId: string, boundary: GeoJsonPolygon, user: SalesUser) {
    const parsed = geoJsonPolygonSchema.parse(boundary);
    const result = await pool.query<{ id: string }>(
      `update ksa_cities
       set delivery_boundary=$2::jsonb,boundary_updated_at=now(),
           boundary_updated_by_sales_user_id=$3,updated_at=now()
       where id=$1 and is_active=true
       returning id`,
      [cityId, JSON.stringify(parsed), user.id],
    );
    if (!result.rows[0])
      throw new AppError('Hader city was not found.', 404, 'HADER_CITY_NOT_FOUND');
    return this.getCity(cityId);
  }

  async clearBoundary(cityId: string, user: SalesUser) {
    const result = await pool.query<{ id: string }>(
      `update ksa_cities
       set delivery_boundary=null,boundary_updated_at=now(),
           boundary_updated_by_sales_user_id=$2,updated_at=now()
       where id=$1 and is_active=true returning id`,
      [cityId, user.id],
    );
    if (!result.rows[0])
      throw new AppError('Hader city was not found.', 404, 'HADER_CITY_NOT_FOUND');
    return this.getCity(cityId);
  }

  async validatePoint(
    cityId: string,
    point: { latitude: number; longitude: number },
    executor: QueryExecutor = pool,
  ) {
    const city = await this.getCity(cityId, executor);
    if (!city.boundary) {
      throw new AppError(
        'Delivery boundary is not configured for the selected Hader city.',
        409,
        'HADER_BOUNDARY_NOT_CONFIGURED',
      );
    }
    const status: HaderZoneStatus = pointInPolygon(point, city.boundary)
      ? 'WITHIN_HADER_ZONE'
      : 'OUTSIDE_HADER_ZONE';
    return { city: { id: city.id, name: city.name }, status };
  }
}

export const haderZoneService = new HaderZoneService();

export function pointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: GeoJsonPolygon,
) {
  const ring = polygon.coordinates[0] ?? [];
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (!currentPoint || !previousPoint) continue;
    const x = currentPoint[0];
    const y = currentPoint[1];
    const previousX = previousPoint[0];
    const previousY = previousPoint[1];
    if (x === undefined || y === undefined || previousX === undefined || previousY === undefined) {
      continue;
    }
    if (pointOnSegment(point.longitude, point.latitude, x, y, previousX, previousY)) return true;
    const intersects =
      y > point.latitude !== previousY > point.latitude &&
      point.longitude < ((previousX - x) * (point.latitude - y)) / (previousY - y) + x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay);
  if (Math.abs(cross) > 1e-10) return false;
  return (
    px >= Math.min(ax, bx) - 1e-10 &&
    px <= Math.max(ax, bx) + 1e-10 &&
    py >= Math.min(ay, by) - 1e-10 &&
    py <= Math.max(ay, by) + 1e-10
  );
}

function mapCity(row: CityBoundaryRow): HaderCityBoundary {
  const boundary = row.delivery_boundary
    ? geoJsonPolygonSchema.safeParse(row.delivery_boundary)
    : null;
  const parsedBoundary = boundary?.success ? boundary.data : null;
  return {
    id: row.id,
    name: row.name,
    isHaderEnabled: row.is_hader_enabled,
    isActive: row.is_active,
    boundary: parsedBoundary,
    boundaryStatus: parsedBoundary ? 'CONFIGURED' : 'NOT_CONFIGURED',
    boundaryUpdatedAt: row.boundary_updated_at
      ? new Date(row.boundary_updated_at).toISOString()
      : null,
    boundaryUpdatedBy: row.boundary_updated_by,
  };
}
