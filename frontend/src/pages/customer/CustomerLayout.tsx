import {
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  PackageSearch,
  MessageSquareText,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    roles: ['CUSTOMER_ADMIN'],
  },
  {
    to: '/customer/shipments',
    label: 'My Shipments',
    icon: <PackageCheck size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
  {
    to: '/customer/tickets',
    label: 'Service Requests',
    icon: <MessageSquareText size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
];

export function CustomerLayout() {
  const { logout, user } = useCustomerAuth();
  const { preference, setPreference } = useCustomerTheme();
  const navigate = useNavigate();
  const visibleNavigation = customerNavigation.filter(
    (item) => user?.role && item.roles.includes(user.role),
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AppShell
      portalLabel="Customer Portal"
      navigation={[{ items: visibleNavigation }]}
      user={{
        name: user?.name,
        email: user?.email,
        roleLabel: formatCustomerRole(user?.role),
      }}
      themePreference={preference}
      onThemeChange={setPreference}
      onLogout={handleLogout}
      collapseStorageKey="customer_sidebar_collapsed"
      headerActions={<NotificationBell audience="customer" />}
      profilePath="/customer/profile"
    />
  );
}

function formatCustomerRole(role: CustomerRole | null | undefined) {
  if (role === 'CUSTOMER_ADMIN') return 'Customer Administrator';
  if (role === 'PURCHASER') return 'Purchaser';
  if (role === 'FINANCE_USER') return 'Finance User';
  if (role === 'VIEWER') return 'Viewer';
  return 'Customer Portal User';
}
