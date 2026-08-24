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
