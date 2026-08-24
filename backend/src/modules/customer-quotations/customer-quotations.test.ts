import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-quotation-secret-with-32-plus-chars';
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

const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const registrationId = '33333333-3333-4333-8333-333333333333';
const quotationId = '44444444-4444-4444-8444-444444444444';
const productId = '55555555-5555-4555-8555-555555555555';

const authRow = {
  id: userId,
  customer_account_id: accountId,
  name: 'Customer Admin',
  email: 'admin@example.com',
  phone: '+966555000111',
  password_hash: 'not-returned',
  role: 'CUSTOMER_ADMIN',
  is_active: true,
  password_must_change: false,
  registration_id: registrationId,
  company_name: 'ABC Construction',
  account_status: 'ACTIVE',
  application_status: 'ACTIVATED',
};

const quotationRow = {
  id: quotationId,
  customer_account_id: accountId,
  pricing_city_id: null,
  reference: 'QT-2026-000123',
  status: 'READY_FOR_CUSTOMER',
  fulfilment_type: 'DELIVERY',
  pickup_location_id: null,
  ship_to_location_id: 'site-1',
  requested_date: '2026-09-01',
  notes: 'Deliver in the morning.',
  submitted_at: '2026-08-24T08:00:00.000Z',
  created_at: '2026-08-24T08:00:00.000Z',
  updated_at: '2026-08-24T09:00:00.000Z',
  valid_until: '2026-09-07',
  payment_terms: '30 Days From Invoice Date',
  commercial_notes: 'Customer-visible terms.',
  subtotal: '1750.00',
  vat_rate: '0.15',
  vat_amount: '262.50',
  grand_total: '2012.50',
};

const itemRow = {
  id: '66666666-6666-4666-8666-666666666666',
  quotation_id: quotationId,
  product_id: productId,
  packaging_type: 'Bag',
  uom: 'TON',
  quantity: '10',
  pallet_required: false,
  pallet_type: null,
  pallet_quantity: null,
  display_order: 0,
  product_code: 'CEM-OPC-50KG',
  product_name: 'Ordinary Portland Cement',
  description: null,
  short_description: null,
  image: null,
  category: 'Cement',
  unit_weight_kg: '50.000',
  equivalent_tons: '0.500000',
  product_list_price: '150.00',
  product_price: '150.00',
  delivery_list_price: '25.00',
  delivery_price: '25.00',
  customer_rate: '175.00',
  amount: '1750.00',
};

describe('customer quotation decisions', () => {
  beforeEach(() => {
    query.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockResolvedValue({ query: clientQuery, release });
  });

  it('accepts an owned ready quotation, records the customer actor, and returns safe pricing', async () => {
    query
      .mockResolvedValueOnce({ rows: [authRow] })
      .mockResolvedValueOnce({ rows: [{ ...quotationRow, status: 'ACCEPTED' }] })
      .mockResolvedValueOnce({ rows: [itemRow] })
      .mockResolvedValueOnce({ rows: [{ delivery_locations: [location] }] });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [quotationRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await authenticatedRequest('accept').send();

    expect(response.status).toBe(200);
    expect(response.body.data.quotation).toMatchObject({
      status: 'ACCEPTED',
      subtotal: 1750,
      vatAmount: 262.5,
      grandTotal: 2012.5,
      items: [{ customerRate: 175, amount: 1750 }],
    });
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('changed_by_customer_user_id'),
      [quotationId, 'ACCEPTED', 'CUSTOMER_ACCEPTED', null, userId],
    );
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('productPrice');
    expect(serialized).not.toContain('deliveryPrice');
    expect(serialized).not.toContain('password_hash');
  });

  it('requires a reason before rejecting', async () => {
    query.mockResolvedValueOnce({ rows: [authRow] });
    const response = await authenticatedRequest('reject').send({ reason: ' ' });
    expect(response.status).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });

  it('blocks duplicate decisions after the quotation leaves ready state', async () => {
    query.mockResolvedValueOnce({ rows: [authRow] });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...quotationRow, status: 'ACCEPTED' }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await authenticatedRequest('accept').send();
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CUSTOMER_QUOTATION_DECISION_CONFLICT');
  });

  it('cannot decide a quotation outside the authenticated account scope', async () => {
    query.mockResolvedValueOnce({ rows: [authRow] });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await authenticatedRequest('accept').send();
    expect(response.status).toBe(404);
    expect(clientQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('customer_account_id = $1'),
      [accountId, quotationId],
    );
  });
});

const location = {
  id: 'site-1',
  name: 'Main Site',
  siteId: 'SITE-1',
  streetAddress: 'Industrial Area',
  city: 'Jeddah',
  region: 'Makkah',
  country: 'Saudi Arabia',
  postalCode: '21442',
  contactPerson: 'Site Manager',
  contactPhone: '+966555000222',
  isPrimary: true,
};

function authenticatedRequest(action: 'accept' | 'reject' | 'request-clarification') {
  return request(createApp())
    .post(`/api/v1/customer/quotations/${quotationId}/${action}`)
    .set('Cookie', `customer_session=${createToken()}`);
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
