export interface OrderCreator {
  type: 'CUSTOMER' | 'INTERNAL';
  id: string;
  name: string;
  role: string | null;
}

export function formatOrderCreator(
  creator: OrderCreator | null,
  currentCustomerUserId?: string,
) {
  if (!creator) return '\u2014';
  if (creator.type === 'CUSTOMER') {
    if (currentCustomerUserId) return creator.id === currentCustomerUserId ? 'You' : creator.name;
    return `Customer \u2014 ${creator.name}`;
  }
  return `${friendlyCreatorRole(creator.role)} \u2014 ${creator.name}`;
}

function friendlyCreatorRole(role: string | null) {
  if (role === 'DISPATCH_USER') return 'Dispatch';
  if (role === 'HADER_MANAGER' || role === 'HADER_OPERATIONS') return 'Hader';
  if (role === 'SALES_REP') return 'Sales';
  if (role === 'PRICING_ADMIN' || role === 'PRICE_MANAGER') return 'Pricing';
  if (role === 'COMMERCIAL_DIRECTOR') return 'Commercial';
  if (role === 'PORTAL_ADMINISTRATOR') return 'Portal Admin';
  return 'Internal';
}
