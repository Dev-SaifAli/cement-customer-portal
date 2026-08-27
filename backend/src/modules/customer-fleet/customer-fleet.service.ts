import { pool } from '../../database/pool.js';
import type { PoolClient } from 'pg';
import { AppError } from '../../errors/app-error.js';
import { documentStorageService } from '../registration-documents/document-storage.service.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type {
  CreateDriverInput,
  CreateTruckInput,
  UpdateDriverInput,
  UpdateTruckInput,
} from './customer-fleet.validation.js';

const PAGE_SIZE = 10;
type EntityType = 'TRUCK' | 'DRIVER';

interface TruckRow {
  id: string;
  truck_number: string;
  plate_number: string;
  vehicle_type: string;
  capacity_ton: string;
  carrier_name: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: string;
  attachments?: AttachmentRow[];
}

interface DriverRow {
  id: string;
  driver_number: string;
  name: string;
  mobile: string;
  license_number: string;
  license_expiry: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: string;
  attachments?: AttachmentRow[];
}

interface AttachmentRow {
  id: string;
  document_type: string;
  original_file_name: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
  created_at: Date | string;
}

export class CustomerFleetService {
  async listTrucks(
    user: CustomerUser,
    query: { page: number; search?: string | undefined; status?: string | undefined },
  ) {
    const offset = (query.page - 1) * PAGE_SIZE;
    const result = await pool.query<TruckRow>(
      `select t.*, count(*) over()::text as total_count,
         coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'document_type', a.document_type,
           'original_file_name', a.original_file_name, 'mime_type', a.mime_type,
           'file_size', a.file_size, 'created_at', a.created_at) order by a.created_at desc)
           from customer_fleet_attachments a where a.customer_account_id=t.customer_account_id
             and a.entity_type='TRUCK' and a.entity_id=t.id), '[]'::jsonb) as attachments
       from customer_trucks t
       where t.customer_account_id = $1
         and ($2::text is null or t.status = $2)
         and ($3::text is null or t.truck_number ilike '%' || $3 || '%'
           or t.plate_number ilike '%' || $3 || '%' or t.vehicle_type ilike '%' || $3 || '%')
       order by t.created_at desc limit $4 offset $5`,
      [user.account.id, query.status ?? null, query.search || null, PAGE_SIZE, offset],
    );
    return pageResult(result.rows.map(mapTruck), result.rows[0]?.total_count, query.page);
  }

  async createTruck(user: CustomerUser, input: CreateTruckInput) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query<TruckRow>(
        `insert into customer_trucks (
           customer_account_id, truck_number, plate_number, vehicle_type, capacity_ton,
           carrier_name, status, created_by_customer_user_id
         ) values ($1, 'TRK-' || lpad(nextval('customer_truck_number_seq')::text, 6, '0'),
           upper($2), $3, $4, nullif($5, ''), $6, $7) returning *`,
        [
          user.account.id,
          input.plateNumber,
          input.vehicleType,
          input.capacityTon,
          input.carrierName ?? '',
          input.status,
          user.id,
        ],
      );
      const row = requireRow(result.rows[0], 'Truck could not be created.');
      await insertEvent(client, user, 'TRUCK', row.id, 'TRUCK_CREATED', {
        oldValue: null,
        newValue: auditSnapshot(row),
      });
      await client.query('commit');
      return mapTruck(row);
    } catch (error) {
      await client.query('rollback');
      throw translateUnique(error, 'A truck with this plate number already exists.');
    } finally {
      client.release();
    }
  }

  async updateTruck(user: CustomerUser, id: string, input: UpdateTruckInput) {
    return this.updateEntity<TruckRow>(
      user,
      'TRUCK',
      id,
      async (client) => {
        const current = await client.query<TruckRow>(
          'select * from customer_trucks where id = $2 and customer_account_id = $1 for update',
          [user.account.id, id],
        );
        const row = requireFound(current.rows[0], 'Truck');
        const result = await client.query<TruckRow>(
          `update customer_trucks set plate_number = upper($3), vehicle_type = $4,
           capacity_ton = $5, carrier_name = nullif($6, ''), status = $7, updated_at = now()
         where customer_account_id = $1 and id = $2 returning *`,
          [
            user.account.id,
            id,
            input.plateNumber ?? row.plate_number,
            input.vehicleType ?? row.vehicle_type,
            input.capacityTon ?? Number(row.capacity_ton),
            input.carrierName ?? row.carrier_name ?? '',
            input.status ?? row.status,
          ],
        );
        return { before: row, after: requireRow(result.rows[0], 'Truck could not be updated.') };
      },
      input.status === 'INACTIVE' ? 'TRUCK_DEACTIVATED' : 'TRUCK_UPDATED',
      mapTruck,
      'A truck with this plate number already exists.',
    );
  }

  async listDrivers(
    user: CustomerUser,
    query: { page: number; search?: string | undefined; status?: string | undefined },
  ) {
    const offset = (query.page - 1) * PAGE_SIZE;
    const result = await pool.query<DriverRow>(
      `select d.*, count(*) over()::text as total_count,
         coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'document_type', a.document_type,
           'original_file_name', a.original_file_name, 'mime_type', a.mime_type,
           'file_size', a.file_size, 'created_at', a.created_at) order by a.created_at desc)
           from customer_fleet_attachments a where a.customer_account_id=d.customer_account_id
             and a.entity_type='DRIVER' and a.entity_id=d.id), '[]'::jsonb) as attachments
       from customer_drivers d
       where d.customer_account_id = $1 and ($2::text is null or d.status = $2)
         and ($3::text is null or d.driver_number ilike '%' || $3 || '%'
           or d.name ilike '%' || $3 || '%' or d.mobile ilike '%' || $3 || '%'
           or d.license_number ilike '%' || $3 || '%')
       order by d.created_at desc limit $4 offset $5`,
      [user.account.id, query.status ?? null, query.search || null, PAGE_SIZE, offset],
    );
    return pageResult(result.rows.map(mapDriver), result.rows[0]?.total_count, query.page);
  }

  async createDriver(user: CustomerUser, input: CreateDriverInput) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query<DriverRow>(
        `insert into customer_drivers (
           customer_account_id, driver_number, name, mobile, license_number, license_expiry,
           status, created_by_customer_user_id
         ) values ($1, 'DRV-' || lpad(nextval('customer_driver_number_seq')::text, 6, '0'),
           $2, $3, upper($4), $5, $6, $7) returning *`,
        [
          user.account.id,
          input.name,
          input.mobile,
          input.licenseNumber,
          input.licenseExpiry ?? null,
          input.status,
          user.id,
        ],
      );
      const row = requireRow(result.rows[0], 'Driver could not be created.');
      await insertEvent(client, user, 'DRIVER', row.id, 'DRIVER_CREATED', {
        oldValue: null,
        newValue: auditSnapshot(row),
      });
      await client.query('commit');
      return mapDriver(row);
    } catch (error) {
      await client.query('rollback');
      throw translateUnique(error, 'A driver with this license number already exists.');
    } finally {
      client.release();
    }
  }

  async updateDriver(user: CustomerUser, id: string, input: UpdateDriverInput) {
    return this.updateEntity<DriverRow>(
      user,
      'DRIVER',
      id,
      async (client) => {
        const current = await client.query<DriverRow>(
          'select * from customer_drivers where id = $2 and customer_account_id = $1 for update',
          [user.account.id, id],
        );
        const row = requireFound(current.rows[0], 'Driver');
        const result = await client.query<DriverRow>(
          `update customer_drivers set name = $3, mobile = $4, license_number = upper($5),
           license_expiry = $6, status = $7, updated_at = now()
         where customer_account_id = $1 and id = $2 returning *`,
          [
            user.account.id,
            id,
            input.name ?? row.name,
            input.mobile ?? row.mobile,
            input.licenseNumber ?? row.license_number,
            input.licenseExpiry ?? row.license_expiry,
            input.status ?? row.status,
          ],
        );
        return { before: row, after: requireRow(result.rows[0], 'Driver could not be updated.') };
      },
      input.status === 'INACTIVE' ? 'DRIVER_DEACTIVATED' : 'DRIVER_UPDATED',
      mapDriver,
      'A driver with this license number already exists.',
    );
  }

  async uploadAttachment(
    user: CustomerUser,
    input: {
      entityType: EntityType;
      entityId: string;
      documentType: string;
      fileName: string;
      mimeType?: string | undefined;
      buffer: Buffer;
    },
  ) {
    await this.ensureOwnedEntity(user, input.entityType, input.entityId);
    const stored = await documentStorageService.saveCustomerFleetDocument({
      customerAccountId: user.account.id,
      entityType: input.entityType === 'TRUCK' ? 'trucks' : 'drivers',
      entityId: input.entityId,
      documentType: input.documentType,
      fileName: input.fileName,
      mimeType: input.mimeType,
      buffer: input.buffer,
    });
    const result = await pool.query<AttachmentRow>(
      `insert into customer_fleet_attachments (
         customer_account_id, entity_type, entity_id, document_type, original_file_name,
         storage_key, mime_type, file_size, uploaded_by_customer_user_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (customer_account_id, entity_type, entity_id, document_type)
       do update set original_file_name=excluded.original_file_name, storage_key=excluded.storage_key,
         mime_type=excluded.mime_type, file_size=excluded.file_size,
         uploaded_by_customer_user_id=excluded.uploaded_by_customer_user_id, created_at=now()
       returning *`,
      [
        user.account.id,
        input.entityType,
        input.entityId,
        input.documentType,
        stored.originalFileName,
        stored.storageKey,
        stored.mimeType,
        stored.size,
        user.id,
      ],
    );
    return mapAttachment(requireRow(result.rows[0], 'Document could not be saved.'));
  }

  async getAttachment(
    user: CustomerUser,
    entityType: EntityType,
    entityId: string,
    documentId: string,
  ) {
    await this.ensureOwnedEntity(user, entityType, entityId);
    const result = await pool.query<AttachmentRow>(
      `select * from customer_fleet_attachments where id=$4 and customer_account_id=$1
       and entity_type=$2 and entity_id=$3`,
      [user.account.id, entityType, entityId, documentId],
    );
    const row = requireFound(result.rows[0], 'Document');
    const stored = await documentStorageService.readStoredDocument(row.storage_key);
    return { ...mapAttachment(row), stream: stored.stream, streamSize: stored.size };
  }

  private async updateEntity<TRow extends TruckRow | DriverRow>(
    user: CustomerUser,
    entityType: EntityType,
    id: string,
    update: (client: PoolClient) => Promise<{ before: TRow; after: TRow }>,
    eventType: string,
    mapper: (row: TRow) => unknown,
    uniqueMessage: string,
  ) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { before, after } = await update(client);
      await insertEvent(client, user, entityType, id, eventType, {
        oldValue: auditSnapshot(before),
        newValue: auditSnapshot(after),
      });
      await client.query('commit');
      return mapper(after);
    } catch (error) {
      await client.query('rollback');
      throw translateUnique(error, uniqueMessage);
    } finally {
      client.release();
    }
  }

  private async ensureOwnedEntity(user: CustomerUser, entityType: EntityType, id: string) {
    const table = entityType === 'TRUCK' ? 'customer_trucks' : 'customer_drivers';
    const result = await pool.query(
      `select id from ${table} where id=$2 and customer_account_id=$1`,
      [user.account.id, id],
    );
    requireFound(result.rows[0], entityType === 'TRUCK' ? 'Truck' : 'Driver');
  }
}

export const customerFleetService = new CustomerFleetService();

function pageResult<T>(items: T[], rawTotal: string | undefined, page: number) {
  const total = Number(rawTotal ?? 0);
  return {
    items,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  };
}
function mapTruck(row: TruckRow) {
  return {
    id: row.id,
    truckNumber: row.truck_number,
    plateNumber: row.plate_number,
    vehicleType: row.vehicle_type,
    capacityTon: Number(row.capacity_ton),
    carrierName: row.carrier_name,
    status: row.status,
    attachments: (row.attachments ?? []).map(mapAttachment),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
function mapDriver(row: DriverRow) {
  return {
    id: row.id,
    driverNumber: row.driver_number,
    name: row.name,
    mobile: row.mobile,
    licenseNumber: row.license_number,
    licenseExpiry: row.license_expiry,
    status: row.status,
    attachments: (row.attachments ?? []).map(mapAttachment),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
function mapAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    documentType: row.document_type,
    fileName: row.original_file_name,
    mimeType: row.mime_type,
    size: row.file_size,
    uploadedAt: new Date(row.created_at).toISOString(),
  };
}
function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new AppError(message, 503, 'CUSTOMER_FLEET_WRITE_FAILED');
  return row;
}
function requireFound<T>(row: T | undefined, label: string): T {
  if (!row) throw new AppError(`${label} was not found.`, 404, 'CUSTOMER_FLEET_NOT_FOUND');
  return row;
}
function translateUnique(error: unknown, message: string) {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505')
    return new AppError(message, 409, 'CUSTOMER_FLEET_DUPLICATE');
  return error;
}
async function insertEvent(
  client: PoolClient,
  user: CustomerUser,
  entityType: EntityType,
  entityId: string,
  eventType: string,
  eventData: Record<string, unknown>,
) {
  await client.query(
    `insert into customer_fleet_events (customer_account_id, entity_type, entity_id,
    event_type, changed_by_customer_user_id, event_data) values ($1,$2,$3,$4,$5,$6)`,
    [user.account.id, entityType, entityId, eventType, user.id, eventData],
  );
}

function auditSnapshot(row: TruckRow | DriverRow) {
  if ('truck_number' in row) {
    return {
      id: row.id,
      truckNumber: row.truck_number,
      plateNumber: row.plate_number,
      vehicleType: row.vehicle_type,
      capacityTon: Number(row.capacity_ton),
      carrierName: row.carrier_name,
      status: row.status,
    };
  }
  return {
    id: row.id,
    driverNumber: row.driver_number,
    name: row.name,
    mobile: row.mobile,
    licenseNumber: row.license_number,
    licenseExpiry: row.license_expiry,
    status: row.status,
  };
}
