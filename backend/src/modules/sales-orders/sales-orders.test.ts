import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-sales-orders-secret-with-32-plus-chars';
  process.env.JWT_EXPIRES_IN = '1h';
});

const { query, connect, clientQuery, release } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock('../../database/pool.js', () => ({
  pool: { query, connect },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';
import { salesTokenService } from '../sales-auth/sales-token.service.js';

const salesUserId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const customerAccountId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';

const salesUserRow = {
  id: salesUserId,
  name: 'Sales Reviewer',
  email: 'sales@example.com',
  password_hash: 'hash',
  is_active: true,
  role: 'SALES_REP',
};

const authHeader = () =>
  `Bearer ${salesTokenService.createToken({ sub: salesUserId, type: 'sales' })}`;

function processingCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    order_number: 'ORD-2026-000001',
    status: 'SUBMITTED',
    customer_status: 'ACTIVE',
    product_active: true,
    requested_quantity_tons: '20.000',
    fulfilment_type: 'DELIVERY',
    hader_city_id: '55555555-5555-4555-8555-555555555555',
    hader_city_name: 'Jeddah',
    customer_account_id: customerAccountId,
    preferred_delivery_date: '2026-09-01',
    ship_to_location_id: 'SHIP-TO-01',
    ship_to_snapshot: { id: 'SHIP-TO-01', name: 'Main Site', city: 'Jeddah' },
    pickup_location_id: null,
    pickup_location_name: null,
    ...overrides,
  };
}

function orderReadRow(status = 'PROCESSING') {
  return {
    id: orderId,
    order_number: 'ORD-2026-000001',
    contract_id: null,
    contract_reference: null,
    customer_account_id: customerAccountId,
    company_name: 'Cement Customer',
    status,
    fulfilment_type: 'DELIVERY',
    requested_quantity_tons: '20.000',
    remaining_contract_quantity_snapshot: null,
    approved_customer_rate_per_ton: '235.00',
    amount: '4700.00',
    vat_rate: '15.00',
    vat_amount: '705.00',
    grand_total: '5405.00',
    preferred_delivery_date: '2026-09-01',
    delivery_notes: 'Call before arrival',
    ship_to_snapshot: { id: 'SHIP-TO-01', name: 'Main Site', city: 'Jeddah' },
    pickup_location_id: null,
    pickup_location_name: null,
    customer_truck_id: null,
    customer_driver_id: null,
    pickup_truck_snapshot: null,
    pickup_driver_snapshot: null,
    hader_city_name: 'Jeddah',
    submitted_at: '2026-08-28T08:00:00.000Z',
    created_at: '2026-08-28T08:00:00.000Z',
    updated_at: '2026-08-28T08:30:00.000Z',
    processed_by_sales_user_id: status === 'PROCESSING' ? salesUserId : null,
    processed_at: status === 'PROCESSING' ? '2026-08-28T08:30:00.000Z' : null,
    product_id: productId,
    product_code: 'CEM-OPC-50KG',
    product_name: 'Ordinary Portland Cement',
    packaging: 'Bag',
    contract_uom: '50KG_BAG',
    unit_weight_kg: '50.000',
    packaging_quantity: '400.000',
    delivery_request_id: status === 'PROCESSING' ? '66666666-6666-4666-8666-666666666666' : null,
    delivery_request_number: status === 'PROCESSING' ? 'DR-2026-000001' : null,
    delivery_request_status: status === 'PROCESSING' ? 'PENDING' : null,
  };
}

describe('Sales order review and processing API', () => {
  beforeEach(() => {
    query.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('returns an order detail to an authenticated Sales representative', async () => {
    query.mockResolvedValueOnce({ rows: [salesUserRow] });
    query.mockResolvedValueOnce({ rows: [orderReadRow('SUBMITTED')] });

    const response = await request(createApp())
      .get(`/api/v1/sales/orders/${orderId}`)
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.data.order).toMatchObject({
      orderNumber: 'ORD-2026-000001',
      orderType: 'DIRECT',
      status: 'SUBMITTED',
      requestedQuantityTons: 20,
    });
  });

  it('moves a valid submitted order to processing and records the audit event', async () => {
    query.mockResolvedValueOnce({ rows: [salesUserRow] });
    connect.mockResolvedValueOnce({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of orders'))
        return Promise.resolve({ rows: [processingCandidate()] });
      if (sql.includes('insert into delivery_requests'))
        return Promise.resolve({
          rows: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              request_number: 'DR-2026-000001',
              status: 'PENDING',
            },
          ],
        });
      return Promise.resolve({ rows: [] });
    });
    query.mockResolvedValueOnce({ rows: [orderReadRow()] });

    const response = await request(createApp())
      .post(`/api/v1/sales/orders/${orderId}/start-processing`)
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.data.order.status).toBe('PROCESSING');
    expect(response.body.data.order.deliveryRequest).toMatchObject({
      requestNumber: 'DR-2026-000001',
      status: 'PENDING',
    });
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("set status = 'PROCESSING'"), [
      orderId,
      salesUserId,
    ]);
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('ORDER_PROCESSING_STARTED'),
      expect.arrayContaining([orderId, salesUserId]),
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('insert into delivery_requests'),
      expect.arrayContaining([orderId, customerAccountId]),
    );
    expect(clientQuery).toHaveBeenCalledWith('commit');
  });

  it('does not create a delivery request for a pick-up order', async () => {
    query.mockResolvedValueOnce({ rows: [salesUserRow] });
    connect.mockResolvedValueOnce({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of orders')) {
        return Promise.resolve({
          rows: [
            processingCandidate({
              fulfilment_type: 'PICKUP',
              hader_city_id: null,
              hader_city_name: null,
              ship_to_location_id: null,
              ship_to_snapshot: null,
              preferred_delivery_date: null,
              pickup_location_id: 'PLANT-01',
              pickup_location_name: 'Main Plant',
            }),
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    query.mockResolvedValueOnce({
      rows: [
        {
          ...orderReadRow(),
          fulfilment_type: 'PICKUP',
          hader_city_name: null,
          pickup_location_id: 'PLANT-01',
          pickup_location_name: 'Main Plant',
        },
      ],
    });

    const response = await request(createApp())
      .post(`/api/v1/sales/orders/${orderId}/start-processing`)
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('insert into delivery_requests'),
      expect.anything(),
    );
  });

  it('reuses an existing delivery request instead of duplicating the handoff', async () => {
    query.mockResolvedValueOnce({ rows: [salesUserRow] });
    connect.mockResolvedValueOnce({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of orders'))
        return Promise.resolve({ rows: [processingCandidate()] });
      if (sql.includes('insert into delivery_requests')) return Promise.resolve({ rows: [] });
      if (sql.includes('select id,request_number,status from delivery_requests')) {
        return Promise.resolve({
          rows: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              request_number: 'DR-2026-000001',
              status: 'PENDING',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    query.mockResolvedValueOnce({ rows: [orderReadRow()] });

    const response = await request(createApp())
      .post(`/api/v1/sales/orders/${orderId}/start-processing`)
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(
      clientQuery.mock.calls.filter(([sql]) =>
        String(sql).includes('insert into delivery_requests'),
      ),
    ).toHaveLength(1);
    expect(
      clientQuery.mock.calls.some(([sql]) => String(sql).includes('DELIVERY_REQUEST_CREATED')),
    ).toBe(false);
  });

  it('does not process an order with invalid delivery details', async () => {
    query.mockResolvedValueOnce({ rows: [salesUserRow] });
    connect.mockResolvedValueOnce({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of orders')) {
        return Promise.resolve({ rows: [processingCandidate({ ship_to_snapshot: null })] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/sales/orders/${orderId}/start-processing`)
      .set('Authorization', authHeader());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ORDER_DELIVERY_DETAILS_INVALID');
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("set status = 'PROCESSING'"),
      expect.anything(),
    );
  });

  it('blocks duplicate processing', async () => {
    query.mockResolvedValueOnce({ rows: [salesUserRow] });
    connect.mockResolvedValueOnce({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of orders')) {
        return Promise.resolve({ rows: [processingCandidate({ status: 'PROCESSING' })] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/sales/orders/${orderId}/start-processing`)
      .set('Authorization', authHeader());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ORDER_ALREADY_PROCESSING');
  });

  it('does not accept a customer session on the Sales processing endpoint', async () => {
    const response = await request(createApp())
      .post(`/api/v1/sales/orders/${orderId}/start-processing`)
      .set('Cookie', 'customer_session=customer-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SALES_AUTH_REQUIRED');
    expect(connect).not.toHaveBeenCalled();
  });
});
