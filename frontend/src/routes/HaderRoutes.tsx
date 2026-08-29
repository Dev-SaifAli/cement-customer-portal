import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { SalesAuthProvider, useSalesAuth } from '../context/SalesAuthContext';
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

const roles = ['HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER', 'LOADING_USER'];
export function HaderRoutes() {
  return (
    <CustomerThemeProvider>
      <SalesAuthProvider>
        <Routes>
          <Route element={<RequireHader />}>
            <Route element={<HaderLayout />}>
              <Route index element={<Navigate to="delivery-requests" replace />} />
              <Route path="delivery-requests" element={<HaderDeliveryRequests />} />
              <Route path="delivery-requests/:id" element={<HaderDeliveryRequestDetails />} />
              <Route path="shipments" element={<HaderShipments />} />
              <Route path="shipments/create" element={<HaderShipmentCreate />} />
              <Route path="shipments/:id" element={<HaderShipmentDetails />} />
              <Route path="dispatch" element={<HaderDispatchBoard />} />
              <Route path="dispatch/:id" element={<HaderDispatchDetails />} />
              <Route path="loading-control" element={<HaderLoadingControl />} />
              <Route path="loading-control/:id" element={<HaderLoadingDetails />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/hader/delivery-requests" replace />} />
        </Routes>
      </SalesAuthProvider>
    </CustomerThemeProvider>
  );
}
function RequireHader() {
  const { user, loading } = useSalesAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="customer-portal customer-page-bg customer-secondary flex min-h-screen items-center justify-center">
        Restoring internal session...
      </div>
    );
  if (!user) return <Navigate to="/sales/login" replace state={{ from: location }} />;
  if (!roles.includes(user.role)) return <Navigate to="/sales" replace />;
  return <Outlet />;
}
