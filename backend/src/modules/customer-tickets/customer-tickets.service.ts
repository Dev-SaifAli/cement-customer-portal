import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type {
  CreateCustomerTicketInput,
  ListCustomerTicketsQuery,
  ListSalesTicketsQuery,
  UpdateCustomerTicketDraftInput,
} from './customer-tickets.validation.js';
import {
  customerTicketEventDispatcher,
  type CustomerTicketEventActor,
  type CustomerTicketLifecycleEvent,
  type CustomerTicketLifecycleEventType,
} from './customer-ticket-events.dispatcher.js';

export type CustomerTicketStatus = 'DRAFT' | 'SUBMITTED' | 'OPEN' | 'CLOSED';
export type CrmHandoffStatus = 'NOT_SENT' | 'SENT';
type TicketEventType = CustomerTicketLifecycleEventType;

interface TicketRow {
  id: string;
  ticket_number: string;
  customer_account_id: string;
  customer_company_name: string | null;
  customer_user_id: string;
  customer_user_name: string | null;
  customer_user_email: string | null;
  customer_phone: string | null;
  description: string;
  customer_user_role: CustomerUser['role'];
  status: CustomerTicketStatus;
  crm_handoff_status: CrmHandoffStatus;
  sales_sent_at: Date | string | null;
  sales_user_id: string | null;
  sales_user_name: string | null;
  crm_response: string | null;
  crm_resolved_at: Date | string | null;
  crm_response_imported_by_sales_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface TicketEventRow {
  id: string;
  ticket_id: string;
  event_type: TicketEventType;
  previous_status: CustomerTicketStatus | null;
  new_status: CustomerTicketStatus | null;
  changed_by_customer_user_id: string | null;
  changed_by_customer_user_name: string | null;
  changed_by_customer_user_role: CustomerUser['role'] | null;
  changed_by_sales_user_id: string | null;
  changed_by_sales_user_name: string | null;
  event_data: Record<string, unknown> | string;
  created_at: Date | string;
}

const pageSize = 10;
const ticketNotFound = new AppError('Ticket was not found.', 404, 'CUSTOMER_TICKET_NOT_FOUND');
const customerTicketCreateRoles = new Set<CustomerUser['role']>([
  'CUSTOMER_ADMIN',
  'PURCHASER',
  'FINANCE_USER',
]);
const customerTicketDeleteRoles = new Set<CustomerUser['role']>([
  'CUSTOMER_ADMIN',
  'PURCHASER',
  'FINANCE_USER',
]);

export class CustomerTicketsService {
  async listForCustomer(customerUser: CustomerUser, query: ListCustomerTicketsQuery) {
    const values: unknown[] = [customerUser.customerAccountId];
    const clauses = ['customer_tickets.customer_account_id = $1'];
    if (!canViewAccountTickets(customerUser)) {
      values.push(customerUser.id);
      clauses.push(`customer_tickets.customer_user_id = $${values.length}`);
    }
    applyCustomerTicketFilters(query.filters, clauses, values);
    return this.listTickets(clauses, values, query.page);
  }

  async createForCustomer(customerUser: CustomerUser, input: CreateCustomerTicketInput) {
    if (!customerTicketCreateRoles.has(customerUser.role)) {
      throw new AppError(
        'Customer ticket creation is not permitted for this role.',
        403,
        'CUSTOMER_TICKET_CREATE_FORBIDDEN',
      );
    }

    const client = await pool.connect();
    let lifecycleEvent: CustomerTicketLifecycleEvent | null = null;
    try {
      await client.query('begin');
      const ticketNumber = await nextTicketNumber(client);
      const result = await client.query<TicketRow>(
        `insert into customer_tickets (
           ticket_number,
           customer_account_id,
           customer_user_id,
           customer_phone,
           description,
           customer_user_role,
           status,
           crm_handoff_status
         ) values ($1, $2, $3, $4, $5, $6, 'DRAFT', 'NOT_SENT')
         returning *`,
        [
          ticketNumber,
          customerUser.customerAccountId,
          customerUser.id,
          customerUser.phone,
          input.description,
          customerUser.role,
        ],
      );
      const ticket = result.rows[0];
      if (!ticket) {
        throw new AppError('Ticket could not be created.', 503, 'CUSTOMER_TICKET_CREATE_FAILED');
      }
      lifecycleEvent = await insertTicketEvent(client, {
        ticketId: ticket.id,
        ticketNumber,
        customerAccountId: customerUser.customerAccountId,
        customerCompanyName: customerUser.account.companyName,
        ticketCustomerUserId: customerUser.id,
        customerUserName: customerUser.name,
        customerUserEmail: customerUser.email,
        customerUserPhone: customerUser.phone,
        customerUserRole: customerUser.role,
        eventType: 'TICKET_CREATED',
        previousStatus: null,
        newStatus: 'DRAFT',
        previousCrmHandoffStatus: null,
        newCrmHandoffStatus: 'NOT_SENT',
        actor: customerTicketActor(customerUser),
        changedByCustomerUserId: customerUser.id,
        salesUserId: null,
        eventData: {
          ticketNumber,
          customerAccountId: customerUser.customerAccountId,
          customerUserRole: customerUser.role,
        },
      });
      await client.query('commit');
      await dispatchTicketLifecycleEvent(lifecycleEvent);
      return this.getForCustomer(customerUser, ticket.id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getForCustomer(customerUser: CustomerUser, ticketId: string) {
    const values: unknown[] = [ticketId, customerUser.customerAccountId];
    const creatorClause = canViewAccountTickets(customerUser)
      ? ''
      : `and customer_tickets.customer_user_id = $${values.push(customerUser.id)}`;
    const result = await pool.query<TicketRow>(
      `${ticketReadSql}
       where customer_tickets.id = $1
         and customer_tickets.customer_account_id = $2
         ${creatorClause}
       limit 1`,
      values,
    );
    const row = result.rows[0];
    if (!row) throw ticketNotFound;
    return {
      ...mapTicket(row),
      events: await listTicketEvents(ticketId),
    };
  }

  async updateDraftForCustomer(
    customerUser: CustomerUser,
    ticketId: string,
    input: UpdateCustomerTicketDraftInput,
  ) {
    if (!customerTicketCreateRoles.has(customerUser.role)) {
      throw new AppError(
        'Customer ticket update is not permitted for this role.',
        403,
        'CUSTOMER_TICKET_UPDATE_FORBIDDEN',
      );
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      const currentResult = await client.query<TicketRow>(
        `${ticketReadSql}
         where customer_tickets.id = $1
           and customer_tickets.customer_account_id = $2
         for update of customer_tickets`,
        [ticketId, customerUser.customerAccountId],
      );
      const current = currentResult.rows[0];
      if (!current) throw ticketNotFound;
      if (current.customer_user_id !== customerUser.id) {
        throw new AppError(
          'Only the ticket creator can update this draft ticket.',
          403,
          'CUSTOMER_TICKET_UPDATE_FORBIDDEN',
        );
      }
      if (current.status !== 'DRAFT') {
        throw new AppError(
          'Only draft tickets can be updated.',
          409,
          'CUSTOMER_TICKET_UPDATE_STATUS_INVALID',
        );
      }

      const updatedResult = await client.query<TicketRow>(
        `update customer_tickets
         set description = $2,
             updated_at = now()
         where id = $1
         returning *`,
        [ticketId, input.description],
      );
      const updated = updatedResult.rows[0];
      if (!updated) {
        throw new AppError('Ticket could not be updated.', 503, 'CUSTOMER_TICKET_UPDATE_FAILED');
      }
      await client.query('commit');
      return this.getForCustomer(customerUser, ticketId);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async submitForCustomer(customerUser: CustomerUser, ticketId: string) {
    if (!customerTicketCreateRoles.has(customerUser.role)) {
      throw new AppError(
        'Customer ticket submission is not permitted for this role.',
        403,
        'CUSTOMER_TICKET_SUBMIT_FORBIDDEN',
      );
    }

    const client = await pool.connect();
    let lifecycleEvent: CustomerTicketLifecycleEvent | null = null;
    try {
      await client.query('begin');
      const currentResult = await client.query<TicketRow>(
        `${ticketReadSql}
         where customer_tickets.id = $1
           and customer_tickets.customer_account_id = $2
         for update of customer_tickets`,
        [ticketId, customerUser.customerAccountId],
      );
      const current = currentResult.rows[0];
      if (!current) throw ticketNotFound;
      if (current.customer_user_id !== customerUser.id) {
        throw new AppError(
          'Only the ticket creator can submit this draft ticket.',
          403,
          'CUSTOMER_TICKET_SUBMIT_FORBIDDEN',
        );
      }
      if (current.status !== 'DRAFT') {
        throw new AppError(
          'Only draft tickets can be submitted.',
          409,
          'CUSTOMER_TICKET_SUBMIT_STATUS_INVALID',
        );
      }
      if (current.crm_handoff_status !== 'NOT_SENT') {
        throw new AppError(
          'Ticket has already been sent to CRM.',
          409,
          'CUSTOMER_TICKET_ALREADY_SENT_TO_CRM',
        );
      }

      const updatedResult = await client.query<TicketRow>(
        `update customer_tickets
         set status = 'SUBMITTED',
             updated_at = now()
         where id = $1
         returning *`,
        [ticketId],
      );
      const updated = updatedResult.rows[0];
      if (!updated) {
        throw new AppError('Ticket could not be submitted.', 503, 'CUSTOMER_TICKET_UPDATE_FAILED');
      }

      lifecycleEvent = await insertTicketEvent(client, {
        ticketId,
        ticketNumber: current.ticket_number,
        customerAccountId: current.customer_account_id,
        customerCompanyName: current.customer_company_name,
        ticketCustomerUserId: current.customer_user_id,
        customerUserName: current.customer_user_name,
        customerUserEmail: current.customer_user_email,
        customerUserPhone: current.customer_phone,
        customerUserRole: current.customer_user_role,
        eventType: 'TICKET_SUBMITTED',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
        previousCrmHandoffStatus: 'NOT_SENT',
        newCrmHandoffStatus: 'NOT_SENT',
        actor: customerTicketActor(customerUser),
        changedByCustomerUserId: customerUser.id,
        salesUserId: null,
        eventData: {
          ticketNumber: current.ticket_number,
          description: current.description,
          previousCrmHandoffStatus: 'NOT_SENT',
          newCrmHandoffStatus: 'NOT_SENT',
        },
      });
      await client.query('commit');
      await dispatchTicketLifecycleEvent(lifecycleEvent);
      return this.getForCustomer(customerUser, ticketId);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteForCustomer(customerUser: CustomerUser, ticketId: string) {
    if (!customerTicketDeleteRoles.has(customerUser.role)) {
      throw new AppError(
        'Customer ticket deletion is not permitted for this role.',
        403,
        'CUSTOMER_TICKET_DELETE_FORBIDDEN',
      );
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      const currentResult = await client.query<TicketRow>(
        `${ticketReadSql}
         where customer_tickets.id = $1
           and customer_tickets.customer_account_id = $2
         for update of customer_tickets`,
        [ticketId, customerUser.customerAccountId],
      );
      const current = currentResult.rows[0];
      if (!current) throw ticketNotFound;
      if (!['DRAFT', 'CLOSED'].includes(current.status)) {
        throw new AppError(
          'Only draft or closed tickets can be deleted.',
          409,
          'CUSTOMER_TICKET_DELETE_STATUS_INVALID',
        );
      }
      if (current.status === 'DRAFT' && current.customer_user_id !== customerUser.id) {
        throw new AppError(
          'Only the ticket creator can delete this draft ticket.',
          403,
          'CUSTOMER_TICKET_DELETE_FORBIDDEN',
        );
      }

      await client.query('delete from customer_tickets where id = $1', [ticketId]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async listForSales(query: ListSalesTicketsQuery) {
    const values: unknown[] = [];
    const clauses: string[] = [`customer_tickets.status <> 'DRAFT'`];
    if (query.status) {
      values.push(query.status);
      clauses.push(`customer_tickets.status = $${values.length}`);
    }
    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      clauses.push(`(
        lower(customer_tickets.ticket_number) like $${values.length}
        or lower(customer_tickets.description) like $${values.length}
        or lower(coalesce(customer_accounts.company_name, '')) like $${values.length}
        or lower(coalesce(customer_users.name, '')) like $${values.length}
      )`);
    }
    applySalesTicketFilters(query.filters, clauses, values);
    return this.listTickets(clauses, values, query.page);
  }

  async getForSales(ticketId: string) {
    const result = await pool.query<TicketRow>(
      `${ticketReadSql}
       where customer_tickets.id = $1
         and customer_tickets.status <> 'DRAFT'
       limit 1`,
      [ticketId],
    );
    const row = result.rows[0];
    if (!row) throw ticketNotFound;
    return {
      ...mapTicket(row),
      events: await listTicketEvents(ticketId),
    };
  }

  async sendToCrm(ticketId: string, salesUser: SalesUser) {
    const client = await pool.connect();
    let lifecycleEvent: CustomerTicketLifecycleEvent | null = null;
    try {
      await client.query('begin');
      const currentResult = await client.query<TicketRow>(
        `${ticketReadSql}
         where customer_tickets.id = $1
         for update of customer_tickets`,
        [ticketId],
      );
      const current = currentResult.rows[0];
      if (!current) throw ticketNotFound;
      if (current.status !== 'SUBMITTED') {
        throw new AppError(
          'Only submitted tickets can be sent to CRM.',
          409,
          'CUSTOMER_TICKET_STATUS_INVALID',
        );
      }
      if (current.crm_handoff_status !== 'NOT_SENT') {
        throw new AppError(
          'Ticket has already been sent to CRM.',
          409,
          'CUSTOMER_TICKET_ALREADY_SENT_TO_CRM',
        );
      }

      const updatedResult = await client.query<TicketRow>(
        `update customer_tickets
         set status = 'OPEN',
             crm_handoff_status = 'SENT',
             sales_sent_at = now(),
             sales_user_id = $2,
             updated_at = now()
         where id = $1
         returning *`,
        [ticketId, salesUser.id],
      );
      const updated = updatedResult.rows[0];
      if (!updated) {
        throw new AppError('Ticket could not be updated.', 503, 'CUSTOMER_TICKET_UPDATE_FAILED');
      }
      lifecycleEvent = await insertTicketEvent(client, {
        ticketId,
        ticketNumber: current.ticket_number,
        customerAccountId: current.customer_account_id,
        customerCompanyName: current.customer_company_name,
        ticketCustomerUserId: current.customer_user_id,
        customerUserName: current.customer_user_name,
        customerUserEmail: current.customer_user_email,
        customerUserPhone: current.customer_phone,
        customerUserRole: current.customer_user_role,
        eventType: 'TICKET_SENT_TO_CRM',
        previousStatus: 'SUBMITTED',
        newStatus: 'OPEN',
        previousCrmHandoffStatus: 'NOT_SENT',
        newCrmHandoffStatus: 'SENT',
        actor: salesTicketActor(salesUser),
        changedByCustomerUserId: null,
        salesUserId: salesUser.id,
        eventData: {
          ticketNumber: current.ticket_number,
          salesUserId: salesUser.id,
          previousCrmHandoffStatus: 'NOT_SENT',
          newCrmHandoffStatus: 'SENT',
        },
      });
      await client.query('commit');
      await dispatchTicketLifecycleEvent(lifecycleEvent);
      return this.getForSales(ticketId);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async listTickets(clauses: string[], values: unknown[], page: number) {
    const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const countResult = await pool.query<{ total: string }>(
      `select count(*)::text as total ${ticketJoinSql} ${where}`,
      values,
    );
    const offset = (page - 1) * pageSize;
    const listValues = [...values, pageSize, offset];
    const result = await pool.query<TicketRow>(
      `${ticketReadSql}
       ${where}
       order by customer_tickets.created_at desc
       limit $${listValues.length - 1} offset $${listValues.length}`,
      listValues,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    return {
      items: result.rows.map(mapTicket),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}

export const customerTicketsService = new CustomerTicketsService();

function canViewAccountTickets(customerUser: CustomerUser) {
  return customerUser.role === 'CUSTOMER_ADMIN';
}

function applyCustomerTicketFilters(
  filters: ListCustomerTicketsQuery['filters'],
  clauses: string[],
  values: unknown[],
) {
  filters.forEach((filter) => {
    if (filter.field === 'ticketNumber') {
      if (filter.condition === 'equals') {
        values.push(filter.value);
        clauses.push(`customer_tickets.ticket_number = $${values.length}`);
      } else if (filter.condition === 'contains') {
        values.push(`%${filter.value.toLowerCase()}%`);
        clauses.push(`lower(customer_tickets.ticket_number) like $${values.length}`);
      }
      return;
    }

    if (filter.field === 'description' && filter.condition === 'contains') {
      values.push(`%${filter.value.toLowerCase()}%`);
      clauses.push(`lower(customer_tickets.description) like $${values.length}`);
      return;
    }

    if (filter.field === 'status' && filter.condition === 'equals') {
      values.push(filter.value);
      clauses.push(`customer_tickets.status = $${values.length}`);
      return;
    }

    if (filter.field === 'crmHandoff' && filter.condition === 'equals') {
      values.push(filter.value);
      clauses.push(`customer_tickets.crm_handoff_status = $${values.length}`);
      return;
    }

    if (filter.field === 'createdBy' && filter.condition === 'equals') {
      values.push(filter.value);
      clauses.push(`customer_tickets.customer_user_id = $${values.length}`);
      return;
    }

    if (filter.field === 'createdDate') {
      applyDateFilter('customer_tickets.created_at', filter, clauses, values);
      return;
    }

    if (filter.field === 'updatedDate') {
      applyDateFilter('customer_tickets.updated_at', filter, clauses, values);
    }
  });
}

function applySalesTicketFilters(
  filters: ListSalesTicketsQuery['filters'],
  clauses: string[],
  values: unknown[],
) {
  filters.forEach((filter) => {
    if (filter.field === 'ticketNumber') {
      if (filter.condition === 'equals') {
        values.push(filter.value);
        clauses.push(`customer_tickets.ticket_number = $${values.length}`);
      } else if (filter.condition === 'contains') {
        values.push(`%${filter.value.toLowerCase()}%`);
        clauses.push(`lower(customer_tickets.ticket_number) like $${values.length}`);
      }
      return;
    }

    if (filter.field === 'description' && filter.condition === 'contains') {
      values.push(`%${filter.value.toLowerCase()}%`);
      clauses.push(`lower(customer_tickets.description) like $${values.length}`);
      return;
    }

    if (filter.field === 'status' && filter.condition === 'equals') {
      values.push(filter.value);
      clauses.push(`customer_tickets.status = $${values.length}`);
      return;
    }

    if (filter.field === 'crmHandoff' && filter.condition === 'equals') {
      values.push(filter.value);
      clauses.push(`customer_tickets.crm_handoff_status = $${values.length}`);
      return;
    }

    if (filter.field === 'customer') {
      if (filter.condition === 'equals') {
        values.push(filter.value);
        clauses.push(`(
          customer_tickets.customer_account_id::text = $${values.length}
          or lower(coalesce(customer_accounts.company_name, '')) = lower($${values.length})
        )`);
      } else if (filter.condition === 'contains') {
        values.push(`%${filter.value.toLowerCase()}%`);
        clauses.push(`lower(coalesce(customer_accounts.company_name, '')) like $${values.length}`);
      }
      return;
    }

    if (filter.field === 'createdDate') {
      applyDateFilter('customer_tickets.created_at', filter, clauses, values);
    }
  });
}

function applyDateFilter(
  column: 'customer_tickets.created_at' | 'customer_tickets.updated_at',
  filter: {
    condition: 'equals' | 'contains' | 'before' | 'after' | 'between';
    value: string;
    valueTo?: string | undefined;
  },
  clauses: string[],
  values: unknown[],
) {
  if (filter.condition === 'before') {
    values.push(filter.value);
    clauses.push(`${column} < $${values.length}::date`);
  } else if (filter.condition === 'after') {
    values.push(filter.value);
    clauses.push(`${column} >= ($${values.length}::date + interval '1 day')`);
  } else if (filter.condition === 'between' && filter.valueTo) {
    values.push(filter.value);
    const startIndex = values.length;
    values.push(filter.valueTo);
    clauses.push(`${column} >= $${startIndex}::date and ${column} < ($${values.length}::date + interval '1 day')`);
  }
}

const ticketJoinSql = `from customer_tickets
 left join customer_accounts on customer_accounts.id = customer_tickets.customer_account_id
 left join customer_users on customer_users.id = customer_tickets.customer_user_id
 left join sales_users on sales_users.id = customer_tickets.sales_user_id`;

const ticketReadSql = `select customer_tickets.*,
  customer_accounts.company_name as customer_company_name,
  customer_users.name as customer_user_name,
  customer_users.email as customer_user_email,
  sales_users.name as sales_user_name
 ${ticketJoinSql}`;

async function nextTicketNumber(client: PoolClient) {
  const result = await client.query<{ sequence: string }>(
    `select nextval('ticket_reference_seq')::text as sequence`,
  );
  const sequence = String(result.rows[0]?.sequence ?? '1').padStart(6, '0');
  return `TKT-${new Date().getFullYear()}-${sequence}`;
}

async function insertTicketEvent(
  client: PoolClient,
  input: {
    ticketId: string;
    ticketNumber: string;
    customerAccountId: string;
    customerCompanyName: string | null;
    ticketCustomerUserId: string;
    customerUserName: string | null;
    customerUserEmail: string | null;
    customerUserPhone: string | null;
    customerUserRole: CustomerUser['role'];
    eventType: TicketEventType;
    previousStatus: CustomerTicketStatus | null;
    newStatus: CustomerTicketStatus | null;
    previousCrmHandoffStatus: CrmHandoffStatus | null;
    newCrmHandoffStatus: CrmHandoffStatus | null;
    actor: CustomerTicketEventActor | null;
    changedByCustomerUserId: string | null;
    salesUserId: string | null;
    eventData: Record<string, unknown>;
  },
) {
  const result = await client.query<{ created_at: Date | string }>(
    `insert into customer_ticket_events (
       ticket_id,
       event_type,
       previous_status,
       new_status,
       changed_by_customer_user_id,
       changed_by_sales_user_id,
       event_data
     ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning created_at`,
    [
      input.ticketId,
      input.eventType,
      input.previousStatus,
      input.newStatus,
      input.changedByCustomerUserId,
      input.salesUserId,
      JSON.stringify(input.eventData),
    ],
  );

  return {
    type: input.eventType,
    ticketId: input.ticketId,
    ticketNumber: input.ticketNumber,
    customerAccountId: input.customerAccountId,
    customerCompanyName: input.customerCompanyName,
    customerUserId: input.ticketCustomerUserId,
    customerUserName: input.customerUserName,
    customerUserEmail: input.customerUserEmail,
    customerUserPhone: input.customerUserPhone,
    customerUserRole: input.customerUserRole,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    previousCrmHandoffStatus: input.previousCrmHandoffStatus,
    newCrmHandoffStatus: input.newCrmHandoffStatus,
    actor: input.actor,
    occurredAt: dateTime(result.rows[0]?.created_at ?? null) ?? new Date().toISOString(),
    metadata: input.eventData,
  };
}

async function dispatchTicketLifecycleEvent(event: CustomerTicketLifecycleEvent | null) {
  if (!event) return;
  await customerTicketEventDispatcher.dispatch(event);
}

function customerTicketActor(customerUser: CustomerUser): CustomerTicketEventActor {
  return {
    kind: 'CUSTOMER',
    id: customerUser.id,
    name: customerUser.name,
    role: customerUser.role,
  };
}

function salesTicketActor(salesUser: SalesUser): CustomerTicketEventActor {
  return {
    kind: 'SALES',
    id: salesUser.id,
    name: salesUser.name,
    role: salesUser.role,
  };
}

function mapTicket(row: TicketRow) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    customer: {
      accountId: row.customer_account_id,
      companyName: row.customer_company_name,
    },
    customerUser: {
      id: row.customer_user_id,
      name: row.customer_user_name,
      email: row.customer_user_email,
      phone: row.customer_phone,
      role: row.customer_user_role,
    },
    createdBy: {
      id: row.customer_user_id,
      name: row.customer_user_name,
      email: row.customer_user_email,
      role: row.customer_user_role,
    },
    description: row.description,
    status: row.status,
    crmHandoffStatus: row.crm_handoff_status,
    crmResponse: row.crm_response,
    crmResolvedAt: dateTime(row.crm_resolved_at),
    sales: row.sales_user_id
      ? {
          sentAt: dateTime(row.sales_sent_at),
          userId: row.sales_user_id,
          userName: row.sales_user_name,
        }
      : null,
    createdAt: dateTime(row.created_at),
    updatedAt: dateTime(row.updated_at),
  };
}

async function listTicketEvents(ticketId: string) {
  const result = await pool.query<TicketEventRow>(
    `select customer_ticket_events.*,
            customer_users.name as changed_by_customer_user_name,
            customer_users.role as changed_by_customer_user_role,
            sales_users.name as changed_by_sales_user_name
     from customer_ticket_events
     left join customer_users
       on customer_users.id = customer_ticket_events.changed_by_customer_user_id
     left join sales_users
       on sales_users.id = customer_ticket_events.changed_by_sales_user_id
     where customer_ticket_events.ticket_id = $1
     order by customer_ticket_events.created_at asc`,
    [ticketId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    type: row.event_type,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    actor: row.changed_by_customer_user_id
      ? {
          kind: 'CUSTOMER' as const,
          id: row.changed_by_customer_user_id,
          name: row.changed_by_customer_user_name,
          role: row.changed_by_customer_user_role,
        }
      : row.changed_by_sales_user_id
        ? {
            kind: 'SALES' as const,
            id: row.changed_by_sales_user_id,
            name: row.changed_by_sales_user_name,
            role: null,
          }
        : null,
    data: normalizeEventData(row.event_data),
    createdAt: dateTime(row.created_at),
  }));
}

function normalizeEventData(value: Record<string, unknown> | string) {
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function dateTime(value: Date | string | null) {
  return value ? new Date(String(value)).toISOString() : null;
}
