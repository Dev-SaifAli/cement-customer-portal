import { CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button/Button';

export default function PasswordResetSuccess() {
  const navigate = useNavigate();
  return (
    <div className="center-shell">
      <div className="success-card">
        <div className="success-icon-wrap">
          <CheckCircle2 size={30} color="var(--success)" />
        </div>
        <h1>Password Reset Successfully</h1>
        <p>
          Your password has been updated successfully. You can now sign in with your new password.
        </p>
        <Button onClick={() => navigate('/login')}>Back to Login</Button>
      </div>
    </div>
  );
}
