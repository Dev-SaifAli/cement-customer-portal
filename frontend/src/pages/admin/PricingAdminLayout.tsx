import { Banknote, MapPinned, Package, Settings, Truck, Warehouse } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, type AppShellNavigationItem } from '../../components/app-shell/AppShell';
import { useCustomerTheme } from '../../context/CustomerThemeContext';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { getSalesRoleLabel } from '../../utils/salesRouting';

const adminNav: AppShellNavigationItem[] = [
  { to: '/admin/hader-cities', label: 'Hader Cities & Map', icon: <MapPinned size={18} /> },
  { to: '/admin/products', label: 'Products', icon: <Package size={18} /> },
  { to: '/admin/delivery-prices', label: 'Delivery Pricing', icon: <Banknote size={18} /> },
  { to: '/admin/transporters', label: 'Transporters & Cost', icon: <Warehouse size={18} /> },
  {
    to: '/admin/delivery-fleet',
    label: 'Delivery Fleet',
    icon: <Truck size={18} />,
    isActive: (pathname) =>
      pathname === '/admin/delivery-fleet' ||
      pathname.startsWith('/admin/delivery-fleet/') ||
      pathname === '/admin/delivery-drivers' ||
      pathname.startsWith('/admin/delivery-drivers/'),
  },
  { to: '/admin/pickup-locations', label: 'Pickup-from Locations', icon: <MapPinned size={18} /> },
  { to: '/admin/tax-configuration', label: 'Tax Configuration', icon: <Settings size={18} /> },
];

export function PricingAdminLayout() {
  const { user, logout } = useSalesAuth();
  const { preference, setPreference } = useCustomerTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const links = user?.role === 'PRICING_ADMIN' ? adminNav : adminNav.slice(0, 1);

  const handleLogout = async () => {
    await logout();
    navigate('/sales/login', { replace: true });
  };

  return (
    <AppShell
      homePath={links[0]?.to ?? '/admin/products'}
      portalLabel="Internal Administration"
      navigation={[{ items: links }]}
      pageContext={getPageContext(location.pathname)}
      user={{
        name: user?.name,
        email: user?.email,
        roleLabel: user ? getSalesRoleLabel(user.role) : 'Internal Administration',
      }}
      themePreference={preference}
      onThemeChange={setPreference}
      onLogout={handleLogout}
      collapseStorageKey="pricing_admin_sidebar_collapsed"
    />
  );
}

function getPageContext(pathname: string) {
  if (
    pathname === '/admin/delivery-drivers' ||
    pathname.startsWith('/admin/delivery-drivers/')
  ) {
    return {
      parent: 'Delivery Fleet',
      title: 'Drivers',
      subtitle: 'Products, delivery pricing and logistics data',
    };
  }
  const item = adminNav.find(
    ({ to, isActive }) =>
      isActive?.(pathname) ?? (pathname === to || pathname.startsWith(`${to}/`)),
  );
  return {
    title: item?.label ?? 'Internal Administration',
    subtitle: 'Products, delivery pricing and logistics data',
  };
}
