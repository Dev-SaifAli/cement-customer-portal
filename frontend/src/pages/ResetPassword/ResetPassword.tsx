import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button/Button';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import PasswordRequirements, {
  defaultRules,
} from '../../components/PasswordRequirements/PasswordRequirements';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const allRulesMet = defaultRules.every((rule) => rule.test(newPassword));
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmPassword !== newPassword) {
      setConfirmError('Passwords do not match.');
      return;
    }
    if (!allRulesMet) {
      setConfirmError('');
      return;
    }
    void token;
    navigate('/reset-password/success');
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
            Your new password must be different from previously used passwords.
          </p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <PasswordInput
            id="newPassword"
            label="New Password"
            required
            placeholder="Enter new password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
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
          />
          <Button type="submit" className="mb-14">
            Reset Password
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
