import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';

export const listPriceDirectOrderApprovalKey = 'LIST_PRICE_DIRECT_ORDER_APPROVAL' as const;
export const listPriceDirectOrderApprovalValues = ['AUTO_APPROVE', 'MUST_APPROVE'] as const;
export const contractOrderCreationSettingKeys = {
  hader: 'allow_hader_contract_order_creation',
  dispatch: 'allow_dispatch_contract_order_creation',
} as const;

export type ContractOrderCreationActor = keyof typeof contractOrderCreationSettingKeys;

export type ListPriceDirectOrderApprovalMode =
  (typeof listPriceDirectOrderApprovalValues)[number];

type QueryExecutor = Pick<PoolClient, 'query'>;

interface SettingRow {
  value: string;
  updated_at: Date | string;
}

export class ApplicationSettingsService {
  async isContractOrderCreationAllowed(
    actor: ContractOrderCreationActor,
    executor: QueryExecutor = pool,
  ) {
    const result = await executor.query<SettingRow>(
      `select value, updated_at from application_settings where key = $1 limit 1`,
      [contractOrderCreationSettingKeys[actor]],
    );
    return result.rows[0]?.value === 'true';
  }

  async getContractOrderCreationSetting(
    actor: ContractOrderCreationActor,
    executor: QueryExecutor = pool,
  ) {
    const result = await executor.query<SettingRow>(
      `select value, updated_at from application_settings where key = $1 limit 1`,
      [contractOrderCreationSettingKeys[actor]],
    );
    const row = result.rows[0];
    return {
      key: contractOrderCreationSettingKeys[actor],
      value: row?.value === 'true',
      updatedAt: row?.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
    };
  }

  async setContractOrderCreationAllowed(
    actor: ContractOrderCreationActor,
    value: boolean,
    salesUserId: string,
  ) {
    const result = await pool.query<SettingRow>(
      `insert into application_settings (key, value, updated_by_sales_user_id)
       values ($1, $2, $3)
       on conflict (key) do update set value = excluded.value,
         updated_by_sales_user_id = excluded.updated_by_sales_user_id, updated_at = now()
       returning value, updated_at`,
      [contractOrderCreationSettingKeys[actor], String(value), salesUserId],
    );
    const row = result.rows[0];
    return {
      key: contractOrderCreationSettingKeys[actor],
      value: row?.value === 'true',
      updatedAt: row?.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
    };
  }
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
