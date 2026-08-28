import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-hader-dispatch-secret-with-at-least-32-chars';
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
const transporterId = '33333333-3333-4333-8333-333333333333';
const truckId = '44444444-4444-4444-8444-444444444444';
const driverId = '55555555-5555-4555-8555-555555555555';

describe('Hader Dispatch APIs', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('requires an authenticated Hader or Dispatch user', async () => {
    const response = await request(createApp()).get('/api/v1/hader/dispatch');
    expect(response.status).toBe(401);
  });

  it('rejects a truck whose capacity is below shipment TON', async () => {
    authenticate();
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('from shipments where id=$1 for update'))
        return Promise.resolve({ rows: [lockedShipment('CREATED')] });
      if (sql.includes('from transporters'))
        return Promise.resolve({ rows: [{ status: 'ACTIVE' }] });
      if (sql.includes('from hader_trucks'))
        return Promise.resolve({ rows: [{ status: 'AVAILABLE', capacity_ton: '20' }] });
      return Promise.resolve({ rows: [] });
    });
    const response = await assign();
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('HADER_TRUCK_CAPACITY_INSUFFICIENT');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });

  it('rejects an expired driver license', async () => {
    authenticate();
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('from shipments where id=$1 for update'))
        return Promise.resolve({ rows: [lockedShipment('CREATED')] });
      if (sql.includes('from transporters'))
        return Promise.resolve({ rows: [{ status: 'ACTIVE' }] });
      if (sql.includes('from hader_trucks'))
        return Promise.resolve({ rows: [{ status: 'AVAILABLE', capacity_ton: '60' }] });
      if (sql.includes('hader_truck_id=$1')) return Promise.resolve({ rows: [] });
      if (sql.includes('from hader_drivers'))
        return Promise.resolve({ rows: [{ status: 'ACTIVE', license_expiry: '2020-01-01' }] });
      return Promise.resolve({ rows: [] });
    });
    const response = await assign();
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('HADER_DRIVER_LICENSE_EXPIRED');
  });

  it('assigns active resources and records SHIPMENT_ASSIGNED', async () => {
    authenticate((sql) => {
      if (sql.includes('inner join shipments s')) return { rows: [shipmentRow()] };
      if (sql.includes('from shipment_events e')) return { rows: [] };
      return { rows: [] };
    });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('from shipments where id=$1 for update'))
        return Promise.resolve({ rows: [lockedShipment('CREATED')] });
      if (sql.includes('from transporters'))
        return Promise.resolve({ rows: [{ status: 'ACTIVE' }] });
      if (sql.includes('from hader_trucks'))
        return Promise.resolve({ rows: [{ status: 'AVAILABLE', capacity_ton: '60' }] });
      if (sql.includes('from hader_drivers'))
        return Promise.resolve({ rows: [{ status: 'ACTIVE', license_expiry: '2030-01-01' }] });
      return Promise.resolve({ rows: [] });
    });
    const response = await assign();
    expect(response.status).toBe(200);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("status='ASSIGNED'"), [
      shipmentId,
      transporterId,
      truckId,
      driverId,
      userId,
      1,
    ]);
    expect(
      clientQuery.mock.calls.some(
        ([sql, values]) =>
          String(sql).includes('insert into shipment_events') &&
          Array.isArray(values) &&
          values[1] === 'SHIPMENT_ASSIGNED',
      ),
    ).toBe(true);
  });

  it('blocks a driver already assigned to another active shipment', async () => {
    authenticate();
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('from shipments where id=$1 for update'))
        return Promise.resolve({ rows: [lockedShipment('CREATED')] });
      if (sql.includes('from transporters'))
        return Promise.resolve({ rows: [{ status: 'ACTIVE' }] });
      if (sql.includes('from hader_trucks'))
        return Promise.resolve({ rows: [{ status: 'AVAILABLE', capacity_ton: '60' }] });
      if (sql.includes('hader_truck_id=$1')) return Promise.resolve({ rows: [] });
      if (sql.includes('from hader_drivers'))
        return Promise.resolve({ rows: [{ status: 'ACTIVE', license_expiry: '2030-01-01' }] });
      if (sql.includes('hader_driver_id=$1'))
        return Promise.resolve({ rows: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] });
      return Promise.resolve({ rows: [] });
    });
    const response = await assign();
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('HADER_DRIVER_BUSY');
  });

  it('does not dispatch an assigned shipment without a schedule', async () => {
    authenticate();
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) =>
      sql.includes('from shipments where id=$1 for update')
        ? Promise.resolve({ rows: [lockedShipment('ASSIGNED')] })
        : Promise.resolve({ rows: [] }),
    );
    const response = await request(createApp())
      .post(`/api/v1/hader/shipments/${shipmentId}/dispatch`)
      .set({ Cookie: `sales_session=${token()}` });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('SHIPMENT_DISPATCH_INCOMPLETE');
  });

  it('dispatches a fully assigned and scheduled shipment with an audit event', async () => {
    authenticate((sql) => {
      if (sql.includes('inner join shipments s'))
        return { rows: [{ ...shipmentRow(), shipment_status: 'DISPATCHED' }] };
      if (sql.includes('from shipment_events e')) return { rows: [] };
      return { rows: [] };
    });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('from shipments where id=$1 for update'))
        return Promise.resolve({
          rows: [
            {
              ...lockedShipment('ASSIGNED'),
              scheduled_date: '2026-09-01',
              scheduled_time: '09:30',
              loading_status: 'LOADED',
            },
          ],
        });
      if (sql.includes('from transporters'))
        return Promise.resolve({ rows: [{ status: 'ACTIVE' }] });
      if (sql.includes('from hader_trucks'))
        return Promise.resolve({ rows: [{ status: 'AVAILABLE', capacity_ton: '60' }] });
      if (sql.includes('from hader_drivers'))
        return Promise.resolve({ rows: [{ status: 'ACTIVE', license_expiry: '2030-01-01' }] });
      return Promise.resolve({ rows: [] });
    });
    const response = await request(createApp())
      .post(`/api/v1/hader/shipments/${shipmentId}/dispatch`)
      .set({ Cookie: `sales_session=${token()}` });
    expect(response.status).toBe(200);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("status='DISPATCHED'"), [
      shipmentId,
      userId,
    ]);
    expect(
      clientQuery.mock.calls.some(
        ([sql, values]) =>
          String(sql).includes('insert into shipment_events') &&
          Array.isArray(values) &&
          values[1] === 'SHIPMENT_DISPATCHED',
      ),
    ).toBe(true);
  });
});

function assign() {
  return request(createApp())
    .post(`/api/v1/hader/shipments/${shipmentId}/assign`)
    .set({ Cookie: `sales_session=${token()}` })
    .send({ transporterId, truckId, driverId });
}
function authenticate(fallback?: (sql: string) => { rows: unknown[] }) {
  poolQuery.mockImplementation((sql: string) =>
    sql.includes('from sales_users')
      ? Promise.resolve({
          rows: [
            {
              id: userId,
              name: 'Dispatch User',
              email: 'dispatch@example.com',
              password_hash: 'hash',
              is_active: true,
              role: 'DISPATCH_USER',
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
function lockedShipment(status: string) {
  return {
    id: shipmentId,
    status,
    quantity_ton: '30.000',
    transporter_id: status === 'ASSIGNED' ? transporterId : null,
    hader_truck_id: status === 'ASSIGNED' ? truckId : null,
    hader_driver_id: status === 'ASSIGNED' ? driverId : null,
    scheduled_date: null,
    scheduled_time: null,
    loading_status: status === 'ASSIGNED' ? 'WAITING' : null,
  };
}
function shipmentRow() {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    request_number: 'DR-2026-000001',
    order_id: '77777777-7777-4777-8777-777777777777',
    order_number: 'ORD-2026-000001',
    contract_id: null,
    contract_reference: null,
    customer_account_id: '88888888-8888-4888-8888-888888888888',
    company_name: 'Customer Company',
    contact_name: 'Customer Admin',
    contact_phone: '+966500000000',
    product_id: '99999999-9999-4999-8999-999999999999',
    product_code: 'CEM-OPC-50KG',
    product_name: 'Ordinary Portland Cement',
    packaging: 'Bag',
    contract_uom: 'TON',
    unit_weight_kg: '50',
    quantity_ton: '30.000',
    hader_city_id: null,
    hader_city_name: 'Jeddah',
    ship_to_location_id: 'site-1',
    ship_to_snapshot: { name: 'Main Site' },
    requested_date: '2026-09-01',
    delivery_notes: null,
    customer_rate_per_ton: '200',
    total_amount: '6000',
    status: 'CONVERTED_TO_SHIPMENT',
    rejection_reason: null,
    created_at: '2026-08-28T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:00.000Z',
    shipped_ton: '30.000',
    shipment_id: shipmentId,
    shipment_number: 'SHP-2026-000001',
    shipment_quantity_ton: '30.000',
    shipment_status: 'ASSIGNED',
    scheduled_date: null,
    scheduled_time: null,
    assigned_at: '2026-08-28T01:00:00.000Z',
    dispatched_at: null,
    transporter_id: transporterId,
    transporter_name: 'ABC Logistics',
    hader_truck_id: truckId,
    truck_number: 'TRK-000001',
    plate_number: 'ABC-1234',
    vehicle_type: 'Trailer',
    truck_capacity_ton: '60',
    hader_driver_id: driverId,
    driver_name: 'Ahmed Driver',
    driver_mobile: '+966511111111',
    driver_license_number: 'LIC-001',
    delivered_at: null,
    shipment_created_at: '2026-08-28T00:00:00.000Z',
  };
}
