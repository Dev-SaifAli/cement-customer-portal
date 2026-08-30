import type { PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';

type QueryExecutor = Pick<PoolClient, 'query'>;

interface ActiveTaxRow {
  vat_mode: 'LOCAL' | 'EXPORT';
  rate_percent: string;
}

class TaxRateService {
  async getRate(executor: QueryExecutor = pool) {
    try {
      const result = await executor.query<ActiveTaxRow>(
        `select vat_mode,rate_percent
         from tax_configurations
         where status='ACTIVE' and tax_type='VAT'
         order by updated_at desc limit 1`,
      );
      const configuration = result.rows[0];
      if (!configuration) return env.QUOTATION_VAT_RATE;
      return configuration.vat_mode === 'EXPORT' ? 0 : Number(configuration.rate_percent) / 100;
    } catch (error) {
      if (isMissingTaxSchema(error)) return env.QUOTATION_VAT_RATE;
      throw error;
    }
  }
}

function isMissingTaxSchema(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return error.code === '42P01' || error.code === '42703';
}

export const taxRateService = new TaxRateService();
