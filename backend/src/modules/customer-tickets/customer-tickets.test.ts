import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-ticket-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { connect, poolQuery, clientQuery, release } = vi.hoisted(() => ({
  connect: vi.fn(),
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock('../../database/pool.js', () => ({
  pool: { query: poolQuery, connect },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { emailService } from '../email/email.service.js';
import { handleCustomerTicketEmailEvent } from './customer-ticket-email-notifications.js';
import {
  customerTicketEventDispatcher,
  type CustomerTicketLifecycleEvent,
} from './customer-ticket-events.dispatcher.js';

const customerUserId = '11111111-1111-4111-8111-111111111111';
const otherCustomerUserId = '99999999-9999-4999-8999-999999999999';
const customerAccountId = '22222222-2222-4222-8222-222222222222';
const otherCustomerAccountId = '33333333-3333-4333-8333-333333333333';
const salesUserId = '44444444-4444-4444-8444-444444444444';
const ticketId = '55555555-5555-4555-8555-555555555555';

const authenticatedCustomerUserRow = {
  id: customerUserId,
  customer_account_id: customerAccountId,
  name: 'Customer Admin',
  email: 'admin@example.com',
  phone: '+966555000111',
  password_hash: 'hashed-password',
  role: 'CUSTOMER_ADMIN',
  is_active: true,
  password_must_change: false,
  registration_id: '77777777-7777-4777-8777-777777777777',
  company_name: 'Activated Cement Customer',
  account_status: 'ACTIVE',
  application_status: 'ACTIVATED',
};

const salesUserRow = {
  id: salesUserId,
  name: 'Sales Reviewer',
  email: 'sales@example.com',
  password_hash: 'hash',
  is_active: true,
  role: 'SALES_REP',
};

const ticketRow = {
  id: ticketId,
  ticket_number: 'TKT-2026-000001',
  customer_account_id: customerAccountId,
  customer_company_name: 'Activated Cement Customer',
  customer_user_id: customerUserId,
  customer_user_name: 'Customer Admin',
  customer_user_email: 'admin@example.com',
  customer_phone: '+966555000111',
  description: 'Need support for a delivery issue.',
  customer_user_role: 'CUSTOMER_ADMIN',
  status: 'DRAFT',
  crm_handoff_status: 'NOT_SENT',
  sales_sent_at: null,
  sales_user_id: null,
  sales_user_name: null,
  crm_response: null,
  crm_resolved_at: null,
  crm_response_imported_by_sales_user_id: null,
  created_at: '2026-09-01T08:00:00.000Z',
  updated_at: '2026-09-01T08:00:00.000Z',
};

const ticketCreatedEventRow = {
  id: '66666666-6666-4666-8666-666666666666',
  ticket_id: ticketId,
  event_type: 'TICKET_CREATED',
  previous_status: null,
  new_status: 'DRAFT',
  changed_by_customer_user_id: customerUserId,
  changed_by_customer_user_name: 'Customer Admin',
  changed_by_customer_user_role: 'CUSTOMER_ADMIN',
  changed_by_sales_user_id: null,
  changed_by_sales_user_name: null,
  event_data: { ticketNumber: 'TKT-2026-000001' },
  created_at: '2026-09-01T08:00:00.000Z',
};

function createSignedToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${header}.${encodedPayload}`)
    .digest('base64url');

  return `${header}.${encodedPayload}.${signature}`;
}

function createCustomerToken(sub = customerUserId) {
  const now = Math.floor(Date.now() / 1000);
  return createSignedToken({ sub, type: 'customer', iat: now, exp: now + 3600 });
}

function createSalesToken() {
  const now = Math.floor(Date.now() / 1000);
  return createSignedToken({ sub: salesUserId, type: 'sales', iat: now, exp: now + 3600 });
}

describe('customer tickets API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('allows an authenticated customer to create a ticket with server-owned account scope', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("nextval('ticket_reference_seq')")) {
        return Promise.resolve({ rows: [{ sequence: '1' }] });
      }
      if (sql.includes('insert into customer_tickets')) {
        return Promise.resolve({ rows: [ticketRow] });
      }
      return Promise.resolve({ rows: [] });
    });
    poolQuery
      .mockResolvedValueOnce({ rows: [ticketRow] })
      .mockResolvedValueOnce({ rows: [ticketCreatedEventRow] });

    const response = await request(createApp())
      .post('/api/v1/customer/tickets')
      .set('Cookie', `customer_session=${createCustomerToken()}`)
      .send({
        customerAccountId: otherCustomerAccountId,
        description: 'Need support for a delivery issue.',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.ticket).toMatchObject({
      ticketNumber: 'TKT-2026-000001',
      status: 'DRAFT',
      crmHandoffStatus: 'NOT_SENT',
      customer: { accountId: customerAccountId },
      createdBy: {
        id: customerUserId,
        name: 'Customer Admin',
        role: 'CUSTOMER_ADMIN',
      },
    });
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('insert into customer_tickets'),
      [
        'TKT-2026-000001',
        customerAccountId,
        customerUserId,
        '+966555000111',
        'Need support for a delivery issue.',
        'CUSTOMER_ADMIN',
      ],
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('insert into customer_ticket_events'),
      expect.arrayContaining([ticketId, 'TICKET_CREATED', null, 'DRAFT', customerUserId, null]),
    );
  });

  it('allows the ticket creator to submit a draft ticket to Sales', async () => {
    const dispatchedEvents: CustomerTicketLifecycleEvent[] = [];
    const unsubscribe = customerTicketEventDispatcher.subscribe((event) => {
      dispatchedEvents.push(event);
    });
    const submittedTicket = {
      ...ticketRow,
      status: 'SUBMITTED',
      crm_handoff_status: 'NOT_SENT',
      updated_at: '2026-09-01T09:00:00.000Z',
    };
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [ticketRow] })
      .mockResolvedValueOnce({ rows: [submittedTicket] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    poolQuery
      .mockResolvedValueOnce({ rows: [submittedTicket] })
      .mockResolvedValueOnce({
        rows: [
          ticketCreatedEventRow,
          {
            ...ticketCreatedEventRow,
            id: '77777777-7777-4777-8777-777777777777',
            event_type: 'TICKET_SUBMITTED',
            previous_status: 'DRAFT',
            new_status: 'SUBMITTED',
            created_at: '2026-09-01T09:00:00.000Z',
          },
        ],
      });

    const response = await request(createApp())
      .post(`/api/v1/customer/tickets/${ticketId}/submit`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);
    unsubscribe();

    expect(response.status).toBe(200);
    expect(response.body.data.ticket).toMatchObject({
      id: ticketId,
      status: 'SUBMITTED',
      crmHandoffStatus: 'NOT_SENT',
    });
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("set status = 'SUBMITTED'"),
      [ticketId],
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('insert into customer_ticket_events'),
      expect.arrayContaining([
        ticketId,
        'TICKET_SUBMITTED',
        'DRAFT',
        'SUBMITTED',
        customerUserId,
        null,
      ]),
    );
    expect(dispatchedEvents).toEqual([
      expect.objectContaining({
        type: 'TICKET_SUBMITTED',
        ticketId,
        ticketNumber: 'TKT-2026-000001',
        customerAccountId,
        customerUserId,
        customerUserRole: 'CUSTOMER_ADMIN',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
        previousCrmHandoffStatus: 'NOT_SENT',
        newCrmHandoffStatus: 'NOT_SENT',
        actor: expect.objectContaining({
          kind: 'CUSTOMER',
          id: customerUserId,
          name: 'Customer Admin',
          role: 'CUSTOMER_ADMIN',
        }),
      }),
    ]);
  });

  it('allows a customer to list only tickets for their own account', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [ticketRow] });

    const response = await request(createApp())
      .get('/api/v1/customer/tickets?page=1')
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    expect(poolQuery.mock.calls[1]?.[1]).toEqual([customerAccountId]);
  });

  it('allows Customer Admin to list all tickets for their own account', async () => {
    const purchaserTicketRow = {
      ...ticketRow,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ticket_number: 'TKT-2026-000002',
      customer_user_id: otherCustomerUserId,
      customer_user_name: 'Purchaser A',
      customer_user_email: 'purchaser@example.com',
      customer_user_role: 'PURCHASER',
    };
    poolQuery
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({ rows: [ticketRow, purchaserTicketRow] });

    const response = await request(createApp())
      .get('/api/v1/customer/tickets?page=1')
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[1].createdBy).toMatchObject({
      id: otherCustomerUserId,
      name: 'Purchaser A',
      role: 'PURCHASER',
    });
    expect(poolQuery.mock.calls[1]?.[1]).toEqual([customerAccountId]);
  });

  it('limits Purchaser ticket list visibility to tickets they created', async () => {
    poolQuery
      .mockResolvedValueOnce({
        rows: [{ ...authenticatedCustomerUserRow, role: 'PURCHASER', name: 'Purchaser A' }],
      })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ ...ticketRow, customer_user_role: 'PURCHASER' }] });

    const response = await request(createApp())
      .get('/api/v1/customer/tickets?page=1')
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(poolQuery.mock.calls[1]?.[1]).toEqual([customerAccountId, customerUserId]);
  });

  it('applies customer ticket filters with parameterized query values', async () => {
    const filters = encodeURIComponent(
      JSON.stringify([
        { field: 'status', condition: 'equals', value: 'OPEN' },
        { field: 'ticketNumber', condition: 'contains', value: 'TKT-2026' },
      ]),
    );
    poolQuery
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ ...ticketRow, status: 'OPEN' }] });

    const response = await request(createApp())
      .get(`/api/v1/customer/tickets?page=1&filters=${filters}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(200);
    expect(poolQuery.mock.calls[1]?.[0]).toContain('customer_tickets.status = $2');
    expect(poolQuery.mock.calls[1]?.[0]).toContain('lower(customer_tickets.ticket_number) like $3');
    expect(poolQuery.mock.calls[1]?.[1]).toEqual([customerAccountId, 'OPEN', '%tkt-2026%']);
  });

  it('combines non-admin creator visibility with created-by filters safely', async () => {
    const filters = encodeURIComponent(
      JSON.stringify([{ field: 'createdBy', condition: 'equals', value: otherCustomerUserId }]),
    );
    poolQuery
      .mockResolvedValueOnce({
        rows: [{ ...authenticatedCustomerUserRow, role: 'FINANCE_USER', name: 'Finance A' }],
      })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .get(`/api/v1/customer/tickets?page=1&filters=${filters}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
    expect(poolQuery.mock.calls[1]?.[1]).toEqual([
      customerAccountId,
      customerUserId,
      otherCustomerUserId,
    ]);
  });

  it('does not expose another customer ticket through direct ID access', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .get(`/api/v1/customer/tickets/${ticketId}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CUSTOMER_TICKET_NOT_FOUND');
    expect(poolQuery.mock.calls[1]?.[1]).toEqual([ticketId, customerAccountId]);
  });

  it('does not expose another customer user ticket to Purchaser through direct ID access', async () => {
    poolQuery
      .mockResolvedValueOnce({
        rows: [{ ...authenticatedCustomerUserRow, role: 'PURCHASER', name: 'Purchaser A' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .get(`/api/v1/customer/tickets/${ticketId}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CUSTOMER_TICKET_NOT_FOUND');
    expect(poolQuery.mock.calls[1]?.[1]).toEqual([ticketId, customerAccountId, customerUserId]);
  });

  it('prevents a Viewer from creating a ticket', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ ...authenticatedCustomerUserRow, role: 'VIEWER' }],
    });

    const response = await request(createApp())
      .post('/api/v1/customer/tickets')
      .set('Cookie', `customer_session=${createCustomerToken()}`)
      .send({ description: 'Please help.' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CUSTOMER_TICKET_CREATE_FORBIDDEN');
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects blank ticket descriptions', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });

    const response = await request(createApp())
      .post('/api/v1/customer/tickets')
      .set('Cookie', `customer_session=${createCustomerToken()}`)
      .send({ description: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(connect).not.toHaveBeenCalled();
  });

  it('allows permitted customer users to delete closed tickets from their own account', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...ticketRow, status: 'CLOSED' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .delete(`/api/v1/customer/tickets/${ticketId}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(204);
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('for update of customer_tickets'),
      [ticketId, customerAccountId],
    );
    expect(clientQuery).toHaveBeenCalledWith('delete from customer_tickets where id = $1', [
      ticketId,
    ]);
    expect(clientQuery).toHaveBeenCalledWith('commit');
  });

  it('allows the ticket creator to delete a draft ticket from their own account', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [ticketRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .delete(`/api/v1/customer/tickets/${ticketId}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(204);
    expect(clientQuery).toHaveBeenCalledWith('delete from customer_tickets where id = $1', [
      ticketId,
    ]);
    expect(clientQuery).toHaveBeenCalledWith('commit');
  });

  it('prevents deleting submitted tickets', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...ticketRow, status: 'SUBMITTED' }] });

    const response = await request(createApp())
      .delete(`/api/v1/customer/tickets/${ticketId}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CUSTOMER_TICKET_DELETE_STATUS_INVALID');
    expect(clientQuery).not.toHaveBeenCalledWith(
      'delete from customer_tickets where id = $1',
      expect.any(Array),
    );
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });

  it('prevents deleting open tickets', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...ticketRow, status: 'OPEN' }] });

    const response = await request(createApp())
      .delete(`/api/v1/customer/tickets/${ticketId}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CUSTOMER_TICKET_DELETE_STATUS_INVALID');
    expect(clientQuery).not.toHaveBeenCalledWith(
      'delete from customer_tickets where id = $1',
      expect.any(Array),
    );
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });

  it('prevents Viewer users from deleting tickets', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ ...authenticatedCustomerUserRow, role: 'VIEWER' }],
    });

    const response = await request(createApp())
      .delete(`/api/v1/customer/tickets/${ticketId}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CUSTOMER_TICKET_DELETE_FORBIDDEN');
    expect(connect).not.toHaveBeenCalled();
  });

  it('does not delete another customer account ticket through direct ID access', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .delete(`/api/v1/customer/tickets/${ticketId}`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CUSTOMER_TICKET_NOT_FOUND');
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('for update of customer_tickets'),
      [ticketId, customerAccountId],
    );
    expect(clientQuery).not.toHaveBeenCalledWith(
      'delete from customer_tickets where id = $1',
      expect.any(Array),
    );
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });
});

describe('sales ticket API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('allows Sales Rep to view tickets', async () => {
    const openTicket = { ...ticketRow, status: 'OPEN' };
    poolQuery
      .mockResolvedValueOnce({ rows: [salesUserRow] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [openTicket] });

    const response = await request(createApp())
      .get('/api/v1/sales/tickets?page=1')
      .set('Authorization', `Bearer ${createSalesToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toMatchObject({
      id: ticketId,
      ticketNumber: 'TKT-2026-000001',
      status: 'OPEN',
    });
    expect(poolQuery.mock.calls[1]?.[0]).toContain("customer_tickets.status <> 'DRAFT'");
  });

  it('applies Sales ticket filters with AND conditions safely', async () => {
    const filters = encodeURIComponent(
      JSON.stringify([
        { field: 'status', condition: 'equals', value: 'OPEN' },
        { field: 'crmHandoff', condition: 'equals', value: 'SENT' },
        { field: 'customer', condition: 'contains', value: 'Activated' },
        { field: 'createdDate', condition: 'after', value: '2026-09-01' },
      ]),
    );
    poolQuery
      .mockResolvedValueOnce({ rows: [salesUserRow] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [{ ...ticketRow, status: 'OPEN', crm_handoff_status: 'SENT' }],
      });

    const response = await request(createApp())
      .get(`/api/v1/sales/tickets?page=1&filters=${filters}`)
      .set('Authorization', `Bearer ${createSalesToken()}`);

    expect(response.status).toBe(200);
    expect(poolQuery.mock.calls[1]?.[0]).toContain("customer_tickets.status <> 'DRAFT'");
    expect(poolQuery.mock.calls[1]?.[0]).toContain('customer_tickets.status = $1');
    expect(poolQuery.mock.calls[1]?.[0]).toContain('customer_tickets.crm_handoff_status = $2');
    expect(poolQuery.mock.calls[1]?.[0]).toContain(
      "lower(coalesce(customer_accounts.company_name, '')) like $3",
    );
    expect(poolQuery.mock.calls[1]?.[0]).toContain(
      "customer_tickets.created_at >= ($4::date + interval '1 day')",
    );
    expect(poolQuery.mock.calls[1]?.[1]).toEqual([
      'OPEN',
      'SENT',
      '%activated%',
      '2026-09-01',
    ]);
  });

  it('rejects non-Sales Rep access to tickets', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ ...salesUserRow, role: 'PRICE_MANAGER' }] });

    const response = await request(createApp())
      .get('/api/v1/sales/tickets')
      .set('Authorization', `Bearer ${createSalesToken()}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('SALES_ROLE_FORBIDDEN');
  });

  it('rejects customer sessions on Sales ticket routes', async () => {
    const response = await request(createApp())
      .get('/api/v1/sales/tickets')
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SALES_AUTH_REQUIRED');
  });

  it('allows Sales Rep to send a submitted ticket to CRM and open it', async () => {
    const submittedTicket = { ...ticketRow, status: 'SUBMITTED' };
    const sentTicket = {
      ...submittedTicket,
      status: 'OPEN',
      crm_handoff_status: 'SENT',
      sales_sent_at: '2026-09-01T09:00:00.000Z',
      sales_user_id: salesUserId,
      sales_user_name: 'Sales Reviewer',
      updated_at: '2026-09-01T09:00:00.000Z',
    };
    poolQuery.mockResolvedValueOnce({ rows: [salesUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [submittedTicket] })
      .mockResolvedValueOnce({ rows: [sentTicket] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    poolQuery
      .mockResolvedValueOnce({ rows: [sentTicket] })
      .mockResolvedValueOnce({
        rows: [
          ticketCreatedEventRow,
          {
            ...ticketCreatedEventRow,
            id: '88888888-8888-4888-8888-888888888888',
            event_type: 'TICKET_SENT_TO_CRM',
            previous_status: 'SUBMITTED',
            new_status: 'OPEN',
            changed_by_customer_user_id: null,
            changed_by_customer_user_name: null,
            changed_by_customer_user_role: null,
            changed_by_sales_user_id: salesUserId,
            changed_by_sales_user_name: 'Sales Reviewer',
            created_at: '2026-09-01T09:00:00.000Z',
          },
        ],
      });

    const response = await request(createApp())
      .post(`/api/v1/sales/tickets/${ticketId}/send-to-crm`)
      .set('Authorization', `Bearer ${createSalesToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.ticket).toMatchObject({
      id: ticketId,
      status: 'OPEN',
      crmHandoffStatus: 'SENT',
      sales: { userId: salesUserId },
    });
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('for update of customer_tickets'),
      [ticketId],
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('insert into customer_ticket_events'),
      expect.arrayContaining([
        ticketId,
        'TICKET_SENT_TO_CRM',
        'SUBMITTED',
        'OPEN',
        null,
        salesUserId,
      ]),
    );
  });

  it('rejects sending an already sent ticket to CRM', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [salesUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...ticketRow, status: 'SUBMITTED', crm_handoff_status: 'SENT' }],
      });

    const response = await request(createApp())
      .post(`/api/v1/sales/tickets/${ticketId}/send-to-crm`)
      .set('Authorization', `Bearer ${createSalesToken()}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CUSTOMER_TICKET_ALREADY_SENT_TO_CRM');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });

  it('rejects sending a closed ticket to CRM', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [salesUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...ticketRow, status: 'CLOSED' }] });

    const response = await request(createApp())
      .post(`/api/v1/sales/tickets/${ticketId}/send-to-crm`)
      .set('Authorization', `Bearer ${createSalesToken()}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CUSTOMER_TICKET_STATUS_INVALID');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });

  it('rejects invalid ticket identifiers', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [salesUserRow] });

    const response = await request(createApp())
      .get('/api/v1/sales/tickets/not-a-ticket-id')
      .set('Authorization', `Bearer ${createSalesToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('customer ticket email notifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    env.SALES_TEAM_EMAIL = undefined;
  });

  it('sends Sales email when a ticket is submitted', async () => {
    env.SALES_TEAM_EMAIL = 'sales-team@example.com';
    const sendEmail = vi.spyOn(emailService, 'sendEmail').mockResolvedValue({ skipped: false });

    await handleCustomerTicketEmailEvent({
      ...baseLifecycleEvent(),
      type: 'TICKET_SUBMITTED',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED',
      metadata: {
        description: 'Need quotation assistance',
      },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sales-team@example.com',
        subject: 'New Customer Service Request Submitted',
        text: expect.stringContaining('TKT-2026-000001'),
      }),
    );
    expect(sendEmail.mock.calls[0]?.[0].text).toContain('Activated Cement Customer');
    expect(sendEmail.mock.calls[0]?.[0].text).toContain('Customer Admin');
    expect(sendEmail.mock.calls[0]?.[0].text).toContain('Need quotation assistance');
  });

  it('sends customer email when a ticket is closed', async () => {
    const sendEmail = vi.spyOn(emailService, 'sendEmail').mockResolvedValue({ skipped: false });

    await handleCustomerTicketEmailEvent({
      ...baseLifecycleEvent(),
      type: 'TICKET_CLOSED',
      previousStatus: 'OPEN',
      newStatus: 'CLOSED',
      previousCrmHandoffStatus: 'SENT',
      newCrmHandoffStatus: 'SENT',
      metadata: {
        crmResponse: 'The issue has been resolved.',
      },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'Your Service Request Has Been Resolved',
        text: expect.stringContaining('The issue has been resolved.'),
      }),
    );
  });

  it('does not throw when email delivery fails', async () => {
    env.SALES_TEAM_EMAIL = 'sales-team@example.com';
    vi.spyOn(emailService, 'sendEmail').mockRejectedValue(new Error('SMTP unavailable'));

    await expect(
      handleCustomerTicketEmailEvent({
        ...baseLifecycleEvent(),
        type: 'TICKET_SUBMITTED',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
      }),
    ).resolves.toBeUndefined();
  });

  it('does not expose a manual ticket notification endpoint', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });

    const response = await request(createApp())
      .post('/api/v1/customer/tickets/55555555-5555-4555-8555-555555555555/notify')
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(404);
  });

  it('email failure does not break ticket submission', async () => {
    env.SALES_TEAM_EMAIL = 'sales-team@example.com';
    vi.spyOn(emailService, 'sendEmail').mockRejectedValue(new Error('SMTP unavailable'));
    const submittedTicket = {
      ...ticketRow,
      status: 'SUBMITTED',
      crm_handoff_status: 'NOT_SENT',
      updated_at: '2026-09-01T09:00:00.000Z',
    };
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [ticketRow] })
      .mockResolvedValueOnce({ rows: [submittedTicket] })
      .mockResolvedValueOnce({ rows: [{ created_at: '2026-09-01T09:00:00.000Z' }] })
      .mockResolvedValueOnce({ rows: [] });
    poolQuery.mockResolvedValueOnce({ rows: [submittedTicket] }).mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .post(`/api/v1/customer/tickets/${ticketId}/submit`)
      .set('Cookie', `customer_session=${createCustomerToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.ticket).toMatchObject({
      id: ticketId,
      status: 'SUBMITTED',
      crmHandoffStatus: 'NOT_SENT',
    });
  });
});

function baseLifecycleEvent(): CustomerTicketLifecycleEvent {
  return {
    type: 'TICKET_CREATED',
    ticketId,
    ticketNumber: 'TKT-2026-000001',
    customerAccountId,
    customerCompanyName: 'Activated Cement Customer',
    customerUserId,
    customerUserName: 'Customer Admin',
    customerUserEmail: 'admin@example.com',
    customerUserPhone: '+966555000111',
    customerUserRole: 'CUSTOMER_ADMIN',
    previousStatus: null,
    newStatus: 'DRAFT',
    previousCrmHandoffStatus: null,
    newCrmHandoffStatus: 'NOT_SENT',
    actor: {
      kind: 'CUSTOMER',
      id: customerUserId,
      name: 'Customer Admin',
      role: 'CUSTOMER_ADMIN',
    },
    occurredAt: '2026-09-01T09:00:00.000Z',
    metadata: {},
  };
}
