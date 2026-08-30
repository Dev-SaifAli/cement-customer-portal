import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { PickupLocationInput, PickupLocationList } from './pickup-locations.validation.js';

interface Row {
  id: string; location_number: string; name: string; city_id: string; city_name: string;
  region_name: string | null; address: string; postal_code: string | null;
  latitude: string | null; longitude: string | null; status: 'ACTIVE' | 'INACTIVE';
  updated_by: string | null; created_at: Date | string; updated_at: Date | string;
}
const pageSize = 10;

export class PickupLocationsService {
  async list(query: PickupLocationList) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (query.search) { values.push(`%${query.search}%`); conditions.push(`(p.location_number ilike $${values.length} or p.name ilike $${values.length} or c.name ilike $${values.length} or p.address ilike $${values.length})`); }
    if (query.status) { values.push(query.status); conditions.push(`p.status=$${values.length}`); }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const count = await pool.query<{ total: string }>(`select count(*)::text total from pickup_locations p join ksa_cities c on c.id=p.city_id ${where}`, values);
    const listValues = [...values, pageSize, (query.page - 1) * pageSize];
    const result = await pool.query<Row>(`${selectSql} ${where} order by p.updated_at desc limit $${listValues.length - 1} offset $${listValues.length}`, listValues);
    const total = Number(count.rows[0]?.total ?? 0);
    return { items: result.rows.map(mapRow), pagination: { page: query.page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  async listActive() {
    const result = await pool.query<Row>(`${selectSql} where p.status='ACTIVE' and c.is_active=true order by c.name,p.name`);
    return result.rows.map(mapRow);
  }

  async get(id: string) {
    const result = await pool.query<Row>(`${selectSql} where p.id=$1 limit 1`, [id]);
    if (!result.rows[0]) throw new AppError('Pickup location was not found.', 404, 'PICKUP_LOCATION_NOT_FOUND');
    return mapRow(result.rows[0]);
  }

  async create(input: PickupLocationInput, user: SalesUser) {
    await this.assertCity(input.cityId);
    const result = await pool.query<{ id: string }>(`insert into pickup_locations(location_number,name,city_id,address,postal_code,latitude,longitude,status,created_by_sales_user_id,updated_by_sales_user_id)
      values('PUL-' || lpad(nextval('pickup_location_number_seq')::text,6,'0'),$1,$2,$3,$4,$5,$6,$7,$8,$8) returning id`,
      [input.name,input.cityId,input.address,input.postalCode || null,input.latitude ?? null,input.longitude ?? null,input.status,user.id]);
    const location = await this.get(result.rows[0]!.id);
    await recordEvent(location.id, 'PICKUP_LOCATION_CREATED', user.id, null, location);
    return location;
  }

  async update(id: string, input: PickupLocationInput, user: SalesUser) {
    const previous = await this.get(id);
    await this.assertCity(input.cityId);
    const result = await pool.query<{ id: string }>(`update pickup_locations set name=$2,city_id=$3,address=$4,postal_code=$5,latitude=$6,longitude=$7,status=$8,updated_by_sales_user_id=$9,updated_at=now() where id=$1 returning id`,
      [id,input.name,input.cityId,input.address,input.postalCode || null,input.latitude ?? null,input.longitude ?? null,input.status,user.id]);
    if (!result.rows[0]) throw new AppError('Pickup location was not found.', 404, 'PICKUP_LOCATION_NOT_FOUND');
    const location = await this.get(id);
    await recordEvent(id, 'PICKUP_LOCATION_UPDATED', user.id, previous, location);
    return location;
  }

  private async assertCity(cityId: string) {
    const result = await pool.query(`select 1 from ksa_cities where id=$1 and is_active=true`, [cityId]);
    if (!result.rows[0]) throw new AppError('Selected city is unavailable.', 400, 'CITY_UNAVAILABLE');
  }
}

const selectSql = `select p.*,c.name city_name,null::text region_name,u.name updated_by from pickup_locations p join ksa_cities c on c.id=p.city_id left join sales_users u on u.id=p.updated_by_sales_user_id`;
function mapRow(row: Row) { return { id: row.id, locationNumber: row.location_number, name: row.name, cityId: row.city_id, city: row.city_name, region: row.region_name ?? '', address: row.address, postalCode: row.postal_code, latitude: row.latitude == null ? null : Number(row.latitude), longitude: row.longitude == null ? null : Number(row.longitude), status: row.status, updatedBy: row.updated_by, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() }; }
async function recordEvent(entityId:string,eventType:string,userId:string,oldValue:unknown,newValue:unknown) { await pool.query(`insert into internal_logistics_events(entity_type,entity_id,event_type,changed_by_sales_user_id,old_value,new_value) values('PICKUP_LOCATION',$1,$2,$3,$4::jsonb,$5::jsonb)`,[entityId,eventType,userId,oldValue?JSON.stringify(oldValue):null,newValue?JSON.stringify(newValue):null]); }
export const pickupLocationsService = new PickupLocationsService();
