import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useSalesAuth } from '../context/SalesAuthContext';
import { SessionRestoreError } from '../components/auth/SessionRestoreError';
import { AppLoadingScreen } from '../components/ui/AppLoadingScreen';
import { CustomerThemeProvider } from '../context/CustomerThemeContext';
import { SalesLayout } from '../pages/sales/SalesLayout';
import { SalesApplicationDetailsPage } from '../pages/sales/SalesApplicationDetails';
import { SalesApplicationsPage } from '../pages/sales/SalesApplications';
import { SalesContractDetailsPage } from '../pages/sales/SalesContractDetails';
import { SalesContractsPage } from '../pages/sales/SalesContracts';
import { SalesDashboard } from '../pages/sales/SalesDashboard';
import { SalesLogin } from '../pages/sales/SalesLogin';
import { SalesOrdersPage } from '../pages/sales/SalesOrders';
import { SalesOrderDetailsPage } from '../pages/sales/SalesOrderDetails';
import { SalesTicketDetailsPage } from '../pages/sales/SalesTicketDetails';
import { SalesTicketsPage } from '../pages/sales/SalesTickets';
import { SalesQuotationDetailsPage } from '../pages/sales/SalesQuotationDetails';
import { SalesQuotationsPage } from '../pages/sales/SalesQuotations';
import { HaderShipments } from '../pages/hader/HaderShipments';
import { HaderShipmentDetails } from '../pages/hader/HaderShipmentDetails';
import { PriceManagerShipToVariancesPage } from '../pages/sales/PriceManagerShipToVariances';
import { PriceManagerShipToVarianceDetailsPage } from '../pages/sales/PriceManagerShipToVarianceDetails';
import { CommercialDirectorVarianceApprovalsPage } from '../pages/sales/CommercialDirectorVarianceApprovals';
import { CommercialDirectorVarianceApprovalDetailsPage } from '../pages/sales/CommercialDirectorVarianceApprovalDetails';
import { getSalesLandingPath } from '../utils/salesRouting';

export function SalesRoutes() {
  return (
    <CustomerThemeProvider>
      <Routes>
        <Route path="login" element={<SalesLogin />} />
        <Route element={<RequireSalesAuth />}>
          <Route element={<SalesLayout />}>
            <Route index element={<SalesRoleLanding />} />
            <Route element={<RequireSalesRoles roles={['SALES_REP']} />}>
              <Route path="dashboard" element={<SalesDashboard />} />
              <Route path="applications" element={<SalesApplicationsPage />} />
              <Route path="applications/:id" element={<SalesApplicationDetailsPage />} />
              <Route path="contracts" element={<SalesContractsPage />} />
              <Route path="contracts/:id" element={<SalesContractDetailsPage />} />
              <Route path="orders" element={<SalesOrdersPage />} />
              <Route path="orders/:id" element={<SalesOrderDetailsPage />} />
              <Route path="tickets" element={<SalesTicketsPage />} />
              <Route path="tickets/:id" element={<SalesTicketDetailsPage />} />
              <Route path="shipments" element={<HaderShipments audience="sales" />} />
              <Route path="shipments/:id" element={<HaderShipmentDetails audience="sales" />} />
            </Route>
            <Route
              element={
                <RequireSalesRoles roles={['SALES_REP', 'HADER_MANAGER', 'PRICE_MANAGER']} />
              }
            >
              <Route path="quotations" element={<SalesQuotationsPage />} />
              <Route path="quotations/:id" element={<SalesQuotationDetailsPage />} />
            </Route>
            <Route element={<RequireSalesRoles roles={['PRICE_MANAGER']} />}>
              <Route path="ship-to-variance" element={<PriceManagerShipToVariancesPage />} />
              <Route
                path="ship-to-variance/:id"
                element={<PriceManagerShipToVarianceDetailsPage />}
              />
            </Route>
            <Route element={<RequireSalesRoles roles={['COMMERCIAL_DIRECTOR']} />}>
              <Route path="ship-to-variance-approvals" element={<CommercialDirectorVarianceApprovalsPage />} />
              <Route path="ship-to-variance-approvals/:id" element={<CommercialDirectorVarianceApprovalDetailsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<SalesRoleLanding />} />
      </Routes>
    </CustomerThemeProvider>
  );
}

function RequireSalesRoles({
  roles,
}: {
  roles: Array<
    | 'SALES_REP'
    | 'HADER_MANAGER'
    | 'HADER_OPERATIONS'
    | 'DISPATCH_USER'
    | 'LOADING_USER'
    | 'DELIVERY_TEAM_USER'
    | 'PRICE_MANAGER'
    | 'PRICING_ADMIN'
    | 'COMMERCIAL_DIRECTOR'
    | 'PORTAL_ADMINISTRATOR'
  >;
}) {
  const { user, loading, restoreError, refresh } = useSalesAuth();

  if (loading) return <AppLoadingScreen label="Restoring your secure session" />;
  if (restoreError && !user) return <SessionRestoreError onRetry={() => void refresh()} />;
  if (!user) return <Navigate to="/sales/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={getSalesLandingPath(user.role)} replace />;
  return <Outlet />;
}

function SalesRoleLanding() {
  const { user, loading, restoreError, refresh } = useSalesAuth();

  if (loading) return <AppLoadingScreen label="Restoring your secure session" />;
  if (restoreError && !user) return <SessionRestoreError onRetry={() => void refresh()} />;
  return <Navigate to={user ? getSalesLandingPath(user.role) : '/sales/login'} replace />;
}

function RequireSalesAuth() {
  const { user, loading, restoreError, refresh } = useSalesAuth();
  const location = useLocation();

  if (loading) return <AppLoadingScreen label="Restoring your secure session" />;

  if (restoreError && !user) {
    return <SessionRestoreError onRetry={() => void refresh()} />;
  }

  if (!user) {
    return <Navigate to="/sales/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
