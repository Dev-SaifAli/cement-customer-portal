import { ArrowLeft, MailCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button/Button';

export default function CheckEmail() {
  const navigate = useNavigate();
  return (
    <div className="center-shell">
      <div className="success-card">
        <div className="success-icon-wrap">
          <MailCheck size={30} color="var(--success)" />
        </div>
        <h1>Check Your Email</h1>
        <p>
          If an account exists for this email address, you will receive instructions to reset your
          password.
        </p>
        <Button
          variant="secondary"
          icon={<ArrowLeft size={16} />}
          iconPosition="left"
          onClick={() => navigate('/login')}
        >
          Back to Login
        </Button>
        <p className="small-note">
          Didn&apos;t get an email? Check your spam folder, or try again in a few minutes.
        </p>
      </div>
    </div>
  );
}
