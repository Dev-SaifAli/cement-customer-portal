import { describe, expect, it } from 'vitest';
import { getSalesLandingPath, getSalesRoleLabel } from './salesRouting';

describe('Sales role landing routes', () => {
  it.each([
    ['SALES_REP', '/sales/dashboard'],
    ['HADER_MANAGER', '/sales/quotations'],
    ['PRICE_MANAGER', '/sales/quotations'],
    ['PRICING_ADMIN', '/admin/product-prices'],
  ] as const)('routes %s to %s', (role, path) => {
    expect(getSalesLandingPath(role)).toBe(path);
  });

  it('provides clear internal role labels', () => {
    expect(getSalesRoleLabel('HADER_MANAGER')).toBe('Hader Manager');
    expect(getSalesRoleLabel('PRICE_MANAGER')).toBe('Price Manager');
    expect(getSalesRoleLabel('PRICING_ADMIN')).toBe('Pricing Administrator');
  });
});
