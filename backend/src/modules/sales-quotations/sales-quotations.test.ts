import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-sales-quotations-secret-with-32-plus-chars';
  process.env.QUOTATION_VAT_RATE = '0.15';
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
const quotationId = '22222222-2222-4222-8222-222222222222';
const pricingCityId = '66666666-6666-4666-8666-666666666666';
const salesUser = {
  id: salesUserId,
  name: 'Sales Reviewer',
  email: 'sales@example.com',
  password_hash: 'hash',
  is_active: true,
  role: 'SALES_REP',
};
const quotation = {
  id: quotationId,
  reference: 'QT-2026-000123',
  customer_account_id: '33333333-3333-4333-8333-333333333333',
  customer_company_name: 'ABC Construction',
  pricing_city_id: pricingCityId,
  pricing_city_name: 'Jeddah',
  status: 'PENDING_HADER_APPROVAL',
  fulfilment_type: 'DELIVERY',
  pickup_location_id: null,
  ship_to_location_id: 'location-1',
  requested_date: '2026-09-01',
  notes: null,
  submitted_at: '2026-08-24T08:00:00.000Z',
  created_at: '2026-08-24T08:00:00.000Z',
  updated_at: '2026-08-24T08:00:00.000Z',
  valid_until: '2026-09-30',
  payment_terms: '30 Days From Invoice Date',
  commercial_notes: null,
  subtotal: '1000.00',
  vat_rate: '0.15',
  vat_amount: '150.00',
  grand_total: '1150.00',
  product_price_changed: false,
  delivery_price_changed: true,
  hader_approval_status: 'PENDING',
  price_approval_status: 'NOT_REQUIRED',
  contact: {},
  delivery_locations: [],
};
const authorization = () =>
  `Bearer ${salesTokenService.createToken({ sub: salesUserId, type: 'sales' })}`;

describe('sales quotations API', () => {
  beforeEach(() => {
    query.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('requires Sales authentication', async () => {
    const response = await request(createApp()).get('/api/v1/sales/quotations');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SALES_AUTH_REQUIRED');
  });

  it('rejects a Pricing Administrator from Sales quotations', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...salesUser, role: 'PRICING_ADMIN' }] });

    const response = await request(createApp())
      .get('/api/v1/sales/quotations')
      .set('Authorization', authorization());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('SALES_ROLE_FORBIDDEN');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('scopes a Hader Manager list to pending Hader approvals', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ ...salesUser, role: 'HADER_MANAGER' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .get('/api/v1/sales/quotations?page=1')
      .set('Authorization', authorization());

    expect(response.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('quotations.status = $1'), [
      'PENDING_HADER_APPROVAL',
    ]);
  });

  it('prevents an approval manager from opening a quotation outside their stage', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ ...salesUser, role: 'HADER_MANAGER' }] })
      .mockResolvedValueOnce({ rows: [{ ...quotation, status: 'UNDER_REVIEW' }] });

    const response = await request(createApp())
      .get(`/api/v1/sales/quotations/${quotationId}`)
      .set('Authorization', authorization());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('QUOTATION_ACCESS_FORBIDDEN');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('lists submitted quotations with fixed pagination', async () => {
    query
      .mockResolvedValueOnce({ rows: [salesUser] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ ...quotation, status: 'PENDING_SALES_REVIEW' }] })
      .mockResolvedValueOnce({ rows: [{ quotation_id: quotationId, count: '2' }] });

    const response = await request(createApp())
      .get('/api/v1/sales/quotations?page=1')
      .set('Authorization', authorization());

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    expect(response.body.data.items[0]).toMatchObject({
      reference: 'QT-2026-000123',
      customer: 'ABC Construction',
      itemCount: 2,
    });
  });

  it('resolves product and Hader baselines using the quotation destination city', async () => {
    query
      .mockResolvedValueOnce({ rows: [salesUser] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...quotation,
            status: 'UNDER_REVIEW',
            delivery_locations: [
              { id: 'location-1', name: 'Main Site', city: 'Jeddah', region: 'Makkah' },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            product_id: '55555555-5555-4555-8555-555555555555',
            product_code: 'CEM-OPC-50KG',
            product_name: 'Ordinary Portland Cement',
            product_image: null,
            unit_weight_kg: '50.000',
            is_white_cement: false,
            equivalent_tons: '0.500000',
            quantity: '10',
            uom: 'TON',
            packaging_type: 'Bag',
            product_list_price: null,
            product_price: null,
            delivery_list_price: null,
            delivery_price: null,
            customer_rate: null,
            amount: null,
            catalog_list_price: '150.00',
            catalog_delivery_list_price: '25.00',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .get(`/api/v1/sales/quotations/${quotationId}`)
      .set('Authorization', authorization());

    expect(response.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('from product_list_prices'),
      [quotationId, pricingCityId],
    );
    expect(response.body.data.quotation.items[0]).toMatchObject({
      productListPrice: 150,
      productPrice: 150,
      deliveryListPrice: 25,
      deliveryPrice: 25,
    });
  });

  it('does not allow a Sales representative to perform Hader approval', async () => {
    query.mockResolvedValueOnce({ rows: [salesUser] });
    connect.mockResolvedValueOnce({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [quotation] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .post(`/api/v1/sales/quotations/${quotationId}/approve`)
      .set('Authorization', authorization());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('QUOTATION_APPROVAL_FORBIDDEN');
    expect(
      clientQuery.mock.calls.some(([sql]) => String(sql).includes('HADER_MANAGER_APPROVED')),
    ).toBe(false);
  });

  it('does not allow an approval manager to prepare commercial pricing', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...salesUser, role: 'HADER_MANAGER' }] });

    const response = await request(createApp())
      .post(`/api/v1/sales/quotations/${quotationId}/start-review`)
      .set('Authorization', authorization());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('QUOTATION_COMMERCIAL_ACTION_FORBIDDEN');
    expect(connect).not.toHaveBeenCalled();
  });

  it('starts Sales review without locking nullable joined tables', async () => {
    const item = {
      id: '44444444-4444-4444-8444-444444444444',
      product_id: '55555555-5555-4555-8555-555555555555',
      product_code: 'CEM-OPC-50KG',
      product_name: 'Ordinary Portland Cement',
      product_image: null,
      unit_weight_kg: '50.000',
      is_white_cement: false,
      equivalent_tons: '0.500000',
      quantity: '10',
      uom: 'TON',
      packaging_type: 'Bag',
      product_list_price: null,
      product_price: null,
      delivery_list_price: null,
      delivery_price: null,
      customer_rate: null,
      amount: null,
      catalog_list_price: '150.00',
      catalog_delivery_list_price: '25.00',
    };
    query
      .mockResolvedValueOnce({ rows: [salesUser] })
      .mockResolvedValueOnce({ rows: [{ ...quotation, status: 'UNDER_REVIEW' }] })
      .mockResolvedValueOnce({ rows: [item] })
      .mockResolvedValueOnce({ rows: [] });
    connect.mockResolvedValueOnce({ query: clientQuery, release });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...quotation, status: 'PENDING_SALES_REVIEW' }] })
      .mockResolvedValueOnce({ rows: [item] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp())
      .post(`/api/v1/sales/quotations/${quotationId}/start-review`)
      .set('Authorization', authorization());

    expect(response.status).toBe(200);
    expect(response.body.data.quotation.status).toBe('UNDER_REVIEW');
    expect(clientQuery.mock.calls[1]?.[0]).toContain('for update of quotations');
  });

  it('requires a rejection reason before accessing the workflow', async () => {
    query.mockResolvedValueOnce({ rows: [salesUser] });
    const response = await request(createApp())
      .post(`/api/v1/sales/quotations/${quotationId}/reject`)
      .set('Authorization', authorization())
      .send({ reason: '' });

    expect(response.status).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });
});
