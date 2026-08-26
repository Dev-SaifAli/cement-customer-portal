import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-orders-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { connect, poolQuery, clientQuery, release } = vi.hoisted(() => ({
  connect: vi.fn(),
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock('../../database/pool.js', () => ({
  pool: { query: poolQuery, connect },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

const customerUserId = '11111111-1111-4111-8111-111111111111';
const customerAccountId = '22222222-2222-4222-8222-222222222222';
const contractId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';
const cityId = '66666666-6666-4666-8666-666666666666';
const clientRequestId = '99999999-9999-4999-8999-999999999999';

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
  registration_id: '77777777-7777-4777-8777-777777777777',
  company_name: 'Activated Cement Customer',
  account_status: 'ACTIVE',
  application_status: 'ACTIVATED',
};

const activeContractRow = {
  id: contractId,
  reference: 'CT-2026-000025',
  customer_account_id: customerAccountId,
  status: 'ACTIVE',
  product_id: productId,
  product_code: 'CEM-OPC-50KG',
  product_name: 'Ordinary Portland Cement',
  packaging: 'Bag',
  uom: '50KG_BAG',
  fulfilment: 'DELIVERY',
  pickup_location_id: null,
  delivery_location_id: 'SHIP-TO-01',
  delivery_city: 'Jeddah',
  pricing_city_id: cityId,
  registration_delivery_locations: [
    { id: 'SHIP-TO-01', name: 'Main Site', city: 'Jeddah', region: 'Makkah' },
  ],
  total_quantity_tons: '100.000',
  remaining_quantity_tons: '80.000',
  quantity: '100.000',
  product_price: '195.00',
  delivery_price: '40.00',
  contract_item_id: '88888888-8888-4888-8888-888888888888',
};

function createValidCustomerToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({ sub: customerUserId, type: 'customer', iat: now, exp: now + 3600 }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function createOrderRequest(quantity = 10) {
  return request(createApp())
    .post(`/api/v1/customer/contracts/${contractId}/orders`)
    .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
    .send({
      clientRequestId,
      requestedQuantityTons: quantity,
      preferredDeliveryDate: '2026-09-01',
      deliveryNotes: 'Call before arrival',
    });
}

function configureTransaction(contract = activeContractRow) {
  connect.mockResolvedValue({ query: clientQuery, release });
  clientQuery.mockImplementation((sql: string) => {
    if (sql.includes('from contracts') && sql.includes('for update of contracts')) {
      return Promise.resolve({ rows: contract ? [contract] : [] });
    }
    if (sql.includes("nextval('order_reference_seq')")) {
      return Promise.resolve({ rows: [{ sequence: '7' }] });
    }
    if (sql.includes('insert into orders')) {
      return Promise.resolve({
        rows: [
          {
            id: orderId,
            order_number: 'ORD-2026-000007',
            contract_id: contractId,
            customer_account_id: customerAccountId,
            ship_to_location_id: 'SHIP-TO-01',
            pickup_location_id: null,
            fulfilment_type: 'DELIVERY',
            hader_city_id: cityId,
            hader_city_name: 'Jeddah',
            created_by_customer_user_id: customerUserId,
            status: 'SUBMITTED',
            requested_quantity_tons: '10.000',
            remaining_contract_quantity_snapshot: '70.000',
            approved_customer_rate_per_ton: '235.00',
            amount: '2350.00',
            vat_rate: '15.00',
            vat_amount: '352.50',
            grand_total: '2702.50',
            submitted_at: '2026-08-26T08:00:00.000Z',
            created_at: '2026-08-26T08:00:00.000Z',
            updated_at: '2026-08-26T08:00:00.000Z',
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
  });
}

describe('customer order from contract API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('requires customer authentication', async () => {
    const response = await request(createApp())
      .post(`/api/v1/customer/contracts/${contractId}/orders`)
      .send({ requestedQuantityTons: 10 });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
    expect(connect).not.toHaveBeenCalled();
  });

  it('creates a submitted order and atomically reduces remaining contract TON', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction();

    const response = await createOrderRequest(10);

    expect(response.status).toBe(201);
    expect(response.body.data.order).toMatchObject({
      orderNumber: 'ORD-2026-000007',
      contractId,
      status: 'SUBMITTED',
      requestedQuantityTons: 10,
      remainingContractQuantityTons: 70,
      fulfilmentType: 'DELIVERY',
      product: {
        id: productId,
        code: 'CEM-OPC-50KG',
      },
      customerRatePerTon: 235,
      subtotal: 2350,
    });
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('for update of contracts'), [
      contractId,
      customerAccountId,
    ]);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('update contracts'), [
      contractId,
      70,
    ]);
    expect(clientQuery).toHaveBeenCalledWith('commit');
    expect(release).toHaveBeenCalledOnce();
  });

  it('does not expose a contract owned by another customer', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction(null as unknown as typeof activeContractRow);

    const response = await createOrderRequest();

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CUSTOMER_CONTRACT_NOT_FOUND');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('insert into orders'),
      expect.anything(),
    );
  });

  it('rejects a contract that is not active', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction({ ...activeContractRow, status: 'DRAFT' });

    const response = await createOrderRequest();

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONTRACT_NOT_ACTIVE');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });

  it('rejects quantity above the locked remaining contract quantity', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction();

    const response = await createOrderRequest(80.001);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ORDER_QUANTITY_EXCEEDS_CONTRACT_REMAINING');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('update contracts'),
      expect.anything(),
    );
  });

  it('prevents a Viewer from creating an order', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ ...authenticatedCustomerUserRow, role: 'VIEWER' }],
    });

    const response = await createOrderRequest();

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CUSTOMER_ORDER_WRITE_FORBIDDEN');
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns the existing order for a repeated client request without reducing quantity twice', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('client_request_id = $2')) {
        return Promise.resolve({
          rows: [
            {
              id: orderId,
              order_number: 'ORD-2026-000007',
              contract_id: contractId,
              contract_reference: 'CT-2026-000025',
              customer_account_id: customerAccountId,
              company_name: 'Activated Cement Customer',
              status: 'SUBMITTED',
              fulfilment_type: 'DELIVERY',
              requested_quantity_tons: '10.000',
              remaining_contract_quantity_snapshot: '70.000',
              approved_customer_rate_per_ton: '235.00',
              amount: '2350.00',
              vat_rate: '15.00',
              vat_amount: '352.50',
              grand_total: '2702.50',
              preferred_delivery_date: '2026-09-01',
              delivery_notes: null,
              ship_to_snapshot: { id: 'SHIP-TO-01', name: 'Main Site' },
              pickup_location_id: null,
              pickup_location_name: null,
              hader_city_name: 'Jeddah',
              submitted_at: '2026-08-26T08:00:00.000Z',
              created_at: '2026-08-26T08:00:00.000Z',
              updated_at: '2026-08-26T08:00:00.000Z',
              product_id: productId,
              product_code: 'CEM-OPC-50KG',
              product_name: 'Ordinary Portland Cement',
              packaging: 'Bag',
              contract_uom: '50KG_BAG',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await createOrderRequest();

    expect(response.status).toBe(201);
    expect(response.body.data.order.orderNumber).toBe('ORD-2026-000007');
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('update contracts'),
      expect.anything(),
    );
    expect(clientQuery).toHaveBeenCalledWith('commit');
  });
});
