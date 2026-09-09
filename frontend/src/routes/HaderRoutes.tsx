import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSalesAuth } from '../context/SalesAuthContext';
import { SessionRestoreError } from '../components/auth/SessionRestoreError';
import { AppLoadingScreen } from '../components/ui/AppLoadingScreen';
import { CustomerThemeProvider } from '../context/CustomerThemeContext';
import { HaderDeliveryRequestDetails } from '../pages/hader/HaderDeliveryRequestDetails';
import { HaderDeliveryRequests } from '../pages/hader/HaderDeliveryRequests';
import { HaderLayout } from '../pages/hader/HaderLayout';
import { HaderShipmentCreate } from '../pages/hader/HaderShipmentCreate';
import { HaderShipmentDetails } from '../pages/hader/HaderShipmentDetails';
import { HaderShipments } from '../pages/hader/HaderShipments';
import { HaderDispatchBoard } from '../pages/hader/HaderDispatchBoard';
import { HaderDispatchDetails } from '../pages/hader/HaderDispatchDetails';
import { HaderLoadingControl } from '../pages/hader/HaderLoadingControl';
import { HaderLoadingDetails } from '../pages/hader/HaderLoadingDetails';
import { HaderDeliveryTeam } from '../pages/hader/HaderDeliveryTeam';
import { HaderDeliveryTeamDetails } from '../pages/hader/HaderDeliveryTeamDetails';
import { HaderLoadingPoints } from '../pages/hader/HaderLoadingPoints';
import { HaderContracts } from '../pages/hader/HaderContracts';
import { HaderContractDetails } from '../pages/hader/HaderContractDetails';
import { HaderOrders } from '../pages/hader/HaderOrders';
import { HaderOrderDetails } from '../pages/hader/HaderOrderDetails';
import { getOperationalContractAccess } from '../services/operationalContractsService';
import { getOperationalPortalPresentation } from '../utils/operationalPortal';

const roles = [
  'HADER_MANAGER',
  'HADER_OPERATIONS',
  'DISPATCH_USER',
  'LOADING_USER',
  'DELIVERY_TEAM_USER',
];
export function HaderRoutes() {
  return (
    <CustomerThemeProvider>
      <Routes>
        <Route element={<RequireHader />}>
          <Route element={<HaderLayout />}>
            <Route index element={<HaderLanding />} />
            <Route element={<RequireOperationalRoles roles={['HADER_MANAGER', 'HADER_OPERATIONS']} />}>
              <Route path="delivery-requests" element={<HaderDeliveryRequests />} />
              <Route path="delivery-requests/:id" element={<HaderDeliveryRequestDetails />} />
              <Route path="shipments" element={<HaderShipments />} />
              <Route path="shipments/create" element={<HaderShipmentCreate />} />
              <Route path="shipments/:id" element={<HaderShipmentDetails />} />
            </Route>
            <Route element={<RequireOperationalContracts />}>
              <Route path="contracts" element={<HaderContracts />} />
              <Route path="contracts/:id" element={<HaderContractDetails />} />
            </Route>
            <Route element={<RequireOperationalOrders />}>
              <Route path="orders" element={<HaderOrders />} />
              <Route path="orders/:id" element={<HaderOrderDetails />} />
            </Route>
            <Route element={<RequireOperationalRoles roles={['HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER', 'DELIVERY_TEAM_USER']} />}>
              <Route path="dispatch" element={<HaderDispatchBoard />} />
              <Route path="dispatch/:id" element={<HaderDispatchDetails />} />
              <Route path="dispatch-board" element={<HaderDispatchBoard />} />
              <Route path="dispatch-board/:id" element={<HaderDispatchDetails />} />
            </Route>
            <Route element={<RequireOperationalRoles roles={['HADER_MANAGER', 'HADER_OPERATIONS', 'LOADING_USER']} />}>
              <Route path="loading-control" element={<HaderLoadingControl />} />
              <Route path="loading-control/:id" element={<HaderLoadingDetails />} />
              <Route path="loading-points" element={<HaderLoadingPoints />} />
            </Route>
            <Route element={<RequireOperationalRoles roles={['HADER_MANAGER', 'HADER_OPERATIONS', 'DELIVERY_TEAM_USER']} />}>
              <Route path="delivery-team" element={<HaderDeliveryTeam />} />
              <Route path="delivery-team/:shipmentId" element={<HaderDeliveryTeamDetails />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<HaderLanding />} />
      </Routes>
    </CustomerThemeProvider>
  );
}
function RequireHader() {
  const { user, loading, restoreError, refresh } = useSalesAuth();
  const location = useLocation();
  if (loading) return <AppLoadingScreen label="Restoring your secure session" />;
  if (restoreError && !user) return <SessionRestoreError onRetry={() => void refresh()} />;
  if (!user) return <Navigate to="/sales/login" replace state={{ from: location }} />;
  if (!roles.includes(user.role)) return <Navigate to="/sales" replace />;
  if (user.role === 'DISPATCH_USER' && location.pathname.startsWith('/hader')) {
    return <Navigate to="/dispatch/orders" replace />;
  }
  if (location.pathname.startsWith('/dispatch') && user.role !== 'DISPATCH_USER') {
    return <Navigate to="/hader" replace />;
  }
  if (user.role === 'DELIVERY_TEAM_USER' && !location.pathname.startsWith('/hader/delivery-team')) {
    return <Navigate to="/hader/delivery-team" replace />;
  }
  return <Outlet />;
}
function RequireOperationalContracts() {
  const { user } = useSalesAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getOperationalContractAccess(controller.signal)
      .then((access) => setEnabled(access.enabled))
      .catch(() => setEnabled(false));
    return () => controller.abort();
  }, []);

  if (enabled === null) return <AppLoadingScreen label="Checking contract access" />;
  const { basePath } = getOperationalPortalPresentation(user?.role);
  return enabled ? <Outlet /> : <Navigate to={basePath} replace />;
}

function RequireOperationalOrders() {
  const { user } = useSalesAuth();
  return ['HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER'].includes(user?.role ?? '')
    ? <Outlet />
    : <Navigate to="/hader" replace />;
}

function RequireOperationalRoles({ roles: allowedRoles }: { roles: string[] }) {
  const { user } = useSalesAuth();
  const { basePath } = getOperationalPortalPresentation(user?.role);
  return allowedRoles.includes(user?.role ?? '') ? <Outlet /> : <Navigate to={`${basePath}/orders`} replace />;
}

function HaderLanding() {
  const { user } = useSalesAuth();
  const { basePath, isDispatch } = getOperationalPortalPresentation(user?.role);
  return (
    <Navigate
      to={
        isDispatch
          ? `${basePath}/orders`
          : user?.role === 'DELIVERY_TEAM_USER'
            ? '/hader/delivery-team'
            : '/hader/delivery-requests'
      }
      replace
    />
  );
}
