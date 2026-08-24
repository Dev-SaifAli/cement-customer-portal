import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { SalesAuthProvider, useSalesAuth } from '../context/SalesAuthContext';
import { AdminProductPrices } from '../pages/admin/AdminProductPrices';
import { PricingAdminLayout } from '../pages/admin/PricingAdminLayout';
import { getSalesLandingPath } from '../utils/salesRouting';

export function AdminPricingRoutes() {
  return (
    <SalesAuthProvider>
      <Routes>
        <Route element={<RequirePricingAdmin />}>
          <Route element={<PricingAdminLayout />}>
            <Route path="product-prices" element={<AdminProductPrices />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/admin/product-prices" replace />} />
      </Routes>
    </SalesAuthProvider>
  );
}

function RequirePricingAdmin() {
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
