import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import CheckEmail from '../pages/CheckEmail/CheckEmail';
import ForgotPassword from '../pages/ForgotPassword/ForgotPassword';
import Login from '../pages/Login/Login';
import PasswordResetSuccess from '../pages/PasswordResetSuccess/PasswordResetSuccess';
import ResetPassword from '../pages/ResetPassword/ResetPassword';
import { CustomerAuthProvider } from '../context/CustomerAuthContext';
import { SalesAuthProvider } from '../context/SalesAuthContext';
import { CustomerRoutes } from './CustomerRoutes';
import { AdminPricingRoutes } from './AdminPricingRoutes';
import { RegistrationRoutes } from './RegistrationRoutes';
import { SalesRoutes } from './SalesRoutes';
import { HaderRoutes } from './HaderRoutes';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route element={<CustomerSessionRoutes />}>
        <Route path="/login" element={<Login />} />
        <Route path="/customer/*" element={<CustomerRoutes />} />
      </Route>
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/forgot-password/check-email" element={<CheckEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/success" element={<PasswordResetSuccess />} />
      <Route path="/register/*" element={<RegistrationRoutes />} />
      <Route element={<InternalSessionRoutes />}>
        <Route path="/sales/*" element={<SalesRoutes />} />
        <Route path="/hader/*" element={<HaderRoutes />} />
        <Route path="/admin/*" element={<AdminPricingRoutes />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function CustomerSessionRoutes() {
  return (
    <CustomerAuthProvider>
      <Outlet />
    </CustomerAuthProvider>
  );
}

function InternalSessionRoutes() {
  return (
    <SalesAuthProvider>
      <Outlet />
    </SalesAuthProvider>
  );
}
