import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-hader-delivery-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});
const { poolQuery, connect, clientQuery, release } = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));
vi.mock('../../database/pool.js', () => ({
  pool: { query: poolQuery, connect },
  closeDatabase: vi.fn(),
}));
import { createApp } from '../../app.js';

const userId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(
    JSON.stringify({ sub: userId, type: 'sales', iat: now, exp: now + 3600 }),
  ).toString('base64url');
  const s = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${h}.${p}`)
    .digest('base64url');
  return `${h}.${p}.${s}`;
}
function auth(role: string) {
  poolQuery.mockImplementation((sql: string) =>
    sql.includes('from sales_users')
      ? Promise.resolve({
          rows: [
            {
              id: userId,
              name: 'Hader User',
              email: 'hader@example.com',
              password_hash: 'hash',
              is_active: true,
              role,
            },
          ],
        })
      : Promise.resolve({ rows: [] }),
  );
}
describe('Hader delivery APIs', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });
  it('requires internal authentication', async () => {
    const response = await request(createApp()).get('/api/v1/hader/delivery-requests');
    expect(response.status).toBe(401);
  });
  it('blocks a Sales Representative from Hader requests', async () => {
    auth('SALES_REP');
    const response = await request(createApp())
      .get('/api/v1/hader/delivery-requests')
      .set({ Cookie: `sales_session=${token()}` });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('SALES_ROLE_FORBIDDEN');
  });
  it('prevents split shipments from exceeding request TON', async () => {
    auth('HADER_MANAGER');
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of dr'))
        return Promise.resolve({
          rows: [
            {
              id: requestId,
              status: 'APPROVED',
              quantity_ton: '500.000',
              order_id: '33333333-3333-4333-8333-333333333333',
              customer_account_id: '44444444-4444-4444-8444-444444444444',
            },
          ],
        });
      if (sql.includes('sum(quantity_ton)'))
        return Promise.resolve({ rows: [{ total: '300.000' }] });
      return Promise.resolve({ rows: [] });
    });
    const response = await request(createApp())
      .post(`/api/v1/hader/delivery-requests/${requestId}/create-shipment`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({ quantityTon: 250 });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SHIPMENT_QUANTITY_EXCEEDS_REMAINING');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });
});
