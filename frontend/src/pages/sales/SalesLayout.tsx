import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  LifeBuoy,
  MapPinned,
  PackageCheck,
  ShoppingBag,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell, type AppShellNavigationItem } from '../../components/app-shell/AppShell';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { useCustomerTheme } from '../../context/CustomerThemeContext';
import { getSalesRoleLabel } from '../../utils/salesRouting';

export function SalesLayout() {
  const { user, logout } = useSalesAuth();
  const { preference, setPreference } = useCustomerTheme();
  const navigate = useNavigate();
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
    items.push({
      to: '/sales/ship-to-variance-approvals',
      label: 'Ship-to Variance Approvals',
      icon: <MapPinned size={18} />,
    });
  }
  if (user?.role === 'SALES_REP') {
    items.push(
      { to: '/sales/contracts', label: 'Contracts', icon: <BriefcaseBusiness size={18} /> },
      { to: '/sales/orders', label: 'Orders', icon: <ShoppingBag size={18} /> },
      { to: '/sales/tickets', label: 'Service Requests / Tickets', icon: <LifeBuoy size={18} /> },
      { to: '/sales/shipments', label: 'Shipments', icon: <PackageCheck size={18} /> },
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/sales/login', { replace: true });
  };

  return (
    <AppShell
      portalLabel="Sales Portal"
      navigation={[{ items }]}
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
