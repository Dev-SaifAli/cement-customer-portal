import bcrypt from 'bcryptjs';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-sales-auth-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../../database/pool.js', () => ({
  pool: { query },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

const activeSalesUser = async () => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Sales Reviewer',
  email: 'sales@example.com',
  password_hash: await bcrypt.hash('correct-password', 4),
  is_active: true,
});

function createValidCustomerToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({
      sub: '22222222-2222-4222-8222-222222222222',
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

describe('sales authentication API', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('logs in an active Sales user with valid credentials and never returns the password hash', async () => {
    query.mockResolvedValueOnce({ rows: [await activeSalesUser()] });

    const response = await request(createApp()).post('/api/v1/sales/auth/login').send({
      email: 'SALES@EXAMPLE.COM',
      password: 'correct-password',
    });

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('where email = $1'), [
      'sales@example.com',
    ]);
    expect(response.headers['set-cookie']?.[0]).toContain('sales_session=');
    expect(response.body).toEqual({
      success: true,
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Sales Reviewer',
          email: 'sales@example.com',
          isActive: true,
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    expect(JSON.stringify(response.body)).not.toContain('correct-password');
  });

  it('rejects an invalid password with a generic authentication response', async () => {
    query.mockResolvedValueOnce({ rows: [await activeSalesUser()] });

    const response = await request(createApp()).post('/api/v1/sales/auth/login').send({
      email: 'sales@example.com',
      password: 'wrong-password',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'SALES_AUTH_INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
  });

  it('rejects an unknown email with the same generic authentication response', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp()).post('/api/v1/sales/auth/login').send({
      email: 'missing@example.com',
      password: 'correct-password',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'SALES_AUTH_INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
  });

  it('rejects an inactive Sales user', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          ...(await activeSalesUser()),
          is_active: false,
        },
      ],
    });

    const response = await request(createApp()).post('/api/v1/sales/auth/login').send({
      email: 'sales@example.com',
      password: 'correct-password',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SALES_AUTH_INVALID_CREDENTIALS');
  });

  it('rejects /me without Sales authentication', async () => {
    const response = await request(createApp()).get('/api/v1/sales/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SALES_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('does not authenticate Sales APIs with a customer session cookie', async () => {
    const response = await request(createApp())
      .get('/api/v1/sales/auth/me')
      .set('Cookie', `customer_session=${createValidCustomerToken()}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SALES_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('returns the current Sales user from /me with valid authentication', async () => {
    const app = createApp();
    const agent = request.agent(app);
    query.mockResolvedValueOnce({ rows: [await activeSalesUser()] });

    const loginResponse = await agent.post('/api/v1/sales/auth/login').send({
      email: 'sales@example.com',
      password: 'correct-password',
    });
    expect(loginResponse.status).toBe(200);

    query.mockResolvedValueOnce({ rows: [await activeSalesUser()] });
    const meResponse = await agent.get('/api/v1/sales/auth/me');

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual({
      success: true,
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Sales Reviewer',
          email: 'sales@example.com',
          isActive: true,
        },
      },
    });
    expect(JSON.stringify(meResponse.body)).not.toContain('password_hash');
  });

  it('never returns password fields from /me', async () => {
    const app = createApp();
    const agent = request.agent(app);
    query.mockResolvedValueOnce({ rows: [await activeSalesUser()] });

    const loginResponse = await agent.post('/api/v1/sales/auth/login').send({
      email: 'sales@example.com',
      password: 'correct-password',
    });
    expect(loginResponse.status).toBe(200);

    query.mockResolvedValueOnce({ rows: [await activeSalesUser()] });
    const meResponse = await agent.get('/api/v1/sales/auth/me');

    expect(meResponse.status).toBe(200);
    expect(JSON.stringify(meResponse.body)).not.toContain('password_hash');
    expect(JSON.stringify(meResponse.body)).not.toContain('passwordHash');
    expect(JSON.stringify(meResponse.body)).not.toContain('correct-password');
  });

  it('logs out an authenticated Sales user', async () => {
    const app = createApp();
    const agent = request.agent(app);
    query.mockResolvedValueOnce({ rows: [await activeSalesUser()] });

    const loginResponse = await agent.post('/api/v1/sales/auth/login').send({
      email: 'sales@example.com',
      password: 'correct-password',
    });
    expect(loginResponse.status).toBe(200);

    query.mockResolvedValueOnce({ rows: [await activeSalesUser()] });
    const logoutResponse = await agent.post('/api/v1/sales/auth/logout');

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toEqual({
      success: true,
      message: 'Logged out successfully.',
    });
    expect(logoutResponse.headers['set-cookie']?.[0]).toContain('sales_session=');
  });
});
