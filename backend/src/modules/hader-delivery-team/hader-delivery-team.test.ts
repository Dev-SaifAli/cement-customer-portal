import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-hader-delivery-team-secret-at-least-32-chars';
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
const shipmentId = '22222222-2222-4222-8222-222222222222';

describe('Hader Delivery Team APIs', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('requires Delivery Team authorization', async () => {
    const unauthenticated = await request(createApp()).get('/api/v1/hader/delivery-team');
    expect(unauthenticated.status).toBe(401);

    authenticate('DISPATCH_USER');
    const forbidden = await request(createApp())
      .get('/api/v1/hader/delivery-team')
      .set({ Cookie: `sales_session=${token()}` });
    expect(forbidden.status).toBe(403);
  });

  it('lists loaded shipments for an authorized Delivery Team user', async () => {
    authenticate('DELIVERY_TEAM_USER', (sql) => {
      if (sql.includes('count(*)::text total')) return { rows: [{ total: '1' }] };
      if (sql.includes('select s.id,s.shipment_number')) return { rows: [shipmentRow('LOADED')] };
      return { rows: [] };
    });
    const response = await request(createApp())
      .get('/api/v1/hader/delivery-team?status=LOADED')
      .set({ Cookie: `sales_session=${token()}` });
    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toMatchObject({
      shipmentNumber: 'SHP-2026-000001',
      status: 'LOADED',
    });
  });

  it.each([
    ['start-delivery', 'DISPATCHED', 'IN_TRANSIT', 'SHIPMENT_IN_TRANSIT'],
    ['deliver', 'IN_TRANSIT', 'DELIVERED', 'SHIPMENT_DELIVERED'],
    ['close', 'DELIVERED', 'CLOSED', 'SHIPMENT_CLOSED'],
  ] as const)(
    'applies the strict %s transition and writes its audit event',
    async (action, from, to, event) => {
      authenticate('DELIVERY_TEAM_USER', (sql) => {
        if (sql.includes('select s.id,s.shipment_number')) return { rows: [shipmentRow(to)] };
        if (sql.includes('from shipment_events event')) return { rows: [] };
        return { rows: [] };
      });
      connect.mockResolvedValue({ query: clientQuery, release });
      clientQuery.mockImplementation((sql: string) => {
        if (sql.includes('select status from shipments'))
          return Promise.resolve({ rows: [{ status: from }] });
        if (sql.includes('select exists(select 1 from shipment_pods'))
          return Promise.resolve({ rows: [{ exists: true }] });
        return Promise.resolve({ rows: [] });
      });

      const response = await request(createApp())
        .post(`/api/v1/hader/shipments/${shipmentId}/${action}`)
        .set({ Cookie: `sales_session=${token()}` });

      expect(response.status).toBe(200);
      expect(response.body.data.shipment.status).toBe(to);
      expect(
        clientQuery.mock.calls.some(
          ([sql, values]) =>
            String(sql).includes('insert into shipment_events') &&
            Array.isArray(values) &&
            values[1] === event,
        ),
      ).toBe(true);
    },
  );

  it('blocks an invalid delivery transition without changing shipment status', async () => {
    authenticate('DELIVERY_TEAM_USER');
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) =>
      sql.includes('select status from shipments')
        ? Promise.resolve({ rows: [{ status: 'DISPATCHED' }] })
        : Promise.resolve({ rows: [] }),
    );
    const response = await request(createApp())
      .post(`/api/v1/hader/shipments/${shipmentId}/deliver`)
      .set({ Cookie: `sales_session=${token()}` });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DELIVERY_TEAM_TRANSITION_INVALID');
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('update shipments set status'),
      expect.anything(),
    );
  });

  it('requires proof of delivery before closing a delivered shipment', async () => {
    authenticate('DELIVERY_TEAM_USER');
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('select status from shipments'))
        return Promise.resolve({ rows: [{ status: 'DELIVERED' }] });
      if (sql.includes('select exists(select 1 from shipment_pods'))
        return Promise.resolve({ rows: [{ exists: false }] });
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/hader/shipments/${shipmentId}/close`)
      .set({ Cookie: `sales_session=${token()}` });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SHIPMENT_POD_REQUIRED');
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('update shipments set status'),
      expect.anything(),
    );
  });
});

function authenticate(
  role: 'DELIVERY_TEAM_USER' | 'DISPATCH_USER',
  fallback?: (sql: string) => { rows: unknown[] },
) {
  poolQuery.mockImplementation((sql: string) =>
    sql.includes('from sales_users')
      ? Promise.resolve({
          rows: [
            {
              id: userId,
              name: 'Delivery Team User',
              email: 'delivery@example.com',
              password_hash: 'hash',
              is_active: true,
              role,
            },
          ],
        })
      : Promise.resolve(fallback?.(sql) ?? { rows: [] }),
  );
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

function shipmentRow(status: string) {
  const loaded = status === 'LOADED';
  return {
    id: shipmentId,
    shipment_number: 'SHP-2026-000001',
    shipment_status: loaded ? 'ASSIGNED' : status,
    loading_status: loaded ? 'LOADED' : 'LOADED',
    quantity_ton: '20.000',
    scheduled_date: '2026-09-01',
    scheduled_time: '09:30',
    dispatched_at: status === 'DISPATCHED' ? '2026-09-01T09:30:00.000Z' : null,
    in_transit_at: status === 'IN_TRANSIT' ? '2026-09-01T10:00:00.000Z' : null,
    delivered_at: status === 'DELIVERED' ? '2026-09-01T12:00:00.000Z' : null,
    closed_at: status === 'CLOSED' ? '2026-09-01T12:30:00.000Z' : null,
    order_id: '33333333-3333-4333-8333-333333333333',
    order_number: 'ORD-2026-000001',
    contract_id: null,
    contract_reference: null,
    company_name: 'Ali Brothers',
    product_id: '44444444-4444-4444-8444-444444444444',
    product_code: 'CEM-OPC-50KG',
    product_name: 'Ordinary Portland Cement',
    packaging: 'Bag',
    contract_uom: 'TON',
    unit_weight_kg: '50',
    hader_city_id: '55555555-5555-4555-8555-555555555555',
    hader_city_name: 'Jeddah',
    ship_to_snapshot: { name: 'Main Site', city: 'Jeddah' },
    requested_date: '2026-09-01',
    transporter_id: '66666666-6666-4666-8666-666666666666',
    transporter_name: 'ABC Logistics',
    hader_truck_id: '77777777-7777-4777-8777-777777777777',
    truck_number: 'TRK-000001',
    plate_number: 'ABC-1234',
    vehicle_type: 'Trailer',
    truck_capacity_ton: '30',
    hader_driver_id: '88888888-8888-4888-8888-888888888888',
    driver_name: 'Ahmed Ali',
    driver_mobile: '+966500000000',
    driver_license_number: 'LIC-001',
  };
}
