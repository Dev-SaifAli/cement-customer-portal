import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-products-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../../database/pool.js', () => ({
  pool: { query },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

const customerUserId = '11111111-1111-4111-8111-111111111111';
const customerAccountId = '22222222-2222-4222-8222-222222222222';

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
  registration_id: '33333333-3333-4333-8333-333333333333',
  company_name: 'Activated Cement Customer',
  account_status: 'ACTIVE',
  application_status: 'ACTIVATED',
};

const productRow = {
  id: '44444444-4444-4444-8444-444444444444',
  product_code: 'CEM-OPC-50KG',
  product_name: 'Ordinary Portland Cement',
  description: 'General purpose cement.',
  short_description: 'OPC cement',
  image: '/products/opc.png',
  packaging_type: 'Bag',
  uom: 'TON',
  category: 'Cement',
  display_order: 10,
  is_active: true,
  created_at: '2026-08-23T08:00:00.000Z',
  updated_at: '2026-08-23T09:00:00.000Z',
};

function createValidCustomerToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({
      sub: customerUserId,
      type: 'customer',
      iat: now,
      exp: now + 60 * 60,
    }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function authenticatedProductsRequest(path = '/api/v1/customer/products') {
  return request(createApp())
    .get(path)
    .set({
      Cookie: `customer_session=${createValidCustomerToken()}`,
    });
}

describe('customer products API', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('requires customer authentication', async () => {
    const response = await request(createApp()).get('/api/v1/customer/products');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('returns active customer-visible products with fixed pagination', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [productRow] });

    const response = await authenticatedProductsRequest();

    expect(response.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('where is_active = true'), []);
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining('limit $1'), [10, 0]);
    expect(response.body).toEqual({
      success: true,
      data: {
        items: [
          {
            id: productRow.id,
            productCode: 'CEM-OPC-50KG',
            productName: 'Ordinary Portland Cement',
            description: 'General purpose cement.',
            shortDescription: 'OPC cement',
            image: '/products/opc.png',
            packagingType: 'Bag',
            uom: 'TON',
            category: 'Cement',
            displayOrder: 10,
            isActive: true,
            createdAt: '2026-08-23T08:00:00.000Z',
            updatedAt: '2026-08-23T09:00:00.000Z',
            priceDisplay: 'PRICE_ON_REQUEST',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('cost');
    expect(JSON.stringify(response.body)).not.toContain('margin');
  });

  it('returns one active customer-visible product by id', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [productRow] });

    const response = await authenticatedProductsRequest(
      `/api/v1/customer/products/${productRow.id}`,
    );

    expect(response.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('and is_active = true'), [
      productRow.id,
    ]);
    expect(response.body).toEqual({
      success: true,
      data: {
        product: {
          id: productRow.id,
          productCode: 'CEM-OPC-50KG',
          productName: 'Ordinary Portland Cement',
          description: 'General purpose cement.',
          shortDescription: 'OPC cement',
          image: '/products/opc.png',
          packagingType: 'Bag',
          uom: 'TON',
          category: 'Cement',
          displayOrder: 10,
          isActive: true,
          createdAt: '2026-08-23T08:00:00.000Z',
          updatedAt: '2026-08-23T09:00:00.000Z',
          priceDisplay: 'PRICE_ON_REQUEST',
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('cost');
    expect(JSON.stringify(response.body)).not.toContain('margin');
  });

  it('returns 404 when the requested product is inactive or missing', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await authenticatedProductsRequest(
      `/api/v1/customer/products/${productRow.id}`,
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CUSTOMER_PRODUCT_NOT_FOUND');
  });

  it('supports search, category, packaging type and uom filters', async () => {
    query
      .mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await authenticatedProductsRequest(
      '/api/v1/customer/products?search=opc&category=Cement&packagingType=Bag&uom=TON&page=2',
    );

    expect(response.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('lower(category) = $2'), [
      '%opc%',
      'cement',
      'bag',
      'ton',
    ]);
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('lower(packaging_type) = $3'),
      ['%opc%', 'cement', 'bag', 'ton', 10, 10],
    );
    expect(response.body.data.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it('rejects invalid pagination without querying products', async () => {
    query.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });

    const response = await authenticatedProductsRequest('/api/v1/customer/products?page=0');

    expect(response.status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
