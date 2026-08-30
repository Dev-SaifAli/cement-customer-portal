import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { SessionRestoreError } from '../components/auth/SessionRestoreError';
import { CustomerThemeProvider } from '../context/CustomerThemeContext';
import { useSalesAuth } from '../context/SalesAuthContext';
import { AdminUsers } from '../pages/admin/AdminUsers';
import { PortalAdminLayout } from '../pages/portal-admin/PortalAdminLayout';
import { PortalAdminNotifications } from '../pages/portal-admin/PortalAdminNotifications';
import { getSalesLandingPath } from '../utils/salesRouting';

export function PortalAdminRoutes() {
  return (
    <CustomerThemeProvider>
      <div className="customer-portal !min-h-0">
        <Routes>
          <Route element={<RequirePortalAdministrator />}>
            <Route element={<PortalAdminLayout />}>
              <Route index element={<Navigate to="users" replace />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="notifications" element={<PortalAdminNotifications />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/portal-admin/users" replace />} />
        </Routes>
      </div>
    </CustomerThemeProvider>
  );
}

function RequirePortalAdministrator() {
  const { user, loading, restoreError, refresh } = useSalesAuth();
  const location = useLocation();

  if (loading) {
    return <div className="customer-page-bg customer-secondary flex min-h-screen items-center justify-center">Restoring administration session...</div>;
  }
  if (restoreError && !user) return <SessionRestoreError onRetry={() => void refresh()} />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />;
  if (user.role !== 'PORTAL_ADMINISTRATOR') return <Navigate to={getSalesLandingPath(user.role)} replace />;
  return <Outlet />;
}
