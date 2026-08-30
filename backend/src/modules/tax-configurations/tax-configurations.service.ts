import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { TaxConfigurationInput } from './tax-configurations.validation.js';

type TaxStatus = 'ACTIVE' | 'INACTIVE';

interface TaxRow {
  id: string;
  tax_name: string;
  tax_type: 'VAT';
  vat_mode: 'LOCAL' | 'EXPORT';
  rate_percent: string;
  status: TaxStatus;
  updated_by: string;
  created_at: Date | string;
  updated_at: Date | string;
}

const selectSql = `select t.id,t.tax_name,t.tax_type,t.vat_mode,t.rate_percent,t.status,
  coalesce(u.name,'Unknown') updated_by,t.created_at,t.updated_at
  from tax_configurations t
  left join sales_users u on u.id=t.updated_by_sales_user_id`;

export class TaxConfigurationsService {
  async list() {
    const result = await pool.query<TaxRow>(`${selectSql} order by t.updated_at desc`);
    return { configurations: result.rows.map(mapRow) };
  }

  async get(id: string, client: PoolClient | null = null) {
    const executor = client ?? pool;
    const result = await executor.query<TaxRow>(`${selectSql} where t.id=$1 limit 1`, [id]);
    if (!result.rows[0]) {
      throw new AppError('Tax configuration was not found.', 404, 'TAX_CONFIGURATION_NOT_FOUND');
    }
    return mapRow(result.rows[0]);
  }

  async create(input: TaxConfigurationInput, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query<{ id: string }>(
        `insert into tax_configurations
          (tax_name,tax_type,vat_mode,rate_percent,status,created_by_sales_user_id,updated_by_sales_user_id)
         values('VAT','VAT',$1,$2,'ACTIVE',$3,$3) returning id`,
        [input.vatMode, input.ratePercent, user.id],
      );
      const configuration = await this.get(result.rows[0]!.id, client);
      await recordEvent(client, configuration.id, 'TAX_CONFIGURATION_CREATED', user.id, null, configuration);
      await client.query('commit');
      return configuration;
    } catch (error) {
      await client.query('rollback');
      throw translateDatabaseError(error);
    } finally {
      client.release();
    }
  }

  async update(id: string, input: TaxConfigurationInput, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const previous = await this.get(id, client);
      const result = await client.query<{ id: string }>(
        `update tax_configurations set tax_name='VAT',tax_type='VAT',vat_mode=$2,rate_percent=$3,
          status='ACTIVE',updated_by_sales_user_id=$4,updated_at=now() where id=$1 returning id`,
        [id, input.vatMode, input.ratePercent, user.id],
      );
      if (!result.rows[0]) {
        throw new AppError('Tax configuration was not found.', 404, 'TAX_CONFIGURATION_NOT_FOUND');
      }
      const configuration = await this.get(id, client);
      const eventType =
        previous.status !== configuration.status
          ? configuration.status === 'ACTIVE'
            ? 'TAX_CONFIGURATION_ACTIVATED'
            : 'TAX_CONFIGURATION_DEACTIVATED'
          : 'TAX_CONFIGURATION_UPDATED';
      await recordEvent(client, id, eventType, user.id, previous, configuration);
      await client.query('commit');
      return configuration;
    } catch (error) {
      await client.query('rollback');
      throw translateDatabaseError(error);
    } finally {
      client.release();
    }
  }
}

function mapRow(row: TaxRow) {
  return {
    id: row.id,
    taxName: row.tax_name,
    taxType: row.tax_type,
    vatMode: row.vat_mode,
    ratePercent: Number(row.rate_percent),
    status: row.status,
    updatedBy: row.updated_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    appliesTo: ['PRODUCT', 'DELIVERY', 'PALLET'] as const,
  };
}

async function recordEvent(
  client: PoolClient,
  entityId: string,
  eventType: string,
  userId: string,
  oldValue: unknown,
  newValue: unknown,
) {
  await client.query(
    `insert into internal_logistics_events
      (entity_type,entity_id,event_type,changed_by_sales_user_id,old_value,new_value)
     values('TAX_CONFIGURATION',$1,$2,$3,$4::jsonb,$5::jsonb)`,
    [
      entityId,
      eventType,
      userId,
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
    ],
  );
}

function translateDatabaseError(error: unknown) {
  if (isPostgresError(error) && error.code === '23505') {
    return new AppError(
      'Another active tax configuration already exists. Deactivate it before activating this configuration.',
      409,
      'ACTIVE_TAX_CONFIGURATION_EXISTS',
    );
  }
  return error;
}

function isPostgresError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export const taxConfigurationsService = new TaxConfigurationsService();
