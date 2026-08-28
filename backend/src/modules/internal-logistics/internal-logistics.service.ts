import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import { documentStorageService } from '../registration-documents/document-storage.service.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type {
  HaderDriverInput,
  HaderTruckInput,
  LogisticsList,
  TransporterCostInput,
  TransporterInput,
} from './internal-logistics.validation.js';

const PAGE_SIZE = 10;
type Entity = 'TRANSPORTER' | 'TRUCK' | 'DRIVER';
type LogisticsRow = QueryResultRow & {
  id: string;
  status?: string;
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: string;
  [key: string]: unknown;
};
type AttachmentRow = QueryResultRow & {
  id: string;
  document_type: string;
  original_file_name: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
  created_at: Date | string;
};

export class InternalLogisticsService {
  listTransporters(query: LogisticsList) {
    return this.list(
      `select t.*, t.updated_at sort_updated_at, count(*) over()::text total_count from transporters t
       where ($1::text is null or t.status=$1) and ($2::text is null or
       t.transporter_number ilike '%'||$2||'%' or t.name ilike '%'||$2||'%' or
       t.company_name ilike '%'||$2||'%' or t.contact_person ilike '%'||$2||'%')`,
      query,
      mapTransporter,
    );
  }

  createTransporter(input: TransporterInput, user: SalesUser) {
    return this.createEntity(
      'TRANSPORTER',
      user,
      `insert into transporters (transporter_number,name,company_name,contact_person,phone,email,
       cr_number,status,created_by_sales_user_id) values
       ('TRN-'||lpad(nextval('transporter_number_seq')::text,6,'0'),$1,$2,$3,$4,lower($5),$6,$7,$8) returning *`,
      [
        input.name,
        input.companyName,
        input.contactPerson ?? null,
        normalizePhone(input.phone),
        input.email ?? null,
        input.crNumber ?? null,
        input.status,
        user.id,
      ],
      'TRANSPORTER_CREATED',
      mapTransporter,
      'A transporter with this name and company already exists.',
    );
  }

  updateTransporter(id: string, input: Partial<TransporterInput>, user: SalesUser) {
    return this.updateEntity(
      'TRANSPORTER',
      'transporters',
      id,
      input,
      user,
      {
        name: 'name',
        companyName: 'company_name',
        contactPerson: 'contact_person',
        phone: 'phone',
        email: 'email',
        crNumber: 'cr_number',
        status: 'status',
      },
      mapTransporter,
      (before, after) =>
        before.status !== 'INACTIVE' && after.status === 'INACTIVE'
          ? 'TRANSPORTER_DEACTIVATED'
          : 'TRANSPORTER_UPDATED',
    );
  }

  async listCosts(query: LogisticsList) {
    return this.list(
      `select c.*,c.updated_at sort_updated_at,t.transporter_number,t.company_name,city.name city_name,
       creator.name created_by_name,u.name updated_by_name,count(*) over()::text total_count
       from transporter_costs c join transporters t on t.id=c.transporter_id
       join ksa_cities city on city.id=c.hader_city_id join sales_users u on u.id=c.updated_by_sales_user_id
       join sales_users creator on creator.id=c.created_by_sales_user_id
       where ($1::text is null or true) and ($2::text is null or t.company_name ilike '%'||$2||'%'
       or city.name ilike '%'||$2||'%' or c.cement_type ilike '%'||$2||'%')`,
      { ...query, status: undefined },
      mapCost,
    );
  }

  async createCost(input: TransporterCostInput, user: SalesUser) {
    await this.validateCostReferences(input.transporterId, input.haderCityId);
    return this.createEntity(
      'TRANSPORTER_COST',
      user,
      `insert into transporter_costs (transporter_id,hader_city_id,cement_type,cost_per_ton,
       created_by_sales_user_id,updated_by_sales_user_id)
       values ($1,$2,$3,$4,$5,$5) returning *`,
      [input.transporterId, input.haderCityId, input.cementType, input.costPerTon, user.id],
      'TRANSPORTER_COST_CREATED',
      mapCost,
      'A cost for this transporter, city, and cement type already exists.',
    );
  }

  async updateCost(id: string, input: Partial<TransporterCostInput>, user: SalesUser) {
    const current = requireFound(
      (
        await pool.query<{ transporter_id: string; hader_city_id: string }>(
          'select transporter_id,hader_city_id from transporter_costs where id=$1',
          [id],
        )
      ).rows[0],
    );
    await this.validateCostReferences(
      current.transporter_id,
      input.haderCityId ?? current.hader_city_id,
    );
    return this.updateEntity(
      'TRANSPORTER_COST',
      'transporter_costs',
      id,
      { ...input, updatedBySalesUserId: user.id },
      user,
      {
        haderCityId: 'hader_city_id',
        cementType: 'cement_type',
        costPerTon: 'cost_per_ton',
        updatedBySalesUserId: 'updated_by_sales_user_id',
      },
      mapCost,
      'TRANSPORTER_COST_UPDATED',
    );
  }

  listTrucks(query: LogisticsList) {
    return this.list(
      `select t.*,t.updated_at sort_updated_at,d.name assigned_driver_name,count(*) over()::text total_count from hader_trucks t
       left join hader_drivers d on d.id=t.assigned_driver_id where ($1::text is null or t.status=$1)
       and ($2::text is null or t.truck_number ilike '%'||$2||'%' or t.plate_number ilike '%'||$2||'%'
       or t.vehicle_type ilike '%'||$2||'%' or d.name ilike '%'||$2||'%')`,
      query,
      mapTruck,
    );
  }

  createTruck(input: HaderTruckInput, user: SalesUser) {
    return this.createEntity(
      'TRUCK',
      user,
      `insert into hader_trucks (truck_number,plate_number,vehicle_type,capacity_ton,model_year,
       assigned_driver_id,status,created_by_sales_user_id) values
       ('TRK-'||lpad(nextval('hader_truck_number_seq')::text,6,'0'),upper($1),$2,$3,$4,$5,$6,$7) returning *`,
      [
        input.plateNumber,
        input.vehicleType,
        input.capacityTon,
        input.modelYear ?? null,
        input.assignedDriverId ?? null,
        input.status,
        user.id,
      ],
      'TRUCK_CREATED',
      mapTruck,
      'A truck with this plate number already exists.',
    );
  }

  updateTruck(id: string, input: Partial<HaderTruckInput>, user: SalesUser) {
    return this.updateEntity(
      'TRUCK',
      'hader_trucks',
      id,
      input,
      user,
      {
        plateNumber: 'plate_number',
        vehicleType: 'vehicle_type',
        capacityTon: 'capacity_ton',
        modelYear: 'model_year',
        assignedDriverId: 'assigned_driver_id',
        status: 'status',
      },
      mapTruck,
      'TRUCK_UPDATED',
    );
  }

  listDrivers(query: LogisticsList) {
    return this.list(
      `select d.*,d.updated_at sort_updated_at,count(*) over()::text total_count from hader_drivers d
      where ($1::text is null or d.status=$1) and ($2::text is null or d.driver_number ilike '%'||$2||'%'
      or d.name ilike '%'||$2||'%' or d.mobile ilike '%'||$2||'%' or d.license_number ilike '%'||$2||'%')`,
      query,
      mapDriver,
    );
  }

  createDriver(input: HaderDriverInput, user: SalesUser) {
    return this.createEntity(
      'DRIVER',
      user,
      `insert into hader_drivers (driver_number,name,mobile,license_number,license_expiry,status,created_by_sales_user_id)
       values ('DRV-'||lpad(nextval('hader_driver_number_seq')::text,6,'0'),$1,$2,upper($3),$4,$5,$6) returning *`,
      [
        input.name,
        normalizePhone(input.mobile),
        input.licenseNumber,
        input.licenseExpiry ?? null,
        input.status,
        user.id,
      ],
      'DRIVER_CREATED',
      mapDriver,
      'A driver with this license number already exists.',
    );
  }

  updateDriver(id: string, input: Partial<HaderDriverInput>, user: SalesUser) {
    return this.updateEntity(
      'DRIVER',
      'hader_drivers',
      id,
      input,
      user,
      {
        name: 'name',
        mobile: 'mobile',
        licenseNumber: 'license_number',
        licenseExpiry: 'license_expiry',
        status: 'status',
      },
      mapDriver,
      'DRIVER_UPDATED',
    );
  }

  async referenceData() {
    const [transporters, cities, drivers] = await Promise.all([
      pool.query(
        `select id,transporter_number,company_name from transporters where status='ACTIVE' order by company_name`,
      ),
      pool.query(
        `select id,name from ksa_cities where is_active=true and is_hader_enabled=true order by name`,
      ),
      pool.query(
        `select id,driver_number,name from hader_drivers where status='ACTIVE' order by name`,
      ),
    ]);
    return { transporters: transporters.rows, cities: cities.rows, drivers: drivers.rows };
  }

  async uploadAttachment(
    entityType: Entity,
    entityId: string,
    documentType: string,
    fileName: string,
    mimeType: string | undefined,
    buffer: Buffer,
    user: SalesUser,
  ) {
    await this.ensureEntity(entityType, entityId);
    const stored = await documentStorageService.saveInternalLogisticsDocument({
      entityType:
        entityType === 'TRANSPORTER'
          ? 'transporters'
          : entityType === 'TRUCK'
            ? 'trucks'
            : 'drivers',
      entityId,
      documentType,
      fileName,
      mimeType,
      buffer,
    });
    const result = await pool.query<AttachmentRow>(
      `insert into internal_logistics_attachments
      (entity_type,entity_id,document_type,original_file_name,storage_key,mime_type,file_size,uploaded_by_sales_user_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict(entity_type,entity_id,document_type) do update set
      original_file_name=excluded.original_file_name,storage_key=excluded.storage_key,mime_type=excluded.mime_type,
      file_size=excluded.file_size,uploaded_by_sales_user_id=excluded.uploaded_by_sales_user_id,created_at=now() returning *`,
      [
        entityType,
        entityId,
        documentType,
        stored.originalFileName,
        stored.storageKey,
        stored.mimeType,
        stored.size,
        user.id,
      ],
    );
    return mapAttachment(requireRow(result.rows[0]));
  }

  async getAttachment(entityType: Entity, entityId: string, attachmentId: string) {
    await this.ensureEntity(entityType, entityId);
    const result = await pool.query(
      `select * from internal_logistics_attachments where id=$1 and entity_type=$2 and entity_id=$3`,
      [attachmentId, entityType, entityId],
    );
    const row = requireFound(result.rows[0]);
    return {
      ...mapAttachment(row),
      ...(await documentStorageService.readStoredDocument(row.storage_key)),
    };
  }

  private async list<T>(sql: string, query: LogisticsList, map: (row: LogisticsRow) => T) {
    const offset = (query.page - 1) * PAGE_SIZE;
    const result = await pool.query<LogisticsRow>(
      `${sql} order by sort_updated_at desc limit $3 offset $4`,
      [query.status ?? null, query.search || null, PAGE_SIZE, offset],
    );
    const total = Number(result.rows[0]?.total_count ?? 0);
    return {
      items: result.rows.map(map),
      pagination: {
        page: query.page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    };
  }

  private async createEntity<T extends QueryResultRow>(
    entityType: string,
    user: SalesUser,
    sql: string,
    values: unknown[],
    event: string,
    map: (row: T) => unknown,
    uniqueMessage: string,
  ) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query<T>(sql, values);
      const row = requireRow(result.rows[0]);
      await audit(client, entityType, row.id, event, user, null, row);
      await client.query('commit');
      return map(row);
    } catch (error) {
      await client.query('rollback');
      throw uniqueError(error, uniqueMessage);
    } finally {
      client.release();
    }
  }

  private async updateEntity<T extends QueryResultRow>(
    entityType: string,
    table: string,
    id: string,
    input: Record<string, unknown>,
    user: SalesUser,
    fields: Record<string, string>,
    map: (row: T) => unknown,
    event: string | ((before: T, after: T) => string),
  ) {
    const entries = Object.entries(input).filter(
      ([key, value]) => value !== undefined && fields[key],
    );
    if (!entries.length)
      throw new AppError('At least one field is required.', 400, 'LOGISTICS_UPDATE_EMPTY');
    const client = await pool.connect();
    try {
      await client.query('begin');
      const before = requireFound(
        (await client.query<T>(`select * from ${table} where id=$1 for update`, [id])).rows[0],
      );
      const values: unknown[] = [id];
      const sets = entries.map(([key, value]) => {
        values.push(
          key === 'phone' || key === 'mobile'
            ? normalizePhone(String(value))
            : key === 'plateNumber' || key === 'licenseNumber'
              ? String(value).toUpperCase()
              : value,
        );
        return `${fields[key]}=$${values.length}`;
      });
      const after = requireRow(
        (
          await client.query<T>(
            `update ${table} set ${sets.join(',')},updated_at=now() where id=$1 returning *`,
            values,
          )
        ).rows[0],
      );
      await audit(
        client,
        entityType,
        id,
        typeof event === 'function' ? event(before, after) : event,
        user,
        before,
        after,
      );
      await client.query('commit');
      return map(after);
    } catch (error) {
      await client.query('rollback');
      throw uniqueError(
        error,
        `The updated ${entityType.toLowerCase()} conflicts with an existing record.`,
      );
    } finally {
      client.release();
    }
  }

  private async validateCostReferences(transporterId: string, cityId: string) {
    const r = await pool.query(
      `select
    exists(select 1 from transporters where id=$1 and status='ACTIVE') transporter,
    exists(select 1 from ksa_cities where id=$2 and is_active=true and is_hader_enabled=true) city`,
      [transporterId, cityId],
    );
    if (!r.rows[0]?.transporter)
      throw new AppError('Active transporter was not found.', 400, 'TRANSPORTER_INVALID');
    if (!r.rows[0]?.city)
      throw new AppError('Hader city was not found.', 400, 'HADER_CITY_INVALID');
  }

  private async ensureEntity(type: Entity, id: string) {
    const table =
      type === 'TRANSPORTER' ? 'transporters' : type === 'TRUCK' ? 'hader_trucks' : 'hader_drivers';
    requireFound((await pool.query(`select id from ${table} where id=$1`, [id])).rows[0]);
  }
}

export const internalLogisticsService = new InternalLogisticsService();
async function audit(
  client: PoolClient,
  type: string,
  id: string,
  event: string,
  user: SalesUser,
  oldValue: unknown,
  newValue: unknown,
) {
  await client.query(
    `insert into internal_logistics_events(entity_type,entity_id,event_type,changed_by_sales_user_id,old_value,new_value) values($1,$2,$3,$4,$5,$6)`,
    [
      type,
      id,
      event,
      user.id,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
    ],
  );
}
function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return `+966${digits.startsWith('966') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits}`;
}
function requireRow<T>(row: T | undefined): T {
  if (!row) throw new AppError('Record could not be saved.', 503, 'LOGISTICS_SAVE_FAILED');
  return row;
}
function requireFound<T>(row: T | undefined): T {
  if (!row) throw new AppError('Record was not found.', 404, 'LOGISTICS_NOT_FOUND');
  return row;
}
function uniqueError(error: unknown, message: string) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  )
    return new AppError(message, 409, 'LOGISTICS_DUPLICATE');
  return error;
}
function base(row: LogisticsRow) {
  return {
    id: row.id,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
function mapTransporter(r: LogisticsRow) {
  return {
    ...base(r),
    transporterNumber: String(r.transporter_number),
    name: String(r.name),
    companyName: String(r.company_name),
    contactPerson: nullableString(r.contact_person),
    phone: String(r.phone),
    email: nullableString(r.email),
    crNumber: nullableString(r.cr_number),
  };
}
function mapCost(r: LogisticsRow) {
  return {
    ...base(r),
    transporterId: r.transporter_id,
    transporterNumber: r.transporter_number,
    companyName: r.company_name,
    haderCityId: r.hader_city_id,
    haderCityName: r.city_name,
    cementType: r.cement_type,
    costPerTon: Number(r.cost_per_ton),
    createdBy: r.created_by_name,
    updatedBy: r.updated_by_name,
  };
}
function mapTruck(r: LogisticsRow) {
  return {
    ...base(r),
    truckNumber: r.truck_number,
    plateNumber: r.plate_number,
    vehicleType: r.vehicle_type,
    capacityTon: Number(r.capacity_ton),
    modelYear: r.model_year,
    assignedDriverId: r.assigned_driver_id,
    assignedDriverName: r.assigned_driver_name,
  };
}
function mapDriver(r: LogisticsRow) {
  return {
    ...base(r),
    driverNumber: r.driver_number,
    name: r.name,
    mobile: r.mobile,
    licenseNumber: r.license_number,
    licenseExpiry: r.license_expiry,
  };
}
function mapAttachment(r: AttachmentRow) {
  return {
    id: r.id,
    documentType: r.document_type,
    fileName: r.original_file_name,
    mimeType: r.mime_type,
    fileSize: r.file_size,
    uploadedAt: new Date(r.created_at).toISOString(),
  };
}
function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}
