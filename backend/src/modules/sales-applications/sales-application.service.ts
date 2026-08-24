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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    if (query.reference) {
      values.push(`%${query.reference.toLowerCase()}%`);
      filters.push(`lower(coalesce(reference, '')) like $${values.length}`);
    }

    if (query.company) {
      values.push(`%${query.company.toLowerCase()}%`);
      filters.push(`lower(coalesce(company->>'companyName', '')) like $${values.length}`);
    }

    if (query.contact) {
      values.push(`%${query.contact.toLowerCase()}%`);
      filters.push(`(
        lower(coalesce(contact->>'fullName', '')) like $${values.length}
        or lower(coalesce(contact->>'email', '')) like $${values.length}
        or lower(coalesce(contact->>'phone', '')) like $${values.length}
      )`);
    }

    if (query.submittedFrom) {
      values.push(query.submittedFrom);
      filters.push(`submitted_at >= $${values.length}::date`);
    }

    if (query.submittedTo) {
      values.push(query.submittedTo);
      filters.push(`submitted_at < ($${values.length}::date + interval '1 day')`);
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
      `select registration_drafts.id,
              registration_drafts.reference,
              registration_drafts.status,
              registration_drafts.current_step,
              registration_drafts.company,
              registration_drafts.contact,
              registration_drafts.documents,
              registration_drafts.delivery_locations,
              registration_drafts.administrator,
              registration_drafts.submitted_at,
              registration_drafts.created_at,
              registration_drafts.updated_at,
              customer_accounts.activated_at
       from registration_drafts
       left join customer_accounts on customer_accounts.registration_id = registration_drafts.id
       where registration_drafts.id = $1
       limit 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError('Application was not found.', 404, 'SALES_APPLICATION_NOT_FOUND');
    }

    const events = await pool.query<SalesApplicationStatusEventRow>(
      `select
         events.id,
         events.previous_status,
         events.new_status,
         events.reason,
         events.changed_by,
         sales_users.name as changed_by_name,
         sales_users.email as changed_by_email,
         events.created_at
       from application_status_events events
       left join sales_users on sales_users.id = events.changed_by
       where events.registration_id = $1
       order by events.created_at asc`,
      [id],
    );

    return mapApplicationDetails(row, events.rows);
  }

  async getFilterOptions(query: { field: string; search?: string | undefined; limit: number }) {
    if (query.field === 'status') {
      const search = query.search?.toLowerCase();
      return submittedApplicationStatuses
        .filter((status) => !search || status.toLowerCase().includes(search))
        .slice(0, query.limit)
        .map((status) => ({ value: status, label: status }));
    }

    const expression = getFilterOptionExpression(query.field);
    const values: unknown[] = [submittedApplicationStatuses];
    const filters = [`status = any($1)`, `${expression} is not null`, `btrim(${expression}) <> ''`];

    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      filters.push(`lower(${expression}) like $${values.length}`);
    }

    values.push(query.limit);
    const result = await pool.query<{ value: string }>(
      `select distinct ${expression} as value
       from registration_drafts
       where ${filters.join(' and ')}
       order by value asc
       limit $${values.length}`,
      values,
    );

    return result.rows.map((row) => ({
      value: row.value,
      label: row.value,
    }));
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

  async activateAccount(id: string, changedBy: string) {
    const client = await pool.connect();

    try {
      await client.query('begin');
      const current = await this.getApplicationForUpdate(client, id);

      if (current.status === 'ACTIVATED') {
        const existingAccount = await this.getCustomerAccountForRegistration(client, id);
        await client.query('commit');

        return {
          activated: false,
          message: 'Customer account is already activated.',
          account: existingAccount,
          application: mapApplicationDetails(current, []),
        };
      }

      if (current.status !== 'APPROVED') {
        throw new AppError(
          'Only approved applications can be activated.',
          409,
          'SALES_APPLICATION_ACTIVATION_NOT_ALLOWED',
        );
      }

      const activationInput = this.getActivationInput(current);
      const account = await this.createOrEnableCustomerAccount(client, current, activationInput);
      const user = await this.createOrEnableCustomerAdministrator(
        client,
        account.id,
        activationInput,
      );

      const updateResult = await client.query<SalesApplicationRow>(
        `update registration_drafts
         set status = 'ACTIVATED',
             updated_at = now()
         where id = $1
           and status = 'APPROVED'
         returning id, reference, status, current_step, company, contact, documents,
                   delivery_locations, administrator, submitted_at, created_at, updated_at`,
        [id],
      );

      const updated = updateResult.rows[0];
      if (!updated) {
        throw new AppError(
          'Application could not be activated.',
          409,
          'SALES_APPLICATION_ACTIVATION_CONFLICT',
        );
      }

      await client.query(
        `insert into application_status_events (
           registration_id,
           previous_status,
           new_status,
           reason,
           changed_by
         )
         values ($1, 'APPROVED', 'ACTIVATED', $2, $3)`,
        [id, 'Customer portal account activated.', changedBy],
      );

      await client.query('commit');

      return {
        activated: true,
        account: {
          ...account,
          user,
        },
        application: mapApplicationDetails({ ...updated, activated_at: account.activatedAt }, []),
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
              delivery_locations, administrator, admin_password_hash, submitted_at, created_at,
              updated_at
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

  private getActivationInput(application: SalesApplicationRow) {
    const companyName = getRequiredString(application.company.companyName, 'Company name');
    const adminName = getRequiredString(application.administrator.fullName, 'Administrator name');
    const adminEmail = getRequiredString(application.administrator.email, 'Administrator email')
      .trim()
      .toLowerCase();
    const passwordHash = getRequiredString(
      application.admin_password_hash,
      'Administrator password',
    );

    if (!emailPattern.test(adminEmail)) {
      throw new AppError(
        'Administrator email is not valid.',
        400,
        'CUSTOMER_ACTIVATION_ADMIN_EMAIL_INVALID',
      );
    }

    return {
      companyName,
      adminName,
      adminEmail,
      passwordHash,
    };
  }

  private async createOrEnableCustomerAccount(
    client: PoolClient,
    application: SalesApplicationRow,
    input: { companyName: string },
  ) {
    const result = await client.query<{
      id: string;
      registration_id: string;
      company_name: string;
      status: string;
      activated_at: Date | string;
    }>(
      `insert into customer_accounts (registration_id, company_name, status, activated_at)
       values ($1, $2, 'ACTIVE', now())
       on conflict (registration_id)
       do update set
         company_name = excluded.company_name,
         status = 'ACTIVE',
         updated_at = now()
       returning id, registration_id, company_name, status, activated_at`,
      [application.id, input.companyName],
    );

    const account = result.rows[0];
    if (!account) {
      throw new AppError(
        'Customer account could not be activated.',
        500,
        'CUSTOMER_ACCOUNT_ACTIVATION_FAILED',
      );
    }

    return {
      id: account.id,
      registrationId: account.registration_id,
      companyName: account.company_name,
      status: account.status,
      activatedAt: dateString(account.activated_at),
    };
  }

  private async createOrEnableCustomerAdministrator(
    client: PoolClient,
    accountId: string,
    input: { adminName: string; adminEmail: string; passwordHash: string },
  ) {
    const existing = await client.query<{
      id: string;
      customer_account_id: string;
    }>(
      `select id, customer_account_id
       from customer_users
       where lower(email) = lower($1)
       limit 1`,
      [input.adminEmail],
    );

    const existingUser = existing.rows[0];
    if (existingUser && existingUser.customer_account_id !== accountId) {
      throw new AppError(
        'Administrator email is already assigned to another customer account.',
        409,
        'CUSTOMER_ADMIN_EMAIL_ALREADY_EXISTS',
      );
    }

    const result = await client.query<{
      id: string;
      customer_account_id: string;
      name: string;
      email: string;
      role: string;
      is_active: boolean;
    }>(
      existingUser
        ? `update customer_users
           set name = $2,
               password_hash = $3,
               role = 'CUSTOMER_ADMIN',
               is_active = true,
               updated_at = now()
           where id = $1
           returning id, customer_account_id, name, email, role, is_active`
        : `insert into customer_users (
             customer_account_id,
             name,
             email,
             password_hash,
             role,
             is_active
           )
           values ($1, $2, $3, $4, 'CUSTOMER_ADMIN', true)
           returning id, customer_account_id, name, email, role, is_active`,
      existingUser
        ? [existingUser.id, input.adminName, input.passwordHash]
        : [accountId, input.adminName, input.adminEmail, input.passwordHash],
    );

    const user = result.rows[0];
    if (!user) {
      throw new AppError(
        'Customer administrator could not be activated.',
        500,
        'CUSTOMER_ADMIN_ACTIVATION_FAILED',
      );
    }

    return {
      id: user.id,
      customerAccountId: user.customer_account_id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
    };
  }

  private async getCustomerAccountForRegistration(client: PoolClient, registrationId: string) {
    const result = await client.query<{
      id: string;
      registration_id: string;
      company_name: string;
      status: string;
      activated_at: Date | string;
    }>(
      `select id, registration_id, company_name, status, activated_at
       from customer_accounts
       where registration_id = $1
       limit 1`,
      [registrationId],
    );

    const account = result.rows[0];
    if (!account) return null;

    return {
      id: account.id,
      registrationId: account.registration_id,
      companyName: account.company_name,
      status: account.status,
      activatedAt: dateString(account.activated_at),
    };
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

function getFilterOptionExpression(field: string) {
  const expressions: Record<string, string> = {
    reference: 'reference',
    company: "company->>'companyName'",
    contact: "contact->>'fullName'",
    contactEmail: "contact->>'email'",
    contactPhone: "contact->>'phone'",
  };

  const expression = expressions[field];
  if (!expression) {
    throw new AppError('Filter field is not supported.', 400, 'SALES_FILTER_FIELD_UNSUPPORTED');
  }

  return expression;
}

function getRequiredString(value: unknown, label: string) {
  if (typeof value === 'string' && value.trim()) return value.trim();

  throw new AppError(
    `${label} is required before activation.`,
    400,
    'CUSTOMER_ACTIVATION_REQUIRED_DATA_MISSING',
  );
}

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
    activatedAt: dateOrNull(row.activated_at ?? null),
    statusHistory: events.map((event) => ({
      id: event.id,
      previousStatus: event.previous_status,
      newStatus: event.new_status,
      reason: event.reason,
      changedBy: event.changed_by,
      changedByName: event.changed_by_name,
      changedByEmail: event.changed_by_email,
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
