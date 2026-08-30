import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  MapPinned,
  PackageCheck,
  ShoppingBag,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, type AppShellNavigationItem } from '../../components/app-shell/AppShell';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { useCustomerTheme } from '../../context/CustomerThemeContext';
import { getSalesLandingPath, getSalesRoleLabel } from '../../utils/salesRouting';

export function SalesLayout() {
  const { user, logout } = useSalesAuth();
  const { preference, setPreference } = useCustomerTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const items: AppShellNavigationItem[] = [];

  if (user?.role === 'SALES_REP') {
    items.push(
      { to: '/sales/dashboard', label: 'Dashboard', icon: <BarChart3 size={18} />, end: true },
      { to: '/sales/applications', label: 'Applications', icon: <ClipboardList size={18} /> },
    );
  }
  if (user?.role !== 'COMMERCIAL_DIRECTOR') {
    items.push({ to: '/sales/quotations', label: 'Quotations', icon: <FileText size={18} /> });
  }
  if (user?.role === 'PRICE_MANAGER') {
    items.push({ to: '/sales/ship-to-variance', label: 'Ship-to Variance', icon: <MapPinned size={18} /> });
  }
  if (user?.role === 'COMMERCIAL_DIRECTOR') {
    items.push({ to: '/sales/ship-to-variance-approvals', label: 'Variance Approvals', icon: <MapPinned size={18} /> });
  }
  if (user?.role === 'SALES_REP') {
    items.push(
      { to: '/sales/contracts', label: 'Contracts', icon: <BriefcaseBusiness size={18} /> },
      { to: '/sales/orders', label: 'Orders', icon: <ShoppingBag size={18} /> },
      { to: '/sales/shipments', label: 'Shipments', icon: <PackageCheck size={18} /> },
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/sales/login', { replace: true });
  };

  return (
    <AppShell
      homePath={user ? getSalesLandingPath(user.role) : '/sales/login'}
      portalLabel="Sales Portal"
      navigation={[{ items }]}
      pageContext={getPageContext(location.pathname, user?.role)}
      user={{
        name: user?.name,
        email: user?.email,
        roleLabel: user ? getSalesRoleLabel(user.role) : 'Sales Portal',
      }}
      themePreference={preference}
      onThemeChange={setPreference}
      onLogout={handleLogout}
      collapseStorageKey="sales_sidebar_collapsed"
      headerActions={<NotificationBell audience="sales" />}
    />
  );
}

function getPageContext(pathname: string, role?: string) {
  if (pathname.startsWith('/sales/quotations')) {
    if (role === 'HADER_MANAGER') return { title: 'Delivery Price Approvals', subtitle: 'Review assigned delivery-price exceptions' };
    if (role === 'PRICE_MANAGER') return { title: 'Product Price Approvals', subtitle: 'Review assigned product-price exceptions' };
    return { title: 'Sales Quotations', subtitle: 'Review requirements and prepare customer quotations' };
  }
  if (pathname.startsWith('/sales/ship-to-variance')) {
    return role === 'COMMERCIAL_DIRECTOR'
      ? { title: 'Ship-to Variance Approvals', subtitle: 'Review pending extra-charge requests' }
      : { title: 'Ship-to Variance', subtitle: 'Review actual-city delivery price differences' };
  }
  if (pathname.startsWith('/sales/contracts')) return { title: 'Sales Contracts', subtitle: 'Manage accepted quotation contracts' };
  if (pathname.startsWith('/sales/orders')) return { title: 'Customer Orders', subtitle: 'Review and process submitted customer orders' };
  if (pathname.startsWith('/sales/shipments')) return { title: 'Customer Shipments', subtitle: 'Read-only shipment visibility' };
  if (pathname.startsWith('/sales/applications')) return { title: 'Sales Applications', subtitle: 'Review submitted customer applications' };
  return { title: 'Sales Portal', subtitle: 'Internal customer review workspace' };
}
