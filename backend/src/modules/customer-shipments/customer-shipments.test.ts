import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-shipments-secret-with-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../database/pool.js', () => ({
  pool: { query },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const shipmentId = '33333333-3333-4333-8333-333333333333';

const authRow = {
  id: userId,
  customer_account_id: accountId,
  name: 'Customer Admin',
  email: 'admin@example.com',
  phone: '+966555000111',
  password_hash: 'never-returned',
  role: 'CUSTOMER_ADMIN',
  is_active: true,
  password_must_change: false,
  registration_id: '44444444-4444-4444-8444-444444444444',
  company_name: 'ABC Construction',
  account_status: 'ACTIVE',
  application_status: 'ACTIVATED',
};

const shipmentRow = {
  id: shipmentId,
  shipment_number: 'SHP-2026-000001',
  status: 'IN_TRANSIT',
  quantity_ton: '20.000',
  scheduled_date: '2026-09-03',
  delivered_at: null,
  created_at: '2026-09-01T08:00:00.000Z',
  updated_at: '2026-09-02T08:00:00.000Z',
  order_id: '55555555-5555-4555-8555-555555555555',
  order_number: 'ORD-2026-000001',
  fulfilment_type: 'DELIVERY',
  ship_to_snapshot: { name: 'Main Site', city: 'Jeddah', region: 'Makkah' },
  hader_city_name: 'Jeddah',
  requested_date: '2026-09-03',
  contract_id: '66666666-6666-4666-8666-666666666666',
  contract_reference: 'CT-2026-000001',
  product_id: '77777777-7777-4777-8777-777777777777',
  product_code: 'CEM-OPC-50KG',
  product_name: 'Ordinary Portland Cement',
  packaging: 'Bag',
  contract_uom: '50KG_BAG',
  unit_weight_kg: '50.000',
  total_count: '1',
};

describe('customer shipment visibility', () => {
  beforeEach(() => query.mockReset());

  it('lists only shipments scoped through the authenticated customer account', async () => {
    query.mockResolvedValueOnce({ rows: [authRow] }).mockResolvedValueOnce({ rows: [shipmentRow] });

    const response = await authenticatedGet(
      '/api/v1/customer/shipments?status=IN_TRANSIT&dateFrom=2026-09-01&dateTo=2026-09-30',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toMatchObject({
      shipmentNumber: 'SHP-2026-000001',
      quantityTon: 20,
      equivalentBags: 400,
      order: { number: 'ORD-2026-000001' },
      contract: { reference: 'CT-2026-000001' },
    });
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/s\.customer_account_id = \$1[\s\S]*o\.customer_account_id = \$1/),
      [accountId, 'IN_TRANSIT', '2026-09-01', '2026-09-30', 10, 0],
    );
    expect(query.mock.calls[1]?.[0]).toContain('left join contracts c on c.id=o.contract_id');
  });

  it('includes a shipment created from a direct order without a contract', async () => {
    const directOrderShipment = {
      ...shipmentRow,
      order_number: 'ORD-2026-000005',
      contract_id: null,
      contract_reference: null,
    };
    query
      .mockResolvedValueOnce({ rows: [authRow] })
      .mockResolvedValueOnce({ rows: [directOrderShipment] });

    const response = await authenticatedGet('/api/v1/customer/shipments');

    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toMatchObject({
      order: { number: 'ORD-2026-000005' },
      contract: { id: null, reference: null },
    });
  });

  it('returns safe shipment details and customer-visible events', async () => {
    query
      .mockResolvedValueOnce({ rows: [authRow] })
      .mockResolvedValueOnce({ rows: [shipmentRow] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            event_type: 'SHIPMENT_CREATED',
            previous_status: null,
            new_status: 'CREATED',
            created_at: '2026-09-01T08:00:00.000Z',
          },
        ],
      });

    const response = await authenticatedGet(`/api/v1/customer/shipments/${shipmentId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.shipment.events).toHaveLength(1);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('transporter');
    expect(serialized).not.toContain('cost');
    expect(serialized).not.toContain('notes');
    expect(serialized).not.toContain('password_hash');
  });

  it('does not expose another customer shipment', async () => {
    query.mockResolvedValueOnce({ rows: [authRow] }).mockResolvedValueOnce({ rows: [] });

    const response = await authenticatedGet(`/api/v1/customer/shipments/${shipmentId}`);

    expect(response.status).toBe(404);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /s\.customer_account_id = \$1[\s\S]*o\.customer_account_id = \$1/,
      ),
      [accountId, shipmentId],
    );
  });
});

function authenticatedGet(path: string) {
  return request(createApp()).get(path).set('Cookie', `customer_session=${createToken()}`);
}

function createToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, type: 'customer', iat: now, exp: now + 3600 }),
  ).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}
