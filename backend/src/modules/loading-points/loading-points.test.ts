import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-loading-points-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../../database/pool.js', () => ({
  pool: { query: poolQuery },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

const userId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const pointId = '33333333-3333-4333-8333-333333333333';
const shipmentId = '44444444-4444-4444-8444-444444444444';

describe('Silos and bagging lines management', () => {
  beforeEach(() => poolQuery.mockReset());

  it('requires internal authentication', async () => {
    const response = await request(createApp()).get('/api/v1/admin/loading-points');
    expect(response.status).toBe(401);
  });

  it('does not allow a Sales representative to manage loading points', async () => {
    authenticate('SALES_REP');
    const response = await request(createApp())
      .post('/api/v1/admin/loading-points')
      .set({ Cookie: `sales_session=${token()}` })
      .send(validInput());
    expect(response.status).toBe(403);
  });

  it('creates a silo for a compatible bulk product and writes an audit event', async () => {
    authenticate('HADER_MANAGER', (sql) => {
      if (sql.includes('from product_catalog where id=$1')) return { rows: [product('Bulk')] };
      if (sql.includes('insert into hader_loading_points')) return { rows: [{ id: pointId }] };
      if (sql.includes('insert into internal_logistics_events')) return { rows: [] };
      if (sql.includes('from hader_loading_points points')) return { rows: [point('Bulk')] };
      return undefined;
    });

    const response = await request(createApp())
      .post('/api/v1/admin/loading-points')
      .set({ Cookie: `sales_session=${token()}` })
      .send(validInput());

    expect(response.status).toBe(201);
    expect(response.body.data.loadingPoint).toMatchObject({
      pointNumber: 'SILO-01',
      pointType: 'SILO',
      capacityTon: 100,
      status: 'AVAILABLE',
    });
    expect(
      poolQuery.mock.calls.some(([sql]) =>
        String(sql).includes("nextval('hader_silo_number_seq')"),
      ),
    ).toBe(true);
    expect(
      poolQuery.mock.calls.some(
        ([sql, values]) =>
          String(sql).includes('insert into internal_logistics_events') &&
          Array.isArray(values) &&
          values[1] === 'LOADING_POINT_CREATED',
      ),
    ).toBe(true);
  });

  it('creates a bagging line for a compatible bag product', async () => {
    authenticate('HADER_OPERATIONS', (sql) => {
      if (sql.includes('from product_catalog where id=$1')) return { rows: [product('Bag')] };
      if (sql.includes('insert into hader_loading_points')) return { rows: [{ id: pointId }] };
      if (sql.includes('insert into internal_logistics_events')) return { rows: [] };
      if (sql.includes('from hader_loading_points points')) {
        return { rows: [point('Bag', 'BAGGING_LINE', 'LINE-01')] };
      }
      return undefined;
    });

    const response = await request(createApp())
      .post('/api/v1/admin/loading-points')
      .set({ Cookie: `sales_session=${token()}` })
      .send({
        ...validInput(),
        pointNumber: 'LINE-01',
        pointType: 'BAGGING_LINE',
        capacityTon: undefined,
        capacityTonPerHour: 20,
        maxTrucks: 2,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.loadingPoint).toMatchObject({
      pointNumber: 'LINE-01',
      pointType: 'BAGGING_LINE',
      product: { packagingType: 'Bag' },
      capacityTonPerHour: 20,
      maxTrucks: 2,
    });
    expect(
      poolQuery.mock.calls.some(([sql]) =>
        String(sql).includes("nextval('hader_bagging_line_number_seq')"),
      ),
    ).toBe(true);
  });

  it('returns a safe conflict for a duplicate point number', async () => {
    authenticate('HADER_MANAGER', (sql) => {
      if (sql.includes('from product_catalog where id=$1')) return { rows: [product('Bulk')] };
      if (sql.includes('insert into hader_loading_points')) {
        const error = Object.assign(new Error('duplicate'), { code: '23505' });
        throw error;
      }
      return undefined;
    });

    const response = await request(createApp())
      .post('/api/v1/admin/loading-points')
      .set({ Cookie: `sales_session=${token()}` })
      .send(validInput());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LOADING_POINT_DUPLICATE');
  });

  it('rejects a bag product assigned to a silo', async () => {
    authenticate('HADER_MANAGER', (sql) =>
      sql.includes('from product_catalog where id=$1') ? { rows: [product('Bag')] } : undefined,
    );
    const response = await request(createApp())
      .post('/api/v1/admin/loading-points')
      .set({ Cookie: `sales_session=${token()}` })
      .send(validInput());
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('LOADING_POINT_PRODUCT_INCOMPATIBLE');
  });

  it('validates capacity before creating a loading point', async () => {
    authenticate('HADER_MANAGER');
    const response = await request(createApp())
      .post('/api/v1/admin/loading-points')
      .set({ Cookie: `sales_session=${token()}` })
      .send({ ...validInput(), capacityTon: 0 });
    expect(response.status).toBe(400);
  });

  it('requires positive hourly capacity and at least one truck for a bagging line', async () => {
    authenticate('HADER_MANAGER');
    const response = await request(createApp())
      .post('/api/v1/admin/loading-points')
      .set({ Cookie: `sales_session=${token()}` })
      .send({
        ...validInput(),
        pointType: 'BAGGING_LINE',
        capacityTon: undefined,
        capacityTonPerHour: 0,
        maxTrucks: 0,
      });
    expect(response.status).toBe(400);
  });

  it('returns only available compatible points with enough capacity for a shipment', async () => {
    authenticate('LOADING_USER', (sql) => {
      if (sql.includes('from shipments') && sql.includes('join lateral')) {
        return { rows: [{ product_id: productId, packaging: 'Bulk', quantity_ton: '80.000' }] };
      }
      if (sql.includes("points.status in ('AVAILABLE','BUSY')")) {
        return { rows: [point('Bulk')] };
      }
      return undefined;
    });
    const response = await request(createApp())
      .get(`/api/v1/hader/loading-points/available?shipmentId=${shipmentId}`)
      .set({ Cookie: `sales_session=${token()}` });

    expect(response.status).toBe(200);
    expect(response.body.data.loadingPoints).toHaveLength(1);
    const availabilityQuery = poolQuery.mock.calls.find(([sql]) =>
      String(sql).includes("points.status in ('AVAILABLE','BUSY')"),
    );
    expect(availabilityQuery?.[0]).toContain('points.product_id=$2');
    expect(availabilityQuery?.[0]).toContain("points.point_type='BAGGING_LINE'");
    expect(availabilityQuery?.[0]).toContain('active_shipments.loading_point_id=points.id');
  });
});

function authenticate(role: string, extra?: (sql: string) => { rows: unknown[] } | undefined) {
  poolQuery.mockImplementation((sql: string | undefined) => {
    if (!sql) return Promise.resolve({ rows: [] });
    if (sql.includes('from sales_users')) {
      return Promise.resolve({
        rows: [
          {
            id: userId,
            name: 'Internal User',
            email: 'internal@example.com',
            password_hash: 'hash',
            is_active: true,
            role,
          },
        ],
      });
    }
    return Promise.resolve(extra?.(sql) ?? { rows: [] });
  });
}

function validInput() {
  return {
    pointNumber: 'SILO-01',
    pointType: 'SILO',
    productId,
    capacityTon: 100,
    status: 'AVAILABLE',
  };
}

function product(packaging: string) {
  return {
    id: productId,
    product_code: 'CEM-OPC-BULK',
    product_name: 'Ordinary Portland Cement Bulk',
    packaging_type: packaging,
  };
}

function point(
  packaging: string,
  pointType: 'SILO' | 'BAGGING_LINE' = 'SILO',
  pointNumber = 'SILO-01',
) {
  return {
    id: pointId,
    code: pointNumber,
    name: pointNumber,
    point_type: pointType,
    product_id: productId,
    product_code: 'CEM-OPC-BULK',
    product_name: 'Ordinary Portland Cement Bulk',
    packaging_type: packaging,
    capacity_ton: '100.000',
    capacity_ton_per_hour: pointType === 'BAGGING_LINE' ? '20.000' : null,
    max_trucks: pointType === 'BAGGING_LINE' ? 2 : 1,
    status: 'AVAILABLE',
    created_at: '2026-08-28T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:00.000Z',
  };
}

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, type: 'sales', iat: now, exp: now + 3600 }),
  ).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}
