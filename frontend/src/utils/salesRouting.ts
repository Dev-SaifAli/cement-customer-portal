import type { SalesUser } from '../services/salesService';

export function getSalesLandingPath(role: SalesUser['role']) {
  if (role === 'PRICING_ADMIN') return '/admin/product-prices';
  if (role === 'HADER_MANAGER' || role === 'PRICE_MANAGER') return '/sales/quotations';
  return '/sales/dashboard';
}

export function getSalesRoleLabel(role: SalesUser['role']) {
  const labels: Record<SalesUser['role'], string> = {
    SALES_REP: 'Sales Representative',
    HADER_MANAGER: 'Hader Manager',
    PRICE_MANAGER: 'Price Manager',
    PRICING_ADMIN: 'Pricing Administrator',
  };
  return labels[role];
}
