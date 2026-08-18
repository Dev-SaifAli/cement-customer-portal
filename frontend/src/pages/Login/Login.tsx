import { useState, type FormEvent } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import AuthLayout, { visualPresets } from '../../components/AuthLayout/AuthLayout';
import Button from '../../components/Button/Button';
import Captcha from '../../components/Captcha/Captcha';
import Checkbox from '../../components/Checkbox/Checkbox';
import Input from '../../components/Input/Input';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import { AuthApiError, login } from '../../services/authService';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type LoginErrors = Partial<Record<'email' | 'password' | 'captcha', string>>;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaChallengeId, setCaptchaChallengeId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetCaptcha = () => {
    setCaptchaChallengeId('');
    setCaptchaAnswer('');
    setCaptchaResetKey((current) => current + 1);
  };

  const clearCaptchaError = () => {
    setErrors((current) => {
      const next = { ...current };
      delete next.captcha;
      return next;
    });
  };

  const validate = () => {
    const next: LoginErrors = {};
    if (!email.trim()) next.email = 'Email address is required.';
    else if (!emailPattern.test(email.trim())) next.email = 'Please enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    if (!captchaChallengeId || !captchaAnswer.trim()) {
      next.captcha = 'Please complete the security verification.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login({
        email: email.trim(),
        password,
        rememberMe,
        captchaChallengeId,
        captchaAnswer,
      });
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.code === 'CAPTCHA_EXPIRED') {
          setErrors((current) => ({
            ...current,
            captcha: 'Security verification expired. Please try again.',
          }));
          resetCaptcha();
        } else if (error.code === 'CAPTCHA_FAILED' || error.code === 'CAPTCHA_REQUIRED') {
          setErrors((current) => ({
            ...current,
            captcha: 'Please complete the security verification.',
          }));
          resetCaptcha();
        } else if (error.code === 'CAPTCHA_UNAVAILABLE') {
          setErrors((current) => ({
            ...current,
            captcha: 'Security verification is temporarily unavailable. Please try again later.',
          }));
          resetCaptcha();
        } else if (error.code === 'AUTH_NOT_CONFIGURED') {
          setNotice('Sign-in will be enabled when the authentication service is connected.');
          resetCaptcha();
        } else {
          setNotice(error.message);
          resetCaptcha();
        }
      } else {
        setNotice('Unable to connect. Please check your network and try again.');
        resetCaptcha();
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
      {notice && <Alert variant="warn">{notice}</Alert>}
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
        />
        <PasswordInput
          id="loginPassword"
          label="Password"
          required
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <Captcha
          id="loginCaptchaAnswer"
          challengeId={captchaChallengeId}
          answer={captchaAnswer}
          onChallengeChange={setCaptchaChallengeId}
          onAnswerChange={(answer) => {
            setCaptchaAnswer(answer);
            if (answer.trim()) clearCaptchaError();
          }}
          onExpired={() =>
            setErrors((current) => ({
              ...current,
              captcha: 'Security verification expired. Please try again.',
            }))
          }
          error={errors.captcha}
          resetKey={captchaResetKey}
        />
        <div className="row-between">
          <Checkbox
            id="rememberMe"
            label="Remember Me"
            checked={rememberMe}
            onChange={setRememberMe}
          />
          <Link to="/forgot-password" className="link-purple">
            Forgot Password?
          </Link>
        </div>
        <Button type="submit" icon={<ArrowRight size={17} />} disabled={submitting}>
          {submitting ? 'Signing In...' : 'Sign In'}
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
