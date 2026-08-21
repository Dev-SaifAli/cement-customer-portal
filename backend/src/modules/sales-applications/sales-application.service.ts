import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type {
  SalesApplicationListQuery,
  SalesApplicationRow,
  SalesApplicationStatus,
  SalesApplicationStatusEventRow,
  SalesApplicationStatusUpdateInput,
} from './sales-application.types.js';

const submittedApplicationStatuses: SalesApplicationStatus[] = [
  'PENDING_SALES_REVIEW',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'ACTIVATED',
];

const allowedTransitions: Partial<Record<SalesApplicationStatus, SalesApplicationStatus[]>> = {
  PENDING_SALES_REVIEW: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'],
  CHANGES_REQUESTED: ['UNDER_REVIEW'],
};

export class SalesApplicationService {
  async listApplications(query: SalesApplicationListQuery) {
    const offset = (query.page - 1) * query.pageSize;
    const filters: string[] = [];
    const values: unknown[] = [];

    if (query.status) {
      values.push(query.status);
      filters.push(`status = $${values.length}`);
    } else {
      values.push(submittedApplicationStatuses);
      filters.push(`status = any($${values.length})`);
    }

    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      filters.push(`(
        lower(coalesce(reference, '')) like $${values.length}
        or lower(coalesce(company->>'companyName', '')) like $${values.length}
        or lower(coalesce(contact->>'email', '')) like $${values.length}
        or lower(coalesce(contact->>'phone', '')) like $${values.length}
        or lower(coalesce(administrator->>'email', '')) like $${values.length}
        or lower(coalesce(administrator->>'phone', '')) like $${values.length}
      )`);
    }

    const whereClause = filters.length > 0 ? `where ${filters.join(' and ')}` : '';
    const countValues = [...values];
    const countResult = await pool.query<{ total: string }>(
      `select count(*)::text as total
       from registration_drafts
       ${whereClause}`,
      countValues,
    );

    const listValues = [...values, query.pageSize, offset];
    const result = await pool.query<SalesApplicationRow>(
      `select id, reference, status, current_step, company, contact, documents,
              delivery_locations, administrator, submitted_at, created_at, updated_at
       from registration_drafts
       ${whereClause}
       order by submitted_at desc nulls last, created_at desc
       limit $${listValues.length - 1}
       offset $${listValues.length}`,
      listValues,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map(mapApplicationSummary),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getApplication(id: string) {
    const result = await pool.query<SalesApplicationRow>(
      `select id, reference, status, current_step, company, contact, documents,
              delivery_locations, administrator, submitted_at, created_at, updated_at
       from registration_drafts
       where id = $1
       limit 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError('Application was not found.', 404, 'SALES_APPLICATION_NOT_FOUND');
    }

    const events = await pool.query<SalesApplicationStatusEventRow>(
      `select id, previous_status, new_status, reason, changed_by, created_at
       from application_status_events
       where registration_id = $1
       order by created_at asc`,
      [id],
    );

    return mapApplicationDetails(row, events.rows);
  }

  async updateStatus(id: string, input: SalesApplicationStatusUpdateInput, changedBy: string) {
    const client = await pool.connect();

    try {
      await client.query('begin');
      const current = await this.getApplicationForUpdate(client, id);

      if (current.status === input.status) {
        await client.query('commit');
        return {
          statusChanged: false,
          message: 'Application is already in the requested status.',
          application: mapApplicationDetails(current, []),
        };
      }

      this.validateTransition(current.status, input.status);

      const updateResult = await client.query<SalesApplicationRow>(
        `update registration_drafts
         set status = $2,
             updated_at = now()
         where id = $1
         returning id, reference, status, current_step, company, contact, documents,
                   delivery_locations, administrator, submitted_at, created_at, updated_at`,
        [id, input.status],
      );

      const updated = updateResult.rows[0];
      if (!updated) {
        throw new AppError('Application was not found.', 404, 'SALES_APPLICATION_NOT_FOUND');
      }

      await client.query(
        `insert into application_status_events (
           registration_id,
           previous_status,
           new_status,
           reason,
           changed_by
         )
         values ($1, $2, $3, $4, $5)`,
        [id, current.status, input.status, input.reason ?? null, changedBy],
      );

      await client.query('commit');

      return {
        statusChanged: true,
        application: mapApplicationDetails(updated, []),
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getApplicationForUpdate(client: PoolClient, id: string) {
    const result = await client.query<SalesApplicationRow>(
      `select id, reference, status, current_step, company, contact, documents,
              delivery_locations, administrator, submitted_at, created_at, updated_at
       from registration_drafts
       where id = $1
       for update`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError('Application was not found.', 404, 'SALES_APPLICATION_NOT_FOUND');
    }

    return row;
  }

  private validateTransition(
    currentStatus: SalesApplicationStatus,
    nextStatus: SalesApplicationStatus,
  ) {
    const allowedNextStatuses = allowedTransitions[currentStatus] ?? [];

    if (!allowedNextStatuses.includes(nextStatus)) {
      throw new AppError(
        `Application cannot move from ${currentStatus} to ${nextStatus}.`,
        409,
        'SALES_APPLICATION_INVALID_STATUS_TRANSITION',
      );
    }
  }
}

export const salesApplicationService = new SalesApplicationService();

function mapApplicationSummary(row: SalesApplicationRow) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    companyName: stringOrNull(row.company.companyName),
    contactName: stringOrNull(row.contact.fullName),
    contactEmail: stringOrNull(row.contact.email),
    contactPhone: stringOrNull(row.contact.phone),
    submittedAt: dateOrNull(row.submitted_at),
    createdAt: dateString(row.created_at),
    updatedAt: dateString(row.updated_at),
  };
}

function mapApplicationDetails(row: SalesApplicationRow, events: SalesApplicationStatusEventRow[]) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    currentStep: row.current_step,
    company: row.company,
    contact: row.contact,
    documents: safeDocuments(row.documents),
    deliveryLocations: row.delivery_locations,
    administrator: safeAdministrator(row.administrator),
    submittedAt: dateOrNull(row.submitted_at),
    createdAt: dateString(row.created_at),
    updatedAt: dateString(row.updated_at),
    statusHistory: events.map((event) => ({
      id: event.id,
      previousStatus: event.previous_status,
      newStatus: event.new_status,
      reason: event.reason,
      changedBy: event.changed_by,
      createdAt: dateString(event.created_at),
    })),
  };
}

function safeAdministrator(administrator: Record<string, unknown>) {
  const {
    password: _password,
    confirmPassword: _confirmPassword,
    passwordHash: _passwordHash,
    password_hash: _passwordHashSnake,
    ...safe
  } = administrator;
  void _password;
  void _confirmPassword;
  void _passwordHash;
  void _passwordHashSnake;

  return safe;
}

function safeDocuments(documents: Record<string, unknown>) {
  return Object.entries(documents).reduce<Record<string, unknown>>((safe, [documentId, value]) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      safe[documentId] = value;
      return safe;
    }

    const { storageKey: _storageKey, ...documentMetadata } = value as Record<string, unknown>;
    void _storageKey;
    safe[documentId] = {
      documentId,
      ...documentMetadata,
      hasFile: Boolean(_storageKey),
    };
    return safe;
  }, {});
}

function dateString(value: Date | string) {
  return new Date(String(value)).toISOString();
}

function dateOrNull(value: Date | string | null) {
  return value ? dateString(value) : null;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
