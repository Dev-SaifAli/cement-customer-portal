import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CustomerAuthProvider, useCustomerAuth } from '../context/CustomerAuthContext';
import { CustomerThemeProvider } from '../context/CustomerThemeContext';
import { CustomerContractDetailsPage } from '../pages/customer/CustomerContractDetails';
import { CustomerContracts } from '../pages/customer/CustomerContracts';
import { CustomerLayout } from '../pages/customer/CustomerLayout';
import { CustomerLanding } from '../pages/customer/CustomerLanding';
import { CustomerLocations } from '../pages/customer/CustomerLocations';
import { CustomerCreateOrder } from '../pages/customer/CustomerCreateOrder';
import { CustomerOrderDetails } from '../pages/customer/CustomerOrderDetails';
import { CustomerOrders } from '../pages/customer/CustomerOrders';
import { CustomerProductDetails } from '../pages/customer/CustomerProductDetails';
import { CustomerProfile } from '../pages/customer/CustomerProfile';
import { CustomerProducts } from '../pages/customer/CustomerProducts';
import { CustomerQuotationNew } from '../pages/customer/CustomerQuotationNew';
import { CustomerQuotationRoute } from '../pages/customer/CustomerQuotationRoute';
import { CustomerQuotations } from '../pages/customer/CustomerQuotations';
import { CustomerUsers } from '../pages/customer/CustomerUsers';

export function CustomerRoutes() {
  return (
    <CustomerThemeProvider>
      <CustomerAuthProvider>
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
              <Route path="orders/:id" element={<CustomerOrderDetails />} />
              <Route path="users" element={<CustomerUsers />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/customer/dashboard" replace />} />
        </Routes>
      </CustomerAuthProvider>
    </CustomerThemeProvider>
  );
}

function RequireCustomerAuth() {
  const { loading, user } = useCustomerAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-600">
        Restoring Customer session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
