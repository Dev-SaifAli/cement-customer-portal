import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { SalesAuthProvider, useSalesAuth } from '../context/SalesAuthContext';
import { AdminProductPrices } from '../pages/admin/AdminProductPrices';
import { AdminHaderCities } from '../pages/admin/AdminHaderCities';
import { AdminLogisticsPage } from '../pages/admin/AdminLogisticsPage';
import { AdminLoadingPoints } from '../pages/admin/AdminLoadingPoints';
import { PricingAdminLayout } from '../pages/admin/PricingAdminLayout';
import { getSalesLandingPath } from '../utils/salesRouting';

export function AdminPricingRoutes() {
  return (
    <SalesAuthProvider>
      <Routes>
        <Route element={<RequireInternalAdmin />}>
          <Route element={<PricingAdminLayout />}>
            <Route element={<RequireBoundaryAccess />}>
              <Route path="hader-cities" element={<AdminHaderCities />} />
            </Route>
            <Route path="loading-points" element={<AdminLoadingPoints />} />
            <Route element={<RequirePricingAdmin />}>
              <Route path="product-prices" element={<AdminProductPrices />} />
              <Route
                path="transporters"
                element={<AdminLogisticsPage key="transporters" kind="transporters" />}
              />
              <Route
                path="transporters/costs"
                element={<AdminLogisticsPage key="transporter-costs" kind="transporter-costs" />}
              />
              <Route
                path="delivery-fleet"
                element={<AdminLogisticsPage key="fleet" kind="fleet" />}
              />
              <Route
                path="delivery-drivers"
                element={<AdminLogisticsPage key="drivers" kind="drivers" />}
              />
              <Route path="drivers" element={<Navigate to="/admin/delivery-drivers" replace />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/sales/login" replace />} />
      </Routes>
    </SalesAuthProvider>
  );
}

function RequirePricingAdmin() {
  const { user } = useSalesAuth();
  return user?.role === 'PRICING_ADMIN' ? (
    <Outlet />
  ) : (
    <Navigate to="/admin/hader-cities" replace />
  );
}

function RequireBoundaryAccess() {
  const { user } = useSalesAuth();
  return user?.role !== 'LOADING_USER' ? (
    <Outlet />
  ) : (
    <Navigate to="/admin/loading-points" replace />
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

  if (
    ![
      'PRICING_ADMIN',
      'HADER_MANAGER',
      'HADER_OPERATIONS',
      'DISPATCH_USER',
      'LOADING_USER',
    ].includes(user.role)
  ) {
    return <Navigate to={getSalesLandingPath(user.role)} replace />;
  }

  return <Outlet />;
}
