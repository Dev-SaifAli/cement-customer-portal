import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-hader-loading-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { poolQuery, connect, clientQuery, release, publishSafely, dispatchDetail } = vi.hoisted(
  () => ({
    poolQuery: vi.fn(),
    connect: vi.fn(),
    clientQuery: vi.fn(),
    release: vi.fn(),
    publishSafely: vi.fn(),
    dispatchDetail: vi.fn(),
  }),
);

vi.mock('../../database/pool.js', () => ({
  pool: { query: poolQuery, connect },
  closeDatabase: vi.fn(),
}));
vi.mock('../notifications/notifications.service.js', () => ({
  notificationsService: { publishSafely },
}));
vi.mock('../hader-dispatch/hader-dispatch.service.js', () => ({
  haderDispatchService: { detail: dispatchDetail },
}));

import { createApp } from '../../app.js';

const userId = '11111111-1111-4111-8111-111111111111';
const shipmentId = '22222222-2222-4222-8222-222222222222';
const pointId = '33333333-3333-4333-8333-333333333333';

describe('Hader Loading Control', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    publishSafely.mockReset().mockResolvedValue(undefined);
    dispatchDetail.mockReset().mockResolvedValue({
      id: shipmentId,
      shipmentNumber: 'SHP-2026-000001',
      scheduledDate: '2026-09-01',
      scheduledTime: '09:30',
    });
  });

  it('requires an authenticated internal loading user', async () => {
    const response = await request(createApp()).get('/api/v1/hader/loading-control');
    expect(response.status).toBe(401);
  });

  it('does not accept a customer session for internal Loading Control', async () => {
    const response = await request(createApp())
      .get('/api/v1/hader/loading-control')
      .set({ Cookie: `customer_session=${token('customer')}` });
    expect(response.status).toBe(401);
  });

  it('notifies a waiting shipment and records the audit event', async () => {
    authenticate();
    transactionWith(locked('WAITING'));
    detailQueries('NOTIFIED');

    const response = await action('notify').send({ remind: false });

    expect(response.status).toBe(200);
    expect(eventWasWritten('DRIVER_NOTIFIED')).toBe(true);
    expect(publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DRIVER_NOTIFIED',
        message: expect.stringContaining('report to the plant gate'),
      }),
    );
  });

  it('blocks invalid loading-state transitions', async () => {
    authenticate();
    transactionWith(locked('LOADED'));

    const response = await action('notify').send({ remind: false });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LOADING_TRANSITION_INVALID');
  });

  it('rejects an incompatible loading point', async () => {
    authenticate();
    transactionWith(locked('AT_GATE'), (sql) =>
      sql.includes('from hader_loading_points where id=$1')
        ? {
            rows: [
              {
                id: pointId,
                code: 'SILO-01',
                name: 'Silo 1',
                point_type: 'SILO',
                capacity_ton: '100',
                status: 'FREE',
                product_id: null,
              },
            ],
          }
        : undefined,
    );

    const response = await action('loading-point').send({ loadingPointId: pointId });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('LOADING_POINT_INCOMPATIBLE');
  });

  it('does not start loading with inactive assigned resources', async () => {
    authenticate();
    transactionWith(
      { ...locked('AT_GATE'), loading_point_id: pointId, scheduled_date: '2026-09-01' },
      (sql) =>
        sql.includes('transporter_active')
          ? { rows: [{ transporter_active: false, truck_operational: true, driver_active: true }] }
          : undefined,
    );

    const response = await action('start-loading');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('LOADING_RESOURCE_INACTIVE');
  });

  it('completes loading, frees the loading point and records the audit event', async () => {
    authenticate();
    transactionWith({ ...locked('LOADING'), loading_point_id: pointId });
    detailQueries('LOADED');

    const response = await action('complete-loading');

    expect(response.status).toBe(200);
    expect(eventWasWritten('LOADING_COMPLETED')).toBe(true);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("set status='FREE'"), [
      pointId,
    ]);
  });
});

function action(path: string) {
  return request(createApp())
    .post(`/api/v1/hader/shipments/${shipmentId}/${path}`)
    .set({ Cookie: `sales_session=${token()}` });
}

function authenticate() {
  poolQuery.mockImplementation((sql: string) => {
    if (sql.includes('from sales_users')) {
      return Promise.resolve({
        rows: [
          {
            id: userId,
            name: 'Loading Operator',
            email: 'loading@example.com',
            password_hash: 'hash',
            is_active: true,
            role: 'LOADING_USER',
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
  });
}

function transactionWith(
  row: ReturnType<typeof locked>,
  extra?: (sql: string) => { rows: unknown[] } | undefined,
) {
  connect.mockResolvedValue({ query: clientQuery, release });
  clientQuery.mockImplementation((sql: string) => {
    if (sql.includes('join order_items oi') && sql.includes('for update of s')) {
      return Promise.resolve({ rows: [row] });
    }
    return Promise.resolve(extra?.(sql) ?? { rows: [] });
  });
}

function detailQueries(status: string) {
  const previous = poolQuery.getMockImplementation();
  poolQuery.mockImplementation((sql: string, values: unknown[]) => {
    if (sql.includes('from sales_users')) return previous?.(sql, values);
    if (sql.includes('from shipments s join orders o')) {
      return Promise.resolve({ rows: [{ ...loadingRow(), loading_status: status }] });
    }
    if (sql.includes('from hader_loading_points')) return Promise.resolve({ rows: [] });
    return Promise.resolve({ rows: [] });
  });
}

function eventWasWritten(type: string) {
  return clientQuery.mock.calls.some(
    ([sql, values]) =>
      String(sql).includes('insert into shipment_events') &&
      Array.isArray(values) &&
      values[1] === type,
  );
}

interface TestLockedRow {
  id: string;
  status: string;
  loading_status: string;
  quantity_ton: string;
  product_id: string;
  packaging: string;
  loading_point_id: string | null;
  transporter_id: string;
  hader_truck_id: string;
  hader_driver_id: string;
  scheduled_date: string | null;
  arrived_at: string | null;
}

function locked(status: string): TestLockedRow {
  return {
    id: shipmentId,
    status: 'ASSIGNED',
    loading_status: status,
    quantity_ton: '30.000',
    product_id: '44444444-4444-4444-8444-444444444444',
    packaging: 'Bag',
    loading_point_id: null,
    transporter_id: '55555555-5555-4555-8555-555555555555',
    hader_truck_id: '66666666-6666-4666-8666-666666666666',
    hader_driver_id: '77777777-7777-4777-8777-777777777777',
    scheduled_date: null,
    arrived_at: null,
  };
}

function loadingRow() {
  return {
    ...locked('WAITING'),
    shipment_number: 'SHP-2026-000001',
    order_number: 'ORD-2026-000001',
    company_name: 'Customer Company',
    product_code: 'CEM-OPC-50KG',
    product_name: 'Ordinary Portland Cement',
    truck_plate: 'ABC-1234',
    driver_name: 'Ahmed Driver',
    queue_position: 1,
    notified_at: null,
    at_gate_at: null,
    loading_started_at: null,
    loading_completed_at: null,
    loading_point_name: null,
    loading_point_type: null,
  };
}

function token(type: 'sales' | 'customer' = 'sales') {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, type, iat: now, exp: now + 3600 }),
  ).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}
