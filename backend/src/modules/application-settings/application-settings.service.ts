import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';

export const listPriceDirectOrderApprovalKey = 'LIST_PRICE_DIRECT_ORDER_APPROVAL' as const;
export const listPriceDirectOrderApprovalValues = ['AUTO_APPROVE', 'MUST_APPROVE'] as const;

export type ListPriceDirectOrderApprovalMode =
  (typeof listPriceDirectOrderApprovalValues)[number];

type QueryExecutor = Pick<PoolClient, 'query'>;

interface SettingRow {
  value: string;
  updated_at: Date | string;
}

export class ApplicationSettingsService {
  async getListPriceDirectOrderApprovalMode(executor: QueryExecutor = pool) {
    const result = await executor.query<SettingRow>(
      `select value, updated_at
       from application_settings
       where key = $1
       limit 1`,
      [listPriceDirectOrderApprovalKey],
    );
    const value = result.rows[0]?.value;
    return isListPriceDirectOrderApprovalMode(value) ? value : 'AUTO_APPROVE';
  }

  async getListPriceDirectOrderApprovalSetting(executor: QueryExecutor = pool) {
    const result = await executor.query<SettingRow>(
      `select value, updated_at
       from application_settings
       where key = $1
       limit 1`,
      [listPriceDirectOrderApprovalKey],
    );
    const row = result.rows[0];
    const value = isListPriceDirectOrderApprovalMode(row?.value) ? row.value : 'AUTO_APPROVE';
    return {
      key: listPriceDirectOrderApprovalKey,
      value,
      updatedAt: row?.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
    };
  }

  async setListPriceDirectOrderApprovalMode(
    value: ListPriceDirectOrderApprovalMode,
    salesUserId: string,
  ) {
    const result = await pool.query<SettingRow>(
      `insert into application_settings (key, value, updated_by_sales_user_id)
       values ($1, $2, $3)
       on conflict (key)
       do update set value = excluded.value,
                     updated_by_sales_user_id = excluded.updated_by_sales_user_id,
                     updated_at = now()
       returning value, updated_at`,
      [listPriceDirectOrderApprovalKey, value, salesUserId],
    );
    const row = result.rows[0];
    return {
      key: listPriceDirectOrderApprovalKey,
      value: isListPriceDirectOrderApprovalMode(row?.value) ? row.value : value,
      updatedAt: row?.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
    };
  }
}

export const applicationSettingsService = new ApplicationSettingsService();

function isListPriceDirectOrderApprovalMode(
  value: unknown,
): value is ListPriceDirectOrderApprovalMode {
  return (
    typeof value === 'string' &&
    listPriceDirectOrderApprovalValues.includes(
      value as ListPriceDirectOrderApprovalMode,
    )
  );
}
