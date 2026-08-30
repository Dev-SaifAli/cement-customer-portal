import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { SessionRestoreError } from '../components/auth/SessionRestoreError';
import { CustomerThemeProvider } from '../context/CustomerThemeContext';
import { CustomerContractDetailsPage } from '../pages/customer/CustomerContractDetails';
import { CustomerContracts } from '../pages/customer/CustomerContracts';
import { CustomerLayout } from '../pages/customer/CustomerLayout';
import { CustomerLanding } from '../pages/customer/CustomerLanding';
import { CustomerLocations } from '../pages/customer/CustomerLocations';
import { CustomerCreateOrder } from '../pages/customer/CustomerCreateOrder';
import { CustomerDirectOrder } from '../pages/customer/CustomerDirectOrder';
import { CustomerOrderDetails } from '../pages/customer/CustomerOrderDetails';
import { CustomerOrders } from '../pages/customer/CustomerOrders';
import { CustomerProductDetails } from '../pages/customer/CustomerProductDetails';
import { CustomerProfile } from '../pages/customer/CustomerProfile';
import { CustomerProducts } from '../pages/customer/CustomerProducts';
import { CustomerQuotationNew } from '../pages/customer/CustomerQuotationNew';
import { CustomerQuotationRoute } from '../pages/customer/CustomerQuotationRoute';
import { CustomerQuotations } from '../pages/customer/CustomerQuotations';
import { CustomerUsers } from '../pages/customer/CustomerUsers';
import { CustomerFleet } from '../pages/customer/CustomerFleet';
import { CustomerShipmentDetails } from '../pages/customer/CustomerShipmentDetails';
import { CustomerShipments } from '../pages/customer/CustomerShipments';

export function CustomerRoutes() {
  return (
    <CustomerThemeProvider>
      <Routes>
        <Route element={<RequireCustomerAuth />}>
          <Route element={<CustomerLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CustomerLanding />} />
            <Route path="profile" element={<CustomerProfile />} />
            <Route path="locations" element={<CustomerLocations />} />
            <Route path="products" element={<CustomerProducts />} />
            <Route path="products/:id" element={<CustomerProductDetails />} />
            <Route path="quotations" element={<CustomerQuotations />} />
            <Route path="quotations/new" element={<CustomerQuotationNew />} />
            <Route path="quotations/:id" element={<CustomerQuotationRoute />} />
            <Route path="contracts" element={<CustomerContracts />} />
            <Route path="contracts/:id" element={<CustomerContractDetailsPage />} />
            <Route path="contracts/:id/order" element={<CustomerCreateOrder />} />
            <Route path="orders" element={<CustomerOrders />} />
            <Route path="orders/new" element={<CustomerDirectOrder />} />
            <Route path="orders/:id" element={<CustomerOrderDetails />} />
            <Route path="fleet" element={<CustomerFleet />} />
            <Route path="shipments" element={<CustomerShipments />} />
            <Route path="shipments/:id" element={<CustomerShipmentDetails />} />
            <Route path="users" element={<CustomerUsers />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/customer/dashboard" replace />} />
      </Routes>
    </CustomerThemeProvider>
  );
}

function RequireCustomerAuth() {
  const { loading, refresh, restoreError, user } = useCustomerAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-600">
        Restoring Customer session...
      </div>
    );
  }

  if (restoreError && !user) {
    return <SessionRestoreError onRetry={() => void refresh()} />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
