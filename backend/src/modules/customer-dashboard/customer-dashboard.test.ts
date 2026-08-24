import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-dashboard-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../../database/pool.js', () => ({
  pool: { query },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

const activeCustomerUserRow = {
  id: '11111111-1111-4111-8111-111111111111',
  customer_account_id: '22222222-2222-4222-8222-222222222222',
  name: 'Customer Admin',
  email: 'admin@example.com',
  password_hash: '$2a$04$safehashforauthenticationmiddlewareonly',
  role: 'CUSTOMER_ADMIN',
  is_active: true,
  registration_id: '33333333-3333-4333-8333-333333333333',
  company_name: 'Activated Cement Customer',
  account_status: 'ACTIVE',
  application_status: 'ACTIVATED',
};

const dashboardRow = {
  account_id: '22222222-2222-4222-8222-222222222222',
  company_name: 'Activated Cement Customer',
  account_status: 'ACTIVE',
  activated_at: '2026-08-23T10:15:00.000Z',
  admin_id: '11111111-1111-4111-8111-111111111111',
  admin_name: 'Customer Admin',
  admin_email: 'admin@example.com',
  admin_role: 'CUSTOMER_ADMIN',
  registration_id: '33333333-3333-4333-8333-333333333333',
  registration_reference: 'APP-2026-123456',
  registration_status: 'ACTIVATED',
  contact: {
    phone: '+966512345678',
    email: 'primary@example.com',
  },
  sales_internal_notes: 'Sales-only decision notes must not leak',
  review_notes: 'Internal review notes must not leak',
  status_history: [
    {
      reason: 'Internal status reason must not leak from dashboard',
    },
  ],
  administrator: {
    fullName: 'Customer Admin',
    email: 'admin@example.com',
    phone: '+966512345680',
    password: 'must-not-leak',
    confirmPassword: 'must-not-leak',
  },
  delivery_locations: [
    {
      id: 'location-1',
      name: 'Riyadh Plant',
      siteId: 'SITE-001',
      city: 'Riyadh',
      region: 'Riyadh',
      country: 'Saudi Arabia',
      latitude: 24.7136,
      longitude: 46.6753,
      streetAddress: 'Hidden from dashboard summary',
    },
    {
      id: 'location-2',
      locationName: 'Jeddah Depot',
      city: 'Jeddah',
      region: 'Makkah',
      country: 'Saudi Arabia',
    },
  ],
  submitted_at: '2026-08-22T08:30:00.000Z',
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

function createValidCustomerToken() {
  const now = Math.floor(Date.now() / 1000);

  return createSignedToken({
    sub: activeCustomerUserRow.id,
    type: 'customer',
    iat: now,
    exp: now + 60 * 60,
  });
}

function createValidSalesToken() {
  const now = Math.floor(Date.now() / 1000);

  return createSignedToken({
    sub: '44444444-4444-4444-8444-444444444444',
    type: 'sales',
    iat: now,
    exp: now + 60 * 60,
  });
}

describe('customer dashboard API', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('rejects unauthenticated customer dashboard requests', async () => {
    const response = await request(createApp()).get('/api/v1/customer/dashboard');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects sales sessions from customer dashboard requests', async () => {
    const response = await request(createApp())
      .get('/api/v1/customer/dashboard')
      .set('Cookie', `sales_session=${createValidSalesToken()}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('returns only portal-owned dashboard data for the authenticated customer account', async () => {
    query.mockResolvedValueOnce({ rows: [activeCustomerUserRow] });
    query.mockResolvedValueOnce({ rows: [dashboardRow] });

    const response = await request(createApp())
      .get('/api/v1/customer/dashboard')
      .set('Cookie', `customer_session=${createValidCustomerToken()}`);

    expect(response.status).toBe(200);
    expect(query.mock.calls[1]?.[1]).toEqual([
      activeCustomerUserRow.customer_account_id,
      activeCustomerUserRow.id,
    ]);
    expect(response.body).toEqual({
      success: true,
      data: {
        account: {
          id: '22222222-2222-4222-8222-222222222222',
          companyName: 'Activated Cement Customer',
          status: 'ACTIVE',
          activatedAt: '2026-08-23T10:15:00.000Z',
        },
        administrator: {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Customer Admin',
          email: 'admin@example.com',
          phone: '+966512345680',
          role: 'CUSTOMER_ADMIN',
        },
        registration: {
          id: '33333333-3333-4333-8333-333333333333',
          reference: 'APP-2026-123456',
          status: 'ACTIVATED',
          submittedAt: '2026-08-22T08:30:00.000Z',
        },
        contact: {
          phone: '+966512345678',
        },
        deliveryLocations: {
          count: 2,
          items: [
            {
              id: 'location-1',
              name: 'Riyadh Plant',
              siteId: 'SITE-001',
              city: 'Riyadh',
              region: 'Riyadh',
              country: 'Saudi Arabia',
              isPrimary: false,
              hasMapLocation: true,
            },
            {
              id: 'location-2',
              name: 'Jeddah Depot',
              siteId: null,
              city: 'Jeddah',
              region: 'Makkah',
              country: 'Saudi Arabia',
              isPrimary: false,
              hasMapLocation: false,
            },
          ],
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    expect(JSON.stringify(response.body)).not.toContain('must-not-leak');
    expect(JSON.stringify(response.body)).not.toContain('Hidden from dashboard summary');
  });

  it('ignores manipulated customer identifiers and scopes the query to the authenticated session', async () => {
    query.mockResolvedValueOnce({ rows: [activeCustomerUserRow] });
    query.mockResolvedValueOnce({ rows: [dashboardRow] });

    const response = await request(createApp())
      .get(
        '/api/v1/customer/dashboard?accountId=99999999-9999-4999-8999-999999999999&customerUserId=88888888-8888-4888-8888-888888888888',
      )
      .set('Cookie', `customer_session=${createValidCustomerToken()}`);

    expect(response.status).toBe(200);
    expect(query.mock.calls[1]?.[1]).toEqual([
      activeCustomerUserRow.customer_account_id,
      activeCustomerUserRow.id,
    ]);
    expect(JSON.stringify(response.body)).not.toContain('99999999-9999-4999-8999-999999999999');
    expect(JSON.stringify(response.body)).not.toContain('88888888-8888-4888-8888-888888888888');
  });

  it('does not expose sales-only fields or internal registration review notes', async () => {
    query.mockResolvedValueOnce({ rows: [activeCustomerUserRow] });
    query.mockResolvedValueOnce({ rows: [dashboardRow] });

    const response = await request(createApp())
      .get('/api/v1/customer/dashboard')
      .set('Cookie', `customer_session=${createValidCustomerToken()}`);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('Sales-only decision notes must not leak');
    expect(JSON.stringify(response.body)).not.toContain('Internal review notes must not leak');
    expect(JSON.stringify(response.body)).not.toContain(
      'Internal status reason must not leak from dashboard',
    );
    expect(response.body.data).not.toHaveProperty('statusHistory');
    expect(response.body.data).not.toHaveProperty('reviewNotes');
    expect(response.body.data).not.toHaveProperty('salesInternalNotes');
  });

  it('does not fall back to another customer account when scoped dashboard data is missing', async () => {
    query.mockResolvedValueOnce({ rows: [activeCustomerUserRow] });
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .get('/api/v1/customer/dashboard')
      .set('Cookie', `customer_session=${createValidCustomerToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CUSTOMER_DASHBOARD_NOT_FOUND');
    expect(query.mock.calls[1]?.[1]).toEqual([
      activeCustomerUserRow.customer_account_id,
      activeCustomerUserRow.id,
    ]);
  });
});
