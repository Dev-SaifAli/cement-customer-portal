import { CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/Button/Button';

export default function PasswordResetSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginPath =
    (location.state as { loginPath?: string } | null)?.loginPath ?? '/login';
  return (
    <div className="center-shell">
      <div className="success-card">
        <div className="success-icon-wrap">
          <CheckCircle2 size={30} color="var(--success)" />
        </div>
        <h1>Password Reset Successfully</h1>
        <p>Password updated successfully. You can now sign in.</p>
        <Button onClick={() => navigate(loginPath, { replace: true })}>Back to Login</Button>
      </div>
    </div>
  );
}
