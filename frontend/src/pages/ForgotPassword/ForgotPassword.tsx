import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthLayout, { visualPresets } from '../../components/AuthLayout/AuthLayout';
import Button from '../../components/Button/Button';
import Captcha from '../../components/Captcha/Captcha';
import Input from '../../components/Input/Input';
import { AuthApiError, requestPasswordReset } from '../../services/authService';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type ForgotErrors = Partial<Record<'email' | 'captcha', string>>;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [captchaChallengeId, setCaptchaChallengeId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [errors, setErrors] = useState<ForgotErrors>({});
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
    const next: ForgotErrors = {};
    if (!email.trim()) next.email = 'Email address is required.';
    else if (!emailPattern.test(email.trim())) next.email = 'Please enter a valid email address.';
    if (!captchaChallengeId || !captchaAnswer.trim()) {
      next.captcha = 'Please complete the security verification.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await requestPasswordReset({
        email: email.trim(),
        captchaChallengeId,
        captchaAnswer,
      });
      navigate('/forgot-password/check-email');
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.code === 'CAPTCHA_EXPIRED') {
          setErrors((current) => ({
            ...current,
            captcha: 'Security verification expired. Please try again.',
          }));
        } else if (error.code === 'CAPTCHA_UNAVAILABLE') {
          setErrors((current) => ({
            ...current,
            captcha: 'Security verification is temporarily unavailable. Please try again later.',
          }));
        } else {
          setErrors((current) => ({
            ...current,
            captcha: 'Please complete the security verification.',
          }));
        }
      } else {
        setErrors((current) => ({
          ...current,
          captcha: 'Unable to connect. Please check your network and try again.',
        }));
      }
      resetCaptcha();
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <AuthLayout visual={visualPresets.forgotPassword} activeDot={1}>
      <div className="auth-head">
        <h1>Forgot Password?</h1>
        <p>Enter your registered email address to reset your password.</p>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <Input
          id="forgotEmail"
          label="Email Address"
          required
          type="text"
          placeholder="name@company.com"
          icon={<Mail size={17} />}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <Captcha
          id="forgotCaptchaAnswer"
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
        <Button
          type="submit"
          icon={<ArrowRight size={17} />}
          className="mb-14"
          disabled={submitting}
        >
          {submitting ? 'Sending...' : 'Continue'}
        </Button>
        <Button
          variant="ghost"
          icon={<ArrowLeft size={16} />}
          iconPosition="left"
          onClick={() => navigate('/login')}
        >
          Back to Login
        </Button>
      </form>
    </AuthLayout>
  );
}
