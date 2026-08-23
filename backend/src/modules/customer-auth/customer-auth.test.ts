import bcrypt from 'bcryptjs';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-auth-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../../database/pool.js', () => ({
  pool: { query },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

const activeCustomerUser = async () => ({
  id: '11111111-1111-4111-8111-111111111111',
  customer_account_id: '22222222-2222-4222-8222-222222222222',
  name: 'Customer Admin',
  email: 'admin@example.com',
  phone: '+966555000111',
  password_hash: await bcrypt.hash('correct-password', 4),
  role: 'CUSTOMER_ADMIN',
  is_active: true,
  password_must_change: false,
  registration_id: '33333333-3333-4333-8333-333333333333',
  company_name: 'Activated Cement Customer',
  account_status: 'ACTIVE',
  application_status: 'ACTIVATED',
});

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

function createExpiredCustomerToken() {
  return createSignedToken({
    sub: '11111111-1111-4111-8111-111111111111',
    type: 'customer',
    iat: 1,
    exp: 2,
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

describe('customer authentication API', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('logs in an activated customer admin and never returns the password hash', async () => {
    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });

    const response = await request(createApp()).post('/api/v1/customer/auth/login').send({
      email: 'ADMIN@EXAMPLE.COM',
      password: 'correct-password',
    });

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('lower(customer_users.email)'), [
      'admin@example.com',
    ]);
    expect(response.headers['set-cookie']?.[0]).toContain('customer_session=');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');
    expect(response.body).toEqual({
      success: true,
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          customerAccountId: '22222222-2222-4222-8222-222222222222',
          name: 'Customer Admin',
          email: 'admin@example.com',
          phone: '+966555000111',
          role: 'CUSTOMER_ADMIN',
          isActive: true,
          passwordMustChange: false,
          account: {
            id: '22222222-2222-4222-8222-222222222222',
            registrationId: '33333333-3333-4333-8333-333333333333',
            companyName: 'Activated Cement Customer',
            status: 'ACTIVE',
          },
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('correct-password');
  });

  it('rejects an invalid password with a generic authentication response', async () => {
    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });

    const response = await request(createApp()).post('/api/v1/customer/auth/login').send({
      email: 'admin@example.com',
      password: 'wrong-password',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'CUSTOMER_AUTH_INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
  });

  it('rejects an unknown email with the same generic authentication response', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp()).post('/api/v1/customer/auth/login').send({
      email: 'missing@example.com',
      password: 'correct-password',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'CUSTOMER_AUTH_INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
  });

  it('rejects an inactive customer user', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          ...(await activeCustomerUser()),
          is_active: false,
        },
      ],
    });

    const response = await request(createApp()).post('/api/v1/customer/auth/login').send({
      email: 'admin@example.com',
      password: 'correct-password',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_INVALID_CREDENTIALS');
  });

  it('rejects an inactive customer account', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          ...(await activeCustomerUser()),
          account_status: 'INACTIVE',
        },
      ],
    });

    const response = await request(createApp()).post('/api/v1/customer/auth/login').send({
      email: 'admin@example.com',
      password: 'correct-password',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_INVALID_CREDENTIALS');
  });

  it('rejects an approved but not activated application', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          ...(await activeCustomerUser()),
          application_status: 'APPROVED',
        },
      ],
    });

    const response = await request(createApp()).post('/api/v1/customer/auth/login').send({
      email: 'admin@example.com',
      password: 'correct-password',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_INVALID_CREDENTIALS');
  });

  it('rejects /me without customer authentication', async () => {
    const response = await request(createApp()).get('/api/v1/customer/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects /me with an invalid customer session', async () => {
    const response = await request(createApp())
      .get('/api/v1/customer/auth/me')
      .set('Cookie', 'customer_session=invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects /me with an expired customer session', async () => {
    const response = await request(createApp())
      .get('/api/v1/customer/auth/me')
      .set('Cookie', `customer_session=${createExpiredCustomerToken()}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('does not authenticate customer APIs with a sales session cookie', async () => {
    const response = await request(createApp())
      .get('/api/v1/customer/auth/me')
      .set('Cookie', `sales_session=${createValidSalesToken()}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('returns the current customer user from /me with valid authentication', async () => {
    const app = createApp();
    const agent = request.agent(app);
    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });

    const loginResponse = await agent.post('/api/v1/customer/auth/login').send({
      email: 'admin@example.com',
      password: 'correct-password',
    });
    expect(loginResponse.status).toBe(200);

    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });
    const meResponse = await agent.get('/api/v1/customer/auth/me');

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual({
      success: true,
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Customer Admin',
          email: 'admin@example.com',
          role: 'CUSTOMER_ADMIN',
        },
        account: {
          id: '22222222-2222-4222-8222-222222222222',
          companyName: 'Activated Cement Customer',
        },
      },
    });
    expect(JSON.stringify(meResponse.body)).not.toContain('password_hash');
    expect(JSON.stringify(meResponse.body)).not.toContain('passwordHash');
  });

  it('rejects /me when the authenticated customer user has been deactivated', async () => {
    const app = createApp();
    const agent = request.agent(app);
    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });

    const loginResponse = await agent.post('/api/v1/customer/auth/login').send({
      email: 'admin@example.com',
      password: 'correct-password',
    });
    expect(loginResponse.status).toBe(200);

    query.mockResolvedValueOnce({
      rows: [
        {
          ...(await activeCustomerUser()),
          is_active: false,
        },
      ],
    });
    const meResponse = await agent.get('/api/v1/customer/auth/me');

    expect(meResponse.status).toBe(401);
    expect(meResponse.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
  });

  it('rejects /me when the related customer account has been deactivated', async () => {
    const app = createApp();
    const agent = request.agent(app);
    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });

    const loginResponse = await agent.post('/api/v1/customer/auth/login').send({
      email: 'admin@example.com',
      password: 'correct-password',
    });
    expect(loginResponse.status).toBe(200);

    query.mockResolvedValueOnce({
      rows: [
        {
          ...(await activeCustomerUser()),
          account_status: 'INACTIVE',
        },
      ],
    });
    const meResponse = await agent.get('/api/v1/customer/auth/me');

    expect(meResponse.status).toBe(401);
    expect(meResponse.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
  });

  it('attaches only safe authenticated customer context to /me responses', async () => {
    const app = createApp();
    const agent = request.agent(app);
    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });

    const loginResponse = await agent.post('/api/v1/customer/auth/login').send({
      email: 'admin@example.com',
      password: 'correct-password',
    });
    expect(loginResponse.status).toBe(200);

    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });
    const meResponse = await agent.get('/api/v1/customer/auth/me');

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Customer Admin',
      email: 'admin@example.com',
      role: 'CUSTOMER_ADMIN',
    });
    expect(meResponse.body.data.account).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      companyName: 'Activated Cement Customer',
    });
    expect(meResponse.body.data.user).not.toHaveProperty('password');
    expect(meResponse.body.data.user).not.toHaveProperty('passwordHash');
    expect(meResponse.body.data.user).not.toHaveProperty('account');
    expect(meResponse.body.data.user).not.toHaveProperty('customerAccountId');
    expect(meResponse.body.data.account).not.toHaveProperty('registrationId');
    expect(meResponse.body.data.account).not.toHaveProperty('status');
    expect(JSON.stringify(meResponse.body)).not.toContain('password_hash');
  });

  it('logs out an authenticated customer user', async () => {
    const app = createApp();
    const agent = request.agent(app);
    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });

    const loginResponse = await agent.post('/api/v1/customer/auth/login').send({
      email: 'admin@example.com',
      password: 'correct-password',
    });
    expect(loginResponse.status).toBe(200);

    query.mockResolvedValueOnce({ rows: [await activeCustomerUser()] });
    const logoutResponse = await agent.post('/api/v1/customer/auth/logout');

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toEqual({
      success: true,
      message: 'Logged out successfully.',
    });
    expect(logoutResponse.headers['set-cookie']?.[0]).toContain('customer_session=');
    expect(logoutResponse.headers['set-cookie']?.[0]).toContain('Expires=Thu, 01 Jan 1970');
  });
});
