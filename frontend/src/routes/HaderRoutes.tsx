import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { SalesAuthProvider, useSalesAuth } from '../context/SalesAuthContext';
import { HaderDeliveryRequestDetails } from '../pages/hader/HaderDeliveryRequestDetails';
import { HaderDeliveryRequests } from '../pages/hader/HaderDeliveryRequests';
import { HaderLayout } from '../pages/hader/HaderLayout';
import { HaderShipmentCreate } from '../pages/hader/HaderShipmentCreate';
import { HaderShipmentDetails } from '../pages/hader/HaderShipmentDetails';
import { HaderShipments } from '../pages/hader/HaderShipments';

const roles = ['HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER'];
export function HaderRoutes() {
  return (
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
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/hader/delivery-requests" replace />} />
      </Routes>
    </SalesAuthProvider>
  );
}
function RequireHader() {
  const { user, loading } = useSalesAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        Restoring internal session...
      </div>
    );
  if (!user) return <Navigate to="/sales/login" replace state={{ from: location }} />;
  if (!roles.includes(user.role)) return <Navigate to="/sales" replace />;
  return <Outlet />;
}
