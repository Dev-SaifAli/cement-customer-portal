import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Mail, RefreshCw } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import AuthLayout, { visualPresets } from '../../components/AuthLayout/AuthLayout';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { CustomerAuthApiError } from '../../services/customerAuthService';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type LoginErrors = Partial<Record<'email' | 'password' | 'captcha', string>>;

interface CaptchaChallenge {
  left: number;
  right: number;
}

function createCaptchaChallenge(): CaptchaChallenge {
  return {
    left: Math.floor(Math.random() * 8) + 2,
    right: Math.floor(Math.random() * 8) + 2,
  };
}

function createDifferentCaptchaChallenge(current: CaptchaChallenge): CaptchaChallenge {
  let next = createCaptchaChallenge();

  while (next.left === current.left && next.right === current.right) {
    next = createCaptchaChallenge();
  }

  return next;
}

export default function Login() {
  const { user, loading, login } = useCustomerAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaChallenge>(() =>
    createCaptchaChallenge(),
  );
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: Location } | null)?.from;
  const requestedDestination =
    from?.pathname && from.pathname !== '/login'
      ? `${from.pathname}${from.search}${from.hash}`
      : '/customer/dashboard';

  if (!loading && user) {
    return <Navigate to={requestedDestination} replace />;
  }

  const validate = () => {
    const next: LoginErrors = {};
    if (!email.trim()) next.email = 'Email address is required.';
    else if (!emailPattern.test(email.trim())) next.email = 'Please enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    if (!captchaAnswer.trim()) {
      next.captcha = 'Please complete the security verification.';
    } else if (Number(captchaAnswer) !== captchaChallenge.left + captchaChallenge.right) {
      next.captcha = 'Security verification answer is incorrect. Please try again.';
    }

    if (next.captcha) {
      refreshCaptcha();
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const refreshCaptcha = () => {
    setCaptchaChallenge((current) => createDifferentCaptchaChallenge(current));
    setCaptchaAnswer('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      if (error instanceof CustomerAuthApiError && error.status === 401) {
        setNotice('Invalid email or password.');
      } else if (error instanceof CustomerAuthApiError) {
        setNotice(error.message);
      } else {
        setNotice('Unable to sign in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout visual={visualPresets.login} activeDot={0}>
      <div className="auth-head">
        <h1>Welcome Back</h1>
        <p>Sign in to access your AlSafwa Cement Customer Portal.</p>
      </div>
      {notice && <Alert variant="error">{notice}</Alert>}
      <form onSubmit={handleSubmit} noValidate>
        <Input
          id="loginEmail"
          label="Email Address"
          required
          type="text"
          placeholder="name@company.com"
          icon={<Mail size={17} />}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <PasswordInput
          id="loginPassword"
          label="Password"
          required
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />
        <div className="field captcha-block">
          <label htmlFor="loginCaptchaAnswer">
            Security Verification <span className="req">*</span>
          </label>
          <div className={`server-captcha${errors.captcha ? ' err' : ''} active`}>
            <div className="server-captcha-challenge">
              <span>
                {captchaChallenge.left} + {captchaChallenge.right} = ?
              </span>
              <button
                type="button"
                className="captcha-refresh"
                onClick={() => {
                  refreshCaptcha();
                  setErrors((current) => {
                    const next = { ...current };
                    delete next.captcha;
                    return next;
                  });
                }}
                aria-label="Refresh security challenge"
                title="Refresh security challenge"
              >
                <RefreshCw size={17} />
              </button>
            </div>
            <div className="input-wrap">
              <input
                id="loginCaptchaAnswer"
                type="text"
                className={errors.captcha ? 'err' : ''}
                placeholder="Enter answer"
                autoComplete="off"
                inputMode="numeric"
                value={captchaAnswer}
                onChange={(event) => setCaptchaAnswer(event.target.value)}
                aria-invalid={Boolean(errors.captcha)}
                aria-describedby={errors.captcha ? 'loginCaptchaAnswer-message' : undefined}
              />
            </div>
          </div>
          {errors.captcha && (
            <div id="loginCaptchaAnswer-message" className="form-msg error">
              <AlertCircle size={14} />
              <span>{errors.captcha}</span>
            </div>
          )}
        </div>
        <div className="row-between">
          <Link to="/forgot-password" className="link-purple">
            Forgot Password?
          </Link>
        </div>
        <Button
          type="submit"
          icon={<ArrowRight size={17} />}
          loading={submitting}
          loadingText="Signing In..."
        >
          Sign In
        </Button>
      </form>
      <div className="foot-links">
        <p>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="link-purple">
            Register Your Organization
          </Link>
        </p>
        <p>
          Already submitted an application?{' '}
          <Link to="/register/status" className="link-purple">
            Check Application Status
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
