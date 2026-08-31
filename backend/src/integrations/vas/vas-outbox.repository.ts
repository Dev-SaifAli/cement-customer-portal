import { pool } from '../../database/pool.js';
import type { VasErrorCategory, VasOutboxStatus } from './vas.types.js';

interface VasOutboxRow {
  id: string;
  order_id: string;
  event_type: string;
  payload_snapshot: unknown;
  status: VasOutboxStatus;
  attempt_count: number;
  last_attempt_at: Date | string | null;
  last_error: string | null;
  error_category: VasErrorCategory | null;
  external_reference: string | null;
  correlation_key: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export class VasOutboxRepository {
  async create(input: {
    orderId: string;
    eventType: string;
    payloadSnapshot: unknown;
    correlationKey: string;
    status?: 'PENDING' | 'VALIDATION_FAILED';
    validationError?: string;
  }) {
    const status = input.status ?? 'PENDING';
    const inserted = await pool.query<VasOutboxRow>(
      `insert into vas_outbox (
         order_id,event_type,payload_snapshot,status,last_error,error_category,correlation_key
       ) values ($1,$2,$3::jsonb,$4,$5,$6,$7)
       on conflict (correlation_key) do nothing
       returning *`,
      [
        input.orderId,
        input.eventType,
        JSON.stringify(input.payloadSnapshot),
        status,
        input.validationError ?? null,
        status === 'VALIDATION_FAILED' ? 'VALIDATION' : null,
        input.correlationKey,
      ],
    );
    const row = inserted.rows[0] ?? (await this.getByCorrelationKey(input.correlationKey));
    return row ? mapRow(row) : null;
  }

  async getByCorrelationKey(correlationKey: string) {
    const result = await pool.query<VasOutboxRow>(
      'select * from vas_outbox where correlation_key=$1',
      [correlationKey],
    );
    return result.rows[0] ?? null;
  }

  async markAttempt(id: string) {
    const result = await pool.query<VasOutboxRow>(
      `update vas_outbox set status='PROCESSING',attempt_count=attempt_count+1,
         last_attempt_at=now(),last_error=null,error_category=null,updated_at=now()
       where id=$1 returning *`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async markSucceeded(id: string, externalReference: string | null) {
    const result = await pool.query<VasOutboxRow>(
      `update vas_outbox set status='SUCCEEDED',external_reference=$2,
         last_error=null,error_category=null,updated_at=now()
       where id=$1 returning *`,
      [id, externalReference],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async markFailed(id: string, category: VasErrorCategory, safeError: string) {
    const result = await pool.query<VasOutboxRow>(
      `update vas_outbox set status=$2,last_error=$3,error_category=$4,updated_at=now()
       where id=$1 returning *`,
      [id, category === 'VALIDATION' ? 'VALIDATION_FAILED' : 'FAILED', safeError, category],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
}

export const vasOutboxRepository = new VasOutboxRepository();

function mapRow(row: VasOutboxRow) {
  return {
    id: row.id,
    orderId: row.order_id,
    eventType: row.event_type,
    payloadSnapshot: row.payload_snapshot,
    status: row.status,
    attemptCount: row.attempt_count,
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
    lastError: row.last_error,
    errorCategory: row.error_category,
    externalReference: row.external_reference,
    correlationKey: row.correlation_key,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
