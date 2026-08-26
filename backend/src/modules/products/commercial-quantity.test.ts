import { describe, expect, it } from 'vitest';
import {
  commercialTonsFromPackaging,
  packagingQuantityFromTons,
} from './commercial-quantity.js';

describe('commercial quantity conversions', () => {
  it('converts 20 bags of 50KG to 1 TON', () => {
    expect(commercialTonsFromPackaging(20, 50, '50KG_BAG')).toBe(1);
  });

  it('converts 20 TON to 400 bags of 50KG', () => {
    expect(packagingQuantityFromTons(20, 50, '50KG_BAG')).toBe(400);
  });

  it('keeps bulk TON as the commercial quantity', () => {
    expect(commercialTonsFromPackaging(12, 1000, 'TON')).toBe(12);
    expect(packagingQuantityFromTons(12, 1000, 'TON')).toBeNull();
  });
});
