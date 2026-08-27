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
function auth(role: string, fallback?: (sql: string) => { rows: unknown[] }) {
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
      : Promise.resolve(fallback?.(sql) ?? { rows: [] }),
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

  it('creates a shipment and moves the order to processing', async () => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    const orderId = '33333333-3333-4333-8333-333333333333';
    auth('HADER_MANAGER', (sql) =>
      sql.includes('inner join shipments s')
        ? { rows: [shipmentRow(shipmentId, orderId)] }
        : { rows: [] },
    );
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of dr'))
        return Promise.resolve({ rows: [deliveryRequestRow(orderId, 'APPROVED')] });
      if (sql.includes('select id from shipments where')) return Promise.resolve({ rows: [] });
      if (sql.includes('sum(quantity_ton)')) return Promise.resolve({ rows: [{ total: '0' }] });
      if (sql.includes("nextval('shipment_number_seq')"))
        return Promise.resolve({ rows: [{ sequence: '1' }] });
      if (sql.includes('insert into shipments')) return Promise.resolve({ rows: [{ id: shipmentId }] });
      if (sql.includes("update orders set status='PROCESSING'"))
        return Promise.resolve({ rows: [{ status: 'PROCESSING' }] });
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/hader/delivery-requests/${requestId}/create-shipment`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({
        clientRequestId: '66666666-6666-4666-8666-666666666666',
        quantityTon: 100,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.shipment.shipmentNumber).toBe('SHP-2026-000001');
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("update orders set status='PROCESSING'"),
      [orderId],
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("'SHIPMENT_CREATED','SUBMITTED','PROCESSING'"),
      [
        orderId,
        userId,
        JSON.stringify({ shipmentId, shipmentNumber: 'SHP-2026-000001' }),
      ],
    );
  });

  it('returns the existing shipment for a repeated client request', async () => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    const orderId = '33333333-3333-4333-8333-333333333333';
    auth('HADER_MANAGER', (sql) =>
      sql.includes('inner join shipments s')
        ? { rows: [shipmentRow(shipmentId, orderId)] }
        : { rows: [] },
    );
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of dr'))
        return Promise.resolve({
          rows: [deliveryRequestRow(orderId, 'CONVERTED_TO_SHIPMENT')],
        });
      if (sql.includes('select id from shipments where'))
        return Promise.resolve({ rows: [{ id: shipmentId }] });
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/hader/delivery-requests/${requestId}/create-shipment`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({
        clientRequestId: '66666666-6666-4666-8666-666666666666',
        quantityTon: 100,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.shipment.id).toBe(shipmentId);
    expect(
      clientQuery.mock.calls.some(([sql]) => String(sql).includes('insert into shipments')),
    ).toBe(false);
  });
});

function deliveryRequestRow(orderId: string, status: string) {
  return {
    id: requestId,
    request_number: 'DR-2026-000001',
    order_id: orderId,
    order_number: 'ORD-2026-000001',
    contract_id: '77777777-7777-4777-8777-777777777777',
    contract_reference: 'CT-2026-000001',
    customer_account_id: '44444444-4444-4444-8444-444444444444',
    company_name: 'Customer Company',
    contact_name: 'Customer Admin',
    contact_phone: '+966512345678',
    product_id: '88888888-8888-4888-8888-888888888888',
    product_code: 'CEM-OPC-50KG',
    product_name: 'Ordinary Portland Cement',
    packaging: 'Bag',
    contract_uom: 'TON',
    unit_weight_kg: '50',
    quantity_ton: '500.000',
    hader_city_id: '99999999-9999-4999-8999-999999999999',
    hader_city_name: 'Jeddah',
    ship_to_location_id: 'site-1',
    ship_to_snapshot: { name: 'Main Site', city: 'Jeddah' },
    requested_date: '2026-08-30',
    delivery_notes: null,
    customer_rate_per_ton: '200.00',
    total_amount: '100000.00',
    status,
    rejection_reason: null,
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T00:00:00.000Z',
    shipped_ton: '100.000',
  };
}

function shipmentRow(shipmentId: string, orderId: string) {
  return {
    ...deliveryRequestRow(orderId, 'CONVERTED_TO_SHIPMENT'),
    shipment_id: shipmentId,
    shipment_number: 'SHP-2026-000001',
    shipment_quantity_ton: '100.000',
    shipment_status: 'CREATED',
    scheduled_date: null,
    delivered_at: null,
    shipment_created_at: '2026-08-27T00:00:00.000Z',
  };
}
