import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button/Button';
import Alert from '../../components/Alert/Alert';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import PasswordRequirements, {
  defaultRules,
} from '../../components/PasswordRequirements/PasswordRequirements';
import { AuthApiError, resetPassword } from '../../services/authService';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const allRulesMet = defaultRules.every((rule) => rule.test(newPassword));
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This password reset link is invalid. Request a new one.');
      return;
    }
    if (confirmPassword !== newPassword) {
      setConfirmError('Passwords do not match.');
      return;
    }
    if (!allRulesMet) {
      setConfirmError('Meet all password requirements before continuing.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await resetPassword({ token, newPassword });
      navigate('/reset-password/success', {
        replace: true,
        state: { loginPath: result.loginPath },
      });
    } catch (resetError) {
      setError(
        resetError instanceof AuthApiError
          ? resetError.message
          : 'Unable to reset your password. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="center-shell">
      <div className="success-card" style={{ textAlign: 'left', maxWidth: 480 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="success-icon-wrap purple" style={{ margin: '0 auto 20px auto' }}>
            <KeyRound size={28} color="var(--purple)" />
          </div>
          <h1>Reset Your Password</h1>
          <p style={{ marginBottom: 28 }}>
            Choose a new password that meets the requirements below.
          </p>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <form onSubmit={handleSubmit} noValidate>
          <PasswordInput
            id="newPassword"
            label="New Password"
            required
            placeholder="Enter new password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
          <PasswordRequirements value={newPassword} />
          <PasswordInput
            id="confirmPassword"
            label="Confirm New Password"
            required
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (confirmError) setConfirmError('');
            }}
            error={confirmError}
            autoComplete="new-password"
          />
          <Button type="submit" className="mb-14" disabled={submitting}>
            {submitting ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
        <div style={{ textAlign: 'center' }}>
          <Link to="/login" className="btn-ghost" style={{ display: 'inline-flex' }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
