import { Navigate, Route, Routes } from 'react-router-dom';
import CheckEmail from '../pages/CheckEmail/CheckEmail';
import ForgotPassword from '../pages/ForgotPassword/ForgotPassword';
import Login from '../pages/Login/Login';
import PasswordResetSuccess from '../pages/PasswordResetSuccess/PasswordResetSuccess';
import ResetPassword from '../pages/ResetPassword/ResetPassword';
import { CustomerAuthProvider } from '../context/CustomerAuthContext';
import { CustomerRoutes } from './CustomerRoutes';
import { RegistrationRoutes } from './RegistrationRoutes';
import { SalesRoutes } from './SalesRoutes';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={
          <CustomerAuthProvider>
            <Login />
          </CustomerAuthProvider>
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/forgot-password/check-email" element={<CheckEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/success" element={<PasswordResetSuccess />} />
      <Route path="/register/*" element={<RegistrationRoutes />} />
      <Route path="/customer/*" element={<CustomerRoutes />} />
      <Route path="/sales/*" element={<SalesRoutes />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
