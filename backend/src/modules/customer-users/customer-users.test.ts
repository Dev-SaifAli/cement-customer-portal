import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-users-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../../database/pool.js', () => ({
  pool: { query },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

const customerAccountId = '22222222-2222-4222-8222-222222222222';
const customerUserId = '11111111-1111-4111-8111-111111111111';

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
  registration_id: '33333333-3333-4333-8333-333333333333',
  company_name: 'Activated Cement Customer',
  account_status: 'ACTIVE',
  application_status: 'ACTIVATED',
};

const safeCustomerUserRow = {
  id: '44444444-4444-4444-8444-444444444444',
  customer_account_id: customerAccountId,
  name: 'Operations User',
  email: 'operations@example.com',
  phone: '+966555111222',
  role: 'PURCHASER',
  is_active: true,
  password_must_change: true,
  created_at: '2026-08-23T08:00:00.000Z',
  updated_at: '2026-08-23T08:00:00.000Z',
};

function createValidCustomerToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({
      sub: customerUserId,
      type: 'customer',
      iat: now,
      exp: now + 60 * 60,
    }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function authenticatedRequest() {
  return request(createApp())
    .get('/api/v1/customer/users')
    .set({
      Cookie: `customer_session=${createValidCustomerToken()}`,
    });
}

describe('customer users API', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(createApp()).get('/api/v1/customer/users');

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('lists only users for the authenticated customer account and never returns password hashes', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [safeCustomerUserRow] });

    const response = await authenticatedRequest();

    expect(response.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('customer_account_id = $1'), [
      customerAccountId,
    ]);
    expect(response.body).toEqual({
      success: true,
      data: {
        users: [
          {
            id: safeCustomerUserRow.id,
            name: 'Operations User',
            email: 'operations@example.com',
            phone: '+966555111222',
            role: 'PURCHASER',
            roleLabel: 'Purchaser',
            isActive: true,
            passwordMustChange: true,
            createdAt: '2026-08-23T08:00:00.000Z',
            updatedAt: '2026-08-23T08:00:00.000Z',
          },
        ],
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('hashed-password');
  });

  it('creates a customer user under the authenticated customer account', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [safeCustomerUserRow] });

    const response = await request(createApp())
      .post('/api/v1/customer/users')
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({
        name: 'Operations User',
        email: 'OPERATIONS@EXAMPLE.COM',
        phone: '+966555111222',
        role: 'PURCHASER',
      });

    expect(response.status).toBe(201);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('insert into customer_users'),
      expect.arrayContaining([
        customerAccountId,
        'Operations User',
        'operations@example.com',
        '+966555111222',
        'PURCHASER',
      ]),
    );
    const createdPasswordHash = query.mock.calls[1]?.[1]?.[4] as string;
    expect(createdPasswordHash).toEqual(expect.any(String));
    expect(createdPasswordHash).not.toBe(response.body.data.temporaryPassword);
    expect(response.body.data.temporaryPassword).toEqual(expect.stringMatching(/^Asf-/));
    expect(response.body.data.user).toMatchObject({
      email: 'operations@example.com',
      phone: '+966555111222',
      role: 'PURCHASER',
      passwordMustChange: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('returns one user only when it belongs to the authenticated customer account', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [safeCustomerUserRow] });

    const response = await request(createApp())
      .get(`/api/v1/customer/users/${safeCustomerUserRow.id}`)
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` });

    expect(response.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('where id = $2'), [
      customerAccountId,
      safeCustomerUserRow.id,
    ]);
    expect(response.body.data.user.email).toBe('operations@example.com');
  });

  it('rejects customer user creation when the authenticated user is not a customer admin', async () => {
    query.mockResolvedValueOnce({
      rows: [{ ...authenticatedCustomerUserRow, role: 'PURCHASER' }],
    });

    const response = await request(createApp())
      .post('/api/v1/customer/users')
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({
        name: 'Viewer User',
        email: 'viewer@example.com',
        phone: '+966555333444',
        role: 'VIEWER',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CUSTOMER_ADMIN_REQUIRED');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('prevents cross-customer access by returning not found for unscoped users', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .get('/api/v1/customer/users/99999999-9999-4999-8999-999999999999')
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CUSTOMER_USER_NOT_FOUND');
  });

  it('updates only a user scoped to the authenticated customer account', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [safeCustomerUserRow] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...safeCustomerUserRow,
            name: 'Updated User',
            phone: '+966555999888',
            role: 'FINANCE_USER',
            is_active: false,
            updated_at: '2026-08-23T09:00:00.000Z',
          },
        ],
      });

    const response = await request(createApp())
      .patch(`/api/v1/customer/users/${safeCustomerUserRow.id}`)
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({
        name: 'Updated User',
        phone: '+966555999888',
        role: 'FINANCE_USER',
        isActive: false,
      });

    expect(response.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('and customer_account_id = $1'),
      [
        customerAccountId,
        safeCustomerUserRow.id,
        'Updated User',
        '+966555999888',
        'FINANCE_USER',
        false,
      ],
    );
    expect(response.body.data.user).toMatchObject({
      id: safeCustomerUserRow.id,
      name: 'Updated User',
      phone: '+966555999888',
      role: 'FINANCE_USER',
      roleLabel: 'Finance User',
      isActive: false,
    });
  });

  it('rejects customer user updates when the authenticated user is not a customer admin', async () => {
    query.mockResolvedValueOnce({
      rows: [{ ...authenticatedCustomerUserRow, role: 'VIEWER' }],
    });

    const response = await request(createApp())
      .patch(`/api/v1/customer/users/${safeCustomerUserRow.id}`)
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({ name: 'Blocked Update' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CUSTOMER_ADMIN_REQUIRED');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('prevents deactivating the last active customer administrator', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...safeCustomerUserRow,
            id: customerUserId,
            role: 'CUSTOMER_ADMIN',
            is_active: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ active_admin_count: '0' }] });

    const response = await request(createApp())
      .patch(`/api/v1/customer/users/${customerUserId}`)
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({ isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_ACTIVE_CUSTOMER_ADMIN_REQUIRED');
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('allows deactivating a customer administrator when another active admin exists', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...safeCustomerUserRow,
            id: customerUserId,
            role: 'CUSTOMER_ADMIN',
            is_active: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ active_admin_count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...safeCustomerUserRow,
            id: customerUserId,
            role: 'CUSTOMER_ADMIN',
            is_active: false,
          },
        ],
      });

    const response = await request(createApp())
      .patch(`/api/v1/customer/users/${customerUserId}`)
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      id: customerUserId,
      role: 'CUSTOMER_ADMIN',
      isActive: false,
    });
  });

  it('keeps customer user email read-only during updates', async () => {
    query.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });

    const response = await request(createApp())
      .patch(`/api/v1/customer/users/${safeCustomerUserRow.id}`)
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({ email: 'changed@example.com' });

    expect(response.status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
