import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { SalesAuthProvider, useSalesAuth } from '../context/SalesAuthContext';
import { SalesLayout } from '../pages/sales/SalesLayout';
import { SalesApplicationDetailsPage } from '../pages/sales/SalesApplicationDetails';
import { SalesApplicationsPage } from '../pages/sales/SalesApplications';
import { SalesDashboard } from '../pages/sales/SalesDashboard';
import { SalesLogin } from '../pages/sales/SalesLogin';
import { SalesQuotationDetailsPage } from '../pages/sales/SalesQuotationDetails';
import { SalesQuotationsPage } from '../pages/sales/SalesQuotations';
import { getSalesLandingPath } from '../utils/salesRouting';

export function SalesRoutes() {
  return (
    <SalesAuthProvider>
      <Routes>
        <Route path="login" element={<SalesLogin />} />
        <Route element={<RequireSalesAuth />}>
          <Route element={<SalesLayout />}>
            <Route index element={<SalesRoleLanding />} />
            <Route element={<RequireSalesRoles roles={['SALES_REP']} />}>
              <Route path="dashboard" element={<SalesDashboard />} />
              <Route path="applications" element={<SalesApplicationsPage />} />
              <Route path="applications/:id" element={<SalesApplicationDetailsPage />} />
            </Route>
            <Route
              element={
                <RequireSalesRoles roles={['SALES_REP', 'HADER_MANAGER', 'PRICE_MANAGER']} />
              }
            >
              <Route path="quotations" element={<SalesQuotationsPage />} />
              <Route path="quotations/:id" element={<SalesQuotationDetailsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<SalesRoleLanding />} />
      </Routes>
    </SalesAuthProvider>
  );
}

function RequireSalesRoles({
  roles,
}: {
  roles: Array<'SALES_REP' | 'HADER_MANAGER' | 'PRICE_MANAGER' | 'PRICING_ADMIN'>;
}) {
  const { user, loading } = useSalesAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/sales/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={getSalesLandingPath(user.role)} replace />;
  return <Outlet />;
}

function SalesRoleLanding() {
  const { user, loading } = useSalesAuth();

  if (loading) return null;
  return <Navigate to={user ? getSalesLandingPath(user.role) : '/sales/login'} replace />;
}

function RequireSalesAuth() {
  const { user, loading } = useSalesAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Restoring Sales session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sales/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
