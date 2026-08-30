import { AlertCircle, ArrowRight, Lock, Mail, Settings, ShieldCheck, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo/Logo';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { SalesApiError } from '../../services/salesService';
import { getSalesLandingPath } from '../../utils/salesRouting';

export function PortalAdminLogin() {
  const { user, loading, login, logout } = useSalesAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  if (!loading && user) {
    return (
      <Navigate
        to={
          user.role === 'PORTAL_ADMINISTRATOR'
            ? '/portal-admin/users'
            : getSalesLandingPath(user.role)
        }
        replace
      />
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: { email?: string; password?: string } = {};
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) nextErrors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) nextErrors.password = 'Password is required.';
    setFieldErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const authenticatedUser = await login({ email: normalizedEmail, password });
      if (authenticatedUser.role !== 'PORTAL_ADMINISTRATOR') {
        await logout();
        setError('This account is not authorized for Portal Administration.');
        return;
      }
      navigate('/portal-admin/users', { replace: true });
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
    <div className="customer-portal customer-page-bg customer-text min-h-screen font-['Manrope',system-ui,sans-serif] lg:grid lg:grid-cols-[0.94fr_1.06fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#241a38] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-12">
        <div className="pointer-events-none absolute -left-28 bottom-[-11rem] h-[28rem] w-[28rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -left-8 bottom-[-15rem] h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="customer-always-light inline-flex rounded-xl px-3 py-2 shadow-sm"><Logo size="sm" /></span>
          <span className="border-l border-white/20 pl-3"><span className="block text-sm font-bold">AlSafwa Cement</span><span className="mt-0.5 block text-xs text-white/60">Portal Administration</span></span>
        </div>
        <div className="relative max-w-xl pb-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white/80"><Settings size={15}/> Administration Workspace</div>
          <h2 className="max-w-lg text-4xl font-extrabold leading-[1.15] tracking-tight xl:text-5xl">Secure control for portal access and communications.</h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/65">Manage internal users and global portal notifications from one protected administration workspace.</p>
          <div className="mt-9 flex items-center gap-3 text-sm font-medium text-white/75"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><ShieldCheck size={18}/></span>Authorized Portal Administrators only</div>
        </div>
      </section>

      <section className="customer-page-bg flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-10">
        <div className="customer-card w-full max-w-[440px] rounded-2xl border p-6 sm:p-8">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <div className="mb-6">
            <span className="customer-primary-soft customer-primary mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"><Users size={19}/></span>
            <p className="customer-primary mb-2 text-xs font-bold uppercase tracking-[0.12em]">Portal Administration</p>
            <h1 className="customer-text text-3xl font-bold tracking-tight">Administrator sign in</h1>
            <p className="customer-muted mt-2 text-sm leading-6">Use your authorized Portal Administrator account.</p>
          </div>

          {error && <div className="mb-5 flex gap-3 rounded-xl border border-red-300 bg-red-50 p-3.5 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={18}/><span>{error}</span></div>}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div><label className="customer-text mb-2 block text-sm font-semibold">Email address</label><div className="relative"><Mail size={18} className="customer-muted absolute left-3.5 top-1/2 -translate-y-1/2"/><input value={email} onChange={(event)=>setEmail(event.target.value)} type="email" autoComplete="email" className="customer-input customer-border customer-text h-12 w-full rounded-xl border pl-11 pr-3 text-sm outline-none transition focus:border-[var(--customer-primary)] focus:ring-4 focus:ring-[#54247a]/10" placeholder="admin@example.com" /></div>{fieldErrors.email && <p className="mt-2 text-xs text-red-600">{fieldErrors.email}</p>}</div>
            <div><label className="customer-text mb-2 block text-sm font-semibold">Password</label><div className="relative"><Lock size={18} className="customer-muted absolute left-3.5 top-1/2 -translate-y-1/2"/><input value={password} onChange={(event)=>setPassword(event.target.value)} type="password" autoComplete="current-password" className="customer-input customer-border customer-text h-12 w-full rounded-xl border pl-11 pr-3 text-sm outline-none transition focus:border-[var(--customer-primary)] focus:ring-4 focus:ring-[#54247a]/10" placeholder="Enter password" /></div>{fieldErrors.password && <p className="mt-2 text-xs text-red-600">{fieldErrors.password}</p>}</div>
            <button type="submit" disabled={submitting || loading} className="customer-primary-bg flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Signing in...' : 'Sign in'}{!submitting && <ArrowRight size={17}/>}</button>
          </form>
          <p className="customer-muted mt-6 flex items-center justify-center gap-2 text-center text-xs"><ShieldCheck size={14}/>Secure access for authorized administrators</p>
        </div>
      </section>
    </div>
  );
}
