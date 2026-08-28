import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { SalesAuthProvider, useSalesAuth } from '../context/SalesAuthContext';
import { AdminProductPrices } from '../pages/admin/AdminProductPrices';
import { AdminLogisticsPage } from '../pages/admin/AdminLogisticsPage';
import { PricingAdminLayout } from '../pages/admin/PricingAdminLayout';
import { getSalesLandingPath } from '../utils/salesRouting';

export function AdminPricingRoutes() {
  return (
    <SalesAuthProvider>
      <Routes>
        <Route element={<RequireInternalAdmin />}>
          <Route element={<PricingAdminLayout />}>
            <Route path="product-prices" element={<AdminProductPrices />} />
            <Route
              path="transporters"
              element={<AdminLogisticsPage key="transporters" kind="transporters" />}
            />
            <Route
              path="transporters/costs"
              element={
                <AdminLogisticsPage key="transporter-costs" kind="transporter-costs" />
              }
            />
            <Route
              path="delivery-fleet"
              element={<AdminLogisticsPage key="fleet" kind="fleet" />}
            />
            <Route
              path="drivers"
              element={<AdminLogisticsPage key="drivers" kind="drivers" />}
            />
            <Route path="delivery-drivers" element={<Navigate to="/admin/drivers" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/sales/login" replace />} />
      </Routes>
    </SalesAuthProvider>
  );
}

function RequireInternalAdmin() {
  const { user, loading } = useSalesAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-sm text-[#64748b]">
        Restoring secure pricing session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sales/login" replace state={{ from: location }} />;
  }

  if (user.role !== 'PRICING_ADMIN') {
    return <Navigate to={getSalesLandingPath(user.role)} replace />;
  }

  return <Outlet />;
}
