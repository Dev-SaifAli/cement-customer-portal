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
            <Route element={<RequireRoles roles={['PRICING_ADMIN']} />}>
              <Route path="product-prices" element={<AdminProductPrices />} />
            </Route>
            <Route element={<RequireRoles roles={['PRICING_ADMIN', 'HADER_MANAGER']} />}>
              <Route path="transporters" element={<AdminLogisticsPage kind="transporters" />} />
              <Route
                path="transporters/costs"
                element={<AdminLogisticsPage kind="transporter-costs" />}
              />
            </Route>
            <Route
              element={
                <RequireRoles
                  roles={['PRICING_ADMIN', 'HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER']}
                />
              }
            >
              <Route path="delivery-fleet" element={<AdminLogisticsPage kind="fleet" />} />
              <Route path="delivery-drivers" element={<AdminLogisticsPage kind="drivers" />} />
            </Route>
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

  if (
    !['PRICING_ADMIN', 'HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER'].includes(user.role)
  ) {
    return <Navigate to={getSalesLandingPath(user.role)} replace />;
  }

  return <Outlet />;
}

function RequireRoles({
  roles,
}: {
  roles: Array<NonNullable<ReturnType<typeof useSalesAuth>['user']>['role']>;
}) {
  const { user } = useSalesAuth();
  if (!user || !roles.includes(user.role))
    return <Navigate to={user ? getSalesLandingPath(user.role) : '/sales/login'} replace />;
  return <Outlet />;
}
