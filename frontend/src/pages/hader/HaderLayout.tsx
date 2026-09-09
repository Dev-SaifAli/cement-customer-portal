import {
  ClipboardList,
  Factory,
  MapPinned,
  Navigation,
  ShoppingCart,
  PackageCheck,
  Route,
  ScrollText,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppShell,
  type AppShellNavigationItem,
  type AppShellNavigationSection,
} from '../../components/app-shell/AppShell';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { useCustomerTheme } from '../../context/CustomerThemeContext';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { getSalesRoleLabel } from '../../utils/salesRouting';
import { getOperationalContractAccess } from '../../services/operationalContractsService';
import { getOperationalPortalPresentation } from '../../utils/operationalPortal';

export function HaderLayout() {
  const { user, logout } = useSalesAuth();
  const { preference, setPreference } = useCustomerTheme();
  const navigate = useNavigate();
  const loadingOnly = user?.role === 'LOADING_USER';
  const deliveryOnly = user?.role === 'DELIVERY_TEAM_USER';
  const haderManager = user?.role === 'HADER_MANAGER';
  const { basePath, isDispatch, portalLabel, contractsLabel, ordersLabel } =
    getOperationalPortalPresentation(user?.role);
  const [contractAccessEnabled, setContractAccessEnabled] = useState(false);
  useEffect(() => {
    if (!['HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER'].includes(user?.role ?? '')) return;
    const controller = new AbortController();
    void getOperationalContractAccess(controller.signal)
      .then((access) => setContractAccessEnabled(access.enabled))
      .catch(() => setContractAccessEnabled(false));
    return () => controller.abort();
  }, [user?.role]);
  const canViewLoadingPoints = [
    'HADER_MANAGER',
    'HADER_OPERATIONS',
    'DISPATCH_USER',
    'LOADING_USER',
  ].includes(user?.role ?? '');
  const operations: AppShellNavigationItem[] = [];

  if (isDispatch) {
    if (contractAccessEnabled) {
      operations.push({ to: `${basePath}/contracts`, label: contractsLabel, icon: <ScrollText size={18} /> });
    }
    operations.push(
      { to: `${basePath}/orders`, label: ordersLabel, icon: <ShoppingCart size={18} /> },
      { to: '/dispatch/dispatch-board', label: 'Dispatch Board', icon: <Route size={18} /> },
    );
  } else if (!loadingOnly && !deliveryOnly) {
    if (contractAccessEnabled) {
      operations.push({ to: '/hader/contracts', label: contractsLabel, icon: <ScrollText size={18} /> });
    }
    operations.push(
      { to: '/hader/orders', label: ordersLabel, icon: <ShoppingCart size={18} /> },
      { to: '/hader/delivery-requests', label: 'Delivery Requests', icon: <ClipboardList size={18} /> },
      { to: '/hader/shipments', label: 'Shipments', icon: <PackageCheck size={18} /> },
      { to: '/hader/dispatch', label: 'Dispatch Board', icon: <Route size={18} /> },
    );
  }
  if (!isDispatch && !deliveryOnly) {
    operations.push({ to: '/hader/loading-control', label: 'Loading Control', icon: <Factory size={18} /> });
  }
  if (!isDispatch && canViewLoadingPoints) {
    operations.push({ to: '/hader/loading-points', label: 'Silos & Bagging Lines', icon: <Factory size={18} /> });
  }
  if (deliveryOnly || user?.role === 'HADER_MANAGER' || user?.role === 'HADER_OPERATIONS') {
    operations.push({ to: '/hader/delivery-team', label: 'Delivery Team', icon: <Navigation size={18} /> });
  }

  const navigation: AppShellNavigationSection[] = [
    haderManager
      ? { label: 'Operations', items: operations, collapsible: true }
      : { items: operations },
  ];
  if (haderManager) {
    navigation.push({
      label: 'Master Data',
      items: [{ to: '/admin/hader-cities', label: 'Hader Cities', icon: <MapPinned size={18} /> }],
      collapsible: true,
    });
  }

  const handleLogout = async () => {
    await logout();
    navigate('/sales/login', { replace: true });
  };

  return (
    <AppShell
      portalLabel={portalLabel}
      navigation={navigation}
      user={{
        name: user?.name,
        email: user?.email,
        roleLabel: user ? getSalesRoleLabel(user.role) : portalLabel,
      }}
      themePreference={preference}
      onThemeChange={setPreference}
      onLogout={handleLogout}
      collapseStorageKey={isDispatch ? 'dispatch_sidebar_collapsed' : 'hader_sidebar_collapsed'}
      headerActions={<NotificationBell audience="sales" />}
    />
  );
}
