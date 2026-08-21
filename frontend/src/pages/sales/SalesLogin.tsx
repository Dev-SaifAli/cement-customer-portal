import { AlertCircle, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { SalesApiError } from '../../services/salesService';

export function SalesLogin() {
  const { user, loading, login } = useSalesAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (user) {
      navigate('/sales/dashboard', { replace: true });
    }
  }, [navigate, user]);

  if (!loading && user) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return <Navigate to={from && from !== '/sales/login' ? from : '/sales/dashboard'} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof fieldErrors = {};
    if (!email.trim()) nextErrors.email = 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email.';
    if (!password) nextErrors.password = 'Password is required.';
    setFieldErrors(nextErrors);
    setError('');

    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/sales/dashboard', { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof SalesApiError
          ? loginError.message
          : 'Unable to sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[1fr_0.9fr]">
      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4b2c71] text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-lg font-extrabold text-[#4b2c71]">AlSafwa Cement</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sales Portal
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Sales sign in</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review submitted customer registration applications and manage Sales decisions.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Email</label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none transition focus:border-[#4b2c71] focus:ring-4 focus:ring-[#4b2c71]/10"
                  placeholder="sales@example.com"
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-2 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">Password</label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none transition focus:border-[#4b2c71] focus:ring-4 focus:ring-[#4b2c71]/10"
                  placeholder="Enter password"
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-2 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <button
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#4b2c71] px-5 text-sm font-extrabold text-white shadow-lg shadow-[#4b2c71]/20 transition hover:bg-[#382055] disabled:cursor-not-allowed disabled:bg-[#c9c0d6]"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>

      <section className="hidden min-h-screen bg-[#241a38] p-10 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="max-w-lg">
          <div className="mb-5 inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/80">
            Internal Sales Review
          </div>
          <h2 className="text-4xl font-black leading-tight">
            Faster customer onboarding with controlled application review.
          </h2>
          <p className="mt-5 text-sm leading-7 text-white/65">
            Track submitted organizations, inspect uploaded metadata, and record Sales decisions
            with a complete status history.
          </p>
        </div>
      </section>
    </div>
  );
}
