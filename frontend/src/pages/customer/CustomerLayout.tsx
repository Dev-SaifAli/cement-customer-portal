import {
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  PackageSearch,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserCircle,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, type AppShellNavigationItem } from '../../components/app-shell/AppShell';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useCustomerTheme } from '../../context/CustomerThemeContext';
import type { CustomerRole } from '../../services/customerAuthService';

const customerNavigation: Array<AppShellNavigationItem & { roles: CustomerRole[] }> = [
  {
    to: '/customer/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
    end: true,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
  {
    to: '/customer/profile',
    label: 'Profile',
    icon: <UserCircle size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
  {
    to: '/customer/locations',
    label: 'Delivery Locations',
    icon: <MapPin size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER'],
  },
  {
    to: '/customer/users',
    label: 'Users',
    icon: <Users size={18} />,
    roles: ['CUSTOMER_ADMIN'],
  },
  {
    to: '/customer/products',
    label: 'Products',
    icon: <PackageSearch size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
  {
    to: '/customer/quotations',
    label: 'Quotations',
    icon: <FileText size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER'],
  },
  {
    to: '/customer/contracts',
    label: 'Contracts',
    icon: <BriefcaseBusiness size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
  {
    to: '/customer/orders/new',
    label: 'New Direct Order',
    icon: <ShoppingCart size={18} />,
    end: true,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER'],
  },
  {
    to: '/customer/orders',
    label: 'Orders',
    icon: <ShoppingBag size={18} />,
    isActive: (pathname) =>
      (pathname === '/customer/orders' || pathname.startsWith('/customer/orders/')) &&
      pathname !== '/customer/orders/new',
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
  {
    to: '/customer/fleet',
    label: 'My Trucks & Drivers',
    icon: <Truck size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER'],
  },
  {
    to: '/customer/shipments',
    label: 'My Shipments',
    icon: <PackageCheck size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
];

export function CustomerLayout() {
  const { account, logout, user } = useCustomerAuth();
  const { preference, setPreference } = useCustomerTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const visibleNavigation = customerNavigation.filter(
    (item) => user?.role && item.roles.includes(user.role),
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AppShell
      homePath="/customer/dashboard"
      portalLabel="Customer Portal"
      navigation={[{ items: visibleNavigation }]}
      pageContext={getPageContext(location.pathname)}
      user={{
        name: user?.name,
        email: user?.email,
        roleLabel: account?.companyName ?? 'Customer Portal',
      }}
      themePreference={preference}
      onThemeChange={setPreference}
      onLogout={handleLogout}
      collapseStorageKey="customer_sidebar_collapsed"
      headerActions={<NotificationBell audience="customer" />}
    />
  );
}

function getPageContext(pathname: string) {
  if (pathname.startsWith('/customer/quotations/')) {
    return {
      parent: 'Quotations',
      title: pathname.endsWith('/new') ? 'New Quotation' : 'Quotation Details',
    };
  }
  if (pathname === '/customer/quotations') return { title: 'Quotations' };
  if (pathname.startsWith('/customer/contracts/')) {
    if (pathname.endsWith('/order')) {
      return { parent: 'Contracts / Contract Details', title: 'Create Order' };
    }
    return { parent: 'Contracts', title: 'Contract Details' };
  }
  if (pathname === '/customer/contracts') return { title: 'Contracts' };
  if (pathname === '/customer/orders/new') return { parent: 'Orders', title: 'New Direct Order' };
  if (pathname.startsWith('/customer/orders/')) return { parent: 'Orders', title: 'Order Details' };
  if (pathname === '/customer/orders') return { title: 'Orders' };
  if (pathname.startsWith('/customer/shipments/')) return { parent: 'My Shipments', title: 'Shipment Details' };
  if (pathname === '/customer/shipments') return { title: 'My Shipments' };
  if (pathname.startsWith('/customer/products/')) return { parent: 'Products', title: 'Product Details' };

  const labels: Record<string, string> = {
    '/customer/dashboard': 'Dashboard',
    '/customer/profile': 'Profile',
    '/customer/locations': 'Delivery Locations',
    '/customer/fleet': 'My Trucks & Drivers',
    '/customer/users': 'Users',
    '/customer/products': 'Products',
  };
  return { title: labels[pathname] ?? 'Customer Portal' };
}
