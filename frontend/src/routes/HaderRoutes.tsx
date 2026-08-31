import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
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
import { AdminLoadingPoints } from '../pages/admin/AdminLoadingPoints';

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
            <Route path="delivery-requests" element={<HaderDeliveryRequests />} />
            <Route path="delivery-requests/:id" element={<HaderDeliveryRequestDetails />} />
            <Route path="shipments" element={<HaderShipments />} />
            <Route path="shipments/create" element={<HaderShipmentCreate />} />
            <Route path="shipments/:id" element={<HaderShipmentDetails />} />
            <Route path="dispatch" element={<HaderDispatchBoard />} />
            <Route path="dispatch/:id" element={<HaderDispatchDetails />} />
            <Route path="loading-control" element={<HaderLoadingControl />} />
            <Route path="loading-control/:id" element={<HaderLoadingDetails />} />
            <Route path="loading-points" element={<AdminLoadingPoints />} />
            <Route path="delivery-team" element={<HaderDeliveryTeam />} />
            <Route path="delivery-team/:shipmentId" element={<HaderDeliveryTeamDetails />} />
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
  if (user.role === 'DELIVERY_TEAM_USER' && !location.pathname.startsWith('/hader/delivery-team')) {
    return <Navigate to="/hader/delivery-team" replace />;
  }
  return <Outlet />;
}

function HaderLanding() {
  const { user } = useSalesAuth();
  return (
    <Navigate
      to={user?.role === 'DELIVERY_TEAM_USER' ? '/hader/delivery-team' : '/hader/delivery-requests'}
      replace
    />
  );
}
