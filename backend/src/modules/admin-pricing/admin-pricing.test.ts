import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-admin-pricing-secret-with-at-least-32-chars';
});

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../../database/pool.js', () => ({
  pool: { query },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';
import { salesTokenService } from '../sales-auth/sales-token.service.js';

const salesUserId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const cityId = '55555555-5555-4555-8555-555555555555';
const cityRow = {
  id: cityId,
  name: 'Jeddah',
  is_hader_enabled: true,
  is_active: true,
  updated_at: '2026-08-24T08:00:00.000Z',
};

function salesUser(role: 'SALES_REP' | 'PRICE_MANAGER' | 'HADER_MANAGER' | 'PRICING_ADMIN') {
  return {
    id: salesUserId,
    name: 'Pricing Manager',
    email: 'pricing@example.com',
    password_hash: 'not-returned',
    is_active: true,
    role,
  };
}

function authorization() {
  return `Bearer ${salesTokenService.createToken({ sub: salesUserId, type: 'sales' })}`;
}

describe('admin pricing API', () => {
  beforeEach(() => query.mockReset());

  it('requires Sales authentication', async () => {
    const response = await request(createApp()).get('/api/v1/admin/product-prices');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SALES_AUTH_REQUIRED');
  });

  it('does not allow a Sales representative to read pricing configuration', async () => {
    query.mockResolvedValueOnce({ rows: [salesUser('SALES_REP')] });

    const response = await request(createApp())
      .get('/api/v1/admin/product-prices')
      .set('Authorization', authorization());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PRICING_CONFIGURATION_FORBIDDEN');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('allows a Pricing Administrator to configure a product list price', async () => {
    query
      .mockResolvedValueOnce({ rows: [salesUser('PRICING_ADMIN')] })
      .mockResolvedValueOnce({ rows: [{ id: productId, packaging_type: 'Bag', uom: 'TON' }] })
      .mockResolvedValueOnce({ rows: [cityRow] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            product_id: productId,
            city_id: cityId,
            packaging_type: 'Bag',
            city: 'Jeddah',
            uom: 'TON',
            list_price: '150.00',
            configured_by_name: 'Pricing Manager',
            updated_at: '2026-08-24T08:00:00.000Z',
          },
        ],
      });

    const response = await request(createApp())
      .put(`/api/v1/admin/product-prices/products/${productId}`)
      .set('Authorization', authorization())
      .send({ cityId, listPrice: 150 });

    expect(response.status).toBe(200);
    expect(response.body.data.price).toMatchObject({
      productId,
      cityId,
      city: 'Jeddah',
      listPrice: 150,
    });
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('on conflict (product_id, city_id, packaging_key, uom)'),
      expect.arrayContaining([productId, 'Bag', 'bag', cityId, 'Jeddah', 'jeddah', 'TON', 150]),
    );
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
  });

  it('allows a Pricing Administrator to configure a city delivery price', async () => {
    query
      .mockResolvedValueOnce({ rows: [salesUser('PRICING_ADMIN')] })
      .mockResolvedValueOnce({ rows: [cityRow] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            city_id: cityId,
            city: 'Jeddah',
            uom: 'TON',
            delivery_price: '25.00',
            standard_delivery_price: '25.00',
            white_cement_delivery_price: '40.00',
            configured_by_name: 'Pricing Manager',
            updated_at: '2026-08-24T08:00:00.000Z',
          },
        ],
      });

    const response = await request(createApp())
      .put('/api/v1/admin/product-prices/delivery')
      .set('Authorization', authorization())
      .send({ cityId, standardDeliveryPrice: 25, whiteCementDeliveryPrice: 40 });

    expect(response.status).toBe(200);
    expect(response.body.data.price).toMatchObject({
      city: 'Jeddah',
      standardDeliveryPrice: 25,
      whiteCementDeliveryPrice: 40,
    });
  });

  it('keeps approval managers from changing baseline pricing', async () => {
    query.mockResolvedValueOnce({ rows: [salesUser('PRICE_MANAGER')] });
    const productResponse = await request(createApp())
      .put(`/api/v1/admin/product-prices/products/${productId}`)
      .set('Authorization', authorization())
      .send({ cityId, listPrice: 150 });

    query.mockResolvedValueOnce({ rows: [salesUser('HADER_MANAGER')] });
    const deliveryResponse = await request(createApp())
      .put('/api/v1/admin/product-prices/delivery')
      .set('Authorization', authorization())
      .send({ cityId, standardDeliveryPrice: 25, whiteCementDeliveryPrice: 40 });

    expect(productResponse.status).toBe(403);
    expect(deliveryResponse.status).toBe(403);
  });
});
