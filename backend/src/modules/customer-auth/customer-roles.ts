export const customerRoles = [
  'CUSTOMER_ADMIN',
  'PURCHASER',
  'FINANCE_USER',
  'VIEWER',
] as const;

export type CustomerRole = (typeof customerRoles)[number];

export const customerRoleLabels: Record<CustomerRole, string> = {
  CUSTOMER_ADMIN: 'Customer Administrator',
  PURCHASER: 'Purchaser',
  FINANCE_USER: 'Finance User',
  VIEWER: 'Viewer',
};

export function isCustomerRole(value: unknown): value is CustomerRole {
  return typeof value === 'string' && customerRoles.includes(value as CustomerRole);
}
