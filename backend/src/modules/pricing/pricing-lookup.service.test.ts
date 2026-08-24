import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../../database/pool.js', () => ({
  pool: { query },
}));

import { pricingLookupService } from './pricing-lookup.service.js';

describe('pricing lookup service', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('uses TON as the commercial product list price basis', async () => {
    query.mockResolvedValueOnce({ rows: [{ list_price: '190.00' }] });

    const price = await pricingLookupService.getProductListPrice({
      productId: 'product-1',
      cityId: 'city-1',
      packaging: 'Bag',
    });

    expect(price).toBe(190);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('product_list_prices'), [
      'product-1',
      'city-1',
      'Bag',
    ]);
  });

  it('uses city and cement type for Hader delivery lookup', async () => {
    query.mockResolvedValueOnce({ rows: [{ delivery_price: '45.00' }] });

    const price = await pricingLookupService.getHaderDeliveryPrice({
      cityId: 'city-1',
      isWhiteCement: true,
    });

    expect(price).toBe(45);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('hader_delivery_prices'), [
      'city-1',
      true,
    ]);
  });
});
