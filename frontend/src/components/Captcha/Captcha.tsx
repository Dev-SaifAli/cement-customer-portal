import { useEffect, useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { fetchCaptchaChallenge, type CaptchaChallenge } from '../../services/captchaService';

interface CaptchaProps {
  challengeId: string;
  answer: string;
  onChallengeChange: (challengeId: string) => void;
  onAnswerChange: (answer: string) => void;
  onExpired?: () => void;
  error?: string | undefined;
  id?: string;
  resetKey?: number;
}

export default function Captcha({
  challengeId,
  answer,
  onChallengeChange,
  onAnswerChange,
  onExpired,
  error = '',
  id = 'captchaAnswer',
  resetKey = 0,
}: CaptchaProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(false);

  const loadChallenge = async () => {
    setLoading(true);
    setLoadError('');
    onChallengeChange('');
    onAnswerChange('');

    try {
      const nextChallenge = await fetchCaptchaChallenge();
      if (!mountedRef.current) return;
      setChallenge(nextChallenge);
      onChallengeChange(nextChallenge.challengeId);
    } catch {
      if (!mountedRef.current) return;
      setChallenge(null);
      setLoadError('Security verification is temporarily unavailable. Please try again.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void loadChallenge();

    return () => {
      mountedRef.current = false;
    };
  }, [resetKey]);

  useEffect(() => {
    if (!challenge) return;

    const expiresInMs = new Date(challenge.expiresAt).getTime() - Date.now();
    if (expiresInMs <= 0) {
      onChallengeChange('');
      onExpired?.();
      return;
    }

    const timeout = window.setTimeout(() => {
      onChallengeChange('');
      onExpired?.();
    }, expiresInMs);

    return () => window.clearTimeout(timeout);
  }, [challenge, onChallengeChange, onExpired]);

  const message = error || loadError;

  return (
    <div className="field captcha-block">
      <label htmlFor={id}>
        Security Verification <span className="req">*</span>
      </label>
      <div className={`server-captcha${message ? ' err' : ''}${challengeId ? ' active' : ''}`}>
        <div className="server-captcha-challenge">
          <span>
            {loading
              ? 'Loading security challenge...'
              : (challenge?.prompt ?? 'Challenge unavailable')}
          </span>
          <button
            type="button"
            className="captcha-refresh"
            onClick={() => void loadChallenge()}
            disabled={loading}
            aria-label="Refresh security challenge"
            title="Refresh security challenge"
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="input-wrap">
          <input
            id={id}
            type="text"
            className={message ? 'err' : ''}
            placeholder="Enter answer"
            autoComplete="off"
            inputMode="numeric"
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            aria-invalid={Boolean(message)}
            aria-describedby={message ? `${id}-message` : undefined}
          />
        </div>
      </div>
      {message && (
        <div id={`${id}-message`} className="form-msg error">
          <AlertCircle size={14} />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
