import type { SalesUser } from '../services/salesService';

export function getSalesLandingPath(role: SalesUser['role']) {
  if (role === 'PORTAL_ADMINISTRATOR') return '/portal-admin/users';
  if (role === 'PRICING_ADMIN') return '/admin/products';
  if (role === 'HADER_MANAGER' || role === 'HADER_OPERATIONS' || role === 'DISPATCH_USER') {
    return '/hader/delivery-requests';
  }
  if (role === 'LOADING_USER') return '/hader/loading-control';
  if (role === 'DELIVERY_TEAM_USER') return '/hader/delivery-team';
  if (role === 'PRICE_MANAGER') return '/sales/quotations';
  if (role === 'COMMERCIAL_DIRECTOR') return '/sales/ship-to-variance-approvals';
  return '/sales/dashboard';
}

export function getSalesRoleLabel(role: SalesUser['role']) {
  const labels: Record<SalesUser['role'], string> = {
    SALES_REP: 'Sales Representative',
    HADER_MANAGER: 'Hader Manager',
    HADER_OPERATIONS: 'Hader Operations',
    DISPATCH_USER: 'Dispatch User',
    LOADING_USER: 'Loading Controller',
    DELIVERY_TEAM_USER: 'Delivery Team User',
    PRICE_MANAGER: 'Price Manager',
    PRICING_ADMIN: 'Pricing Administrator',
    COMMERCIAL_DIRECTOR: 'Commercial Director',
    PORTAL_ADMINISTRATOR: 'Portal Administrator',
  };
  return labels[role];
}
