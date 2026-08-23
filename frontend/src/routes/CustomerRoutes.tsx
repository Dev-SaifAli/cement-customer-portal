import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CustomerAuthProvider, useCustomerAuth } from '../context/CustomerAuthContext';
import { CustomerLayout } from '../pages/customer/CustomerLayout';
import { CustomerLanding } from '../pages/customer/CustomerLanding';
import { CustomerLocations } from '../pages/customer/CustomerLocations';
import { CustomerProductDetails } from '../pages/customer/CustomerProductDetails';
import { CustomerProfile } from '../pages/customer/CustomerProfile';
import { CustomerProducts } from '../pages/customer/CustomerProducts';
import { CustomerQuotationNew } from '../pages/customer/CustomerQuotationNew';
import { CustomerUsers } from '../pages/customer/CustomerUsers';

export function CustomerRoutes() {
  return (
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
            <Route path="quotations/new" element={<CustomerQuotationNew />} />
            <Route path="users" element={<CustomerUsers />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/customer/dashboard" replace />} />
      </Routes>
    </CustomerAuthProvider>
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
