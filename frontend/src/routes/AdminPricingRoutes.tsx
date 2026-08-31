import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useSalesAuth } from '../context/SalesAuthContext';
import { SessionRestoreError } from '../components/auth/SessionRestoreError';
import { AppLoadingScreen } from '../components/ui/AppLoadingScreen';
import { CustomerThemeProvider } from '../context/CustomerThemeContext';
import { AdminProducts } from '../pages/admin/AdminProducts';
import { AdminProductDocument } from '../pages/admin/AdminProductDocument';
import { AdminProductPrices } from '../pages/admin/AdminProductPrices';
import { AdminTaxConfiguration } from '../pages/admin/AdminTaxConfiguration';
import { AdminHaderCities } from '../pages/admin/AdminHaderCities';
import { AdminLogisticsPage } from '../pages/admin/AdminLogisticsPage';
import { AdminPickupLocations } from '../pages/admin/AdminPickupLocations';
import { AdminPickupLocationDocument } from '../pages/admin/AdminPickupLocationDocument';
import { PricingAdminLayout } from '../pages/admin/PricingAdminLayout';
import { HaderLayout } from '../pages/hader/HaderLayout';
import { getSalesLandingPath } from '../utils/salesRouting';

export function AdminPricingRoutes() {
  return (
    <CustomerThemeProvider>
      <div className="customer-portal !min-h-0">
        <Routes>
          <Route element={<RequireInternalAdmin />}>
            <Route element={<RoleAwareInternalLayout />}>
              <Route element={<RequireBoundaryAccess />}>
                <Route path="hader-cities" element={<AdminHaderCities />} />
              </Route>
              <Route element={<RequirePricingAdmin />}>
                <Route path="products" element={<AdminProducts />} />
                <Route path="products/create" element={<AdminProductDocument />} />
                <Route path="products/:id" element={<AdminProductDocument />} />
                <Route path="delivery-prices" element={<AdminProductPrices deliveryOnly />} />
                <Route path="tax-configuration" element={<AdminTaxConfiguration />} />
                <Route path="pickup-locations" element={<AdminPickupLocations />} />
                <Route path="pickup-locations/create" element={<AdminPickupLocationDocument />} />
                <Route path="pickup-locations/:id" element={<AdminPickupLocationDocument />} />
                <Route path="product-prices" element={<Navigate to="/admin/products" replace />} />
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
            <Route path="*" element={<AdminRoleLanding />} />
          </Route>
        </Routes>
      </div>
    </CustomerThemeProvider>
  );
}

function AdminRoleLanding() {
  const { user } = useSalesAuth();
  return <Navigate to={user ? getSalesLandingPath(user.role) : '/sales/login'} replace />;
}

function RoleAwareInternalLayout() {
  const { user } = useSalesAuth();
  return user?.role === 'PRICING_ADMIN' ? <PricingAdminLayout /> : <HaderLayout />;
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
    <Navigate to="/hader/loading-points" replace />
  );
}

function RequireInternalAdmin() {
  const { user, loading, restoreError, refresh } = useSalesAuth();
  const location = useLocation();

  if (loading) return <AppLoadingScreen label="Restoring your secure session" />;

  if (restoreError && !user) {
    return <SessionRestoreError onRetry={() => void refresh()} />;
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
