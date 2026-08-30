import { describe, expect, it } from 'vitest';
import { getSalesLandingPath, getSalesRoleLabel } from './salesRouting';

describe('Sales role landing routes', () => {
  it.each([
    ['SALES_REP', '/sales/dashboard'],
    ['HADER_MANAGER', '/hader/delivery-requests'],
    ['HADER_OPERATIONS', '/hader/delivery-requests'],
    ['DISPATCH_USER', '/hader/delivery-requests'],
    ['LOADING_USER', '/hader/loading-control'],
    ['DELIVERY_TEAM_USER', '/hader/delivery-team'],
    ['PRICE_MANAGER', '/sales/quotations'],
    ['PRICING_ADMIN', '/admin/products'],
  ] as const)('routes %s to %s', (role, path) => {
    expect(getSalesLandingPath(role)).toBe(path);
  });

  it('provides clear internal role labels', () => {
    expect(getSalesRoleLabel('HADER_MANAGER')).toBe('Hader Manager');
    expect(getSalesRoleLabel('PRICE_MANAGER')).toBe('Price Manager');
    expect(getSalesRoleLabel('PRICING_ADMIN')).toBe('Pricing Administrator');
  });
});
