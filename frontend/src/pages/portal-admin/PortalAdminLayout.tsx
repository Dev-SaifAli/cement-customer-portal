import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Sun,
  Users,
  Bell,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo/Logo';
import {
  useCustomerTheme,
  type CustomerThemePreference,
} from '../../context/CustomerThemeContext';
import { useSalesAuth } from '../../context/SalesAuthContext';

const navigation = [
  { to: '/portal-admin/users', label: 'User Management', icon: <Users size={18} /> },
  { to: '/portal-admin/notifications', label: 'Global Notifications', icon: <Bell size={18} /> },
];

export function PortalAdminLayout() {
  const { user, logout } = useSalesAuth();
  const { preference, setPreference } = useCustomerTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="customer-bg customer-text min-h-screen">
      <aside
        className={`customer-surface customer-border-soft fixed inset-y-0 left-0 z-40 border-r transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-60'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`customer-border-soft flex h-16 items-center border-b ${sidebarCollapsed ? 'justify-center px-3' : 'justify-between px-4'}`}>
          <Link to="/portal-admin/users" className={sidebarCollapsed ? 'lg:hidden' : ''}>
            <Logo size="sm" />
          </Link>
          <button type="button" className="customer-secondary hidden rounded-lg p-2 transition hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)] lg:inline-flex" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button type="button" className="customer-secondary rounded-lg p-2 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={18} /></button>
        </div>

        <div className={`customer-muted px-4 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider ${sidebarCollapsed ? 'lg:hidden' : ''}`}>Administration</div>
        <nav className={`space-y-1 ${sidebarCollapsed ? 'p-3' : 'px-4 pb-4'}`}>
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={sidebarCollapsed ? item.label : undefined}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center rounded-xl py-3 text-sm font-semibold transition ${sidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} ${isActive ? 'bg-[var(--customer-primary-soft)] text-[var(--customer-primary)]' : 'customer-secondary hover:bg-[var(--customer-surface-secondary)] hover:text-[var(--customer-text-primary)]'}`}
            >
              {item.icon}<span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="customer-border-soft absolute inset-x-0 bottom-0 border-t p-3">
          {!sidebarCollapsed && <div className="mb-2 min-w-0 px-2 py-2"><p className="customer-text truncate text-sm font-semibold">{user?.name}</p><p className="customer-muted truncate text-xs">Portal Administrator</p></div>}
          <button type="button" onClick={() => void handleLogout()} title={sidebarCollapsed ? 'Log out' : undefined} className={`flex w-full items-center rounded-xl py-3 text-sm font-semibold text-[var(--customer-text-secondary)] transition hover:bg-red-50 hover:text-[#b42318] ${sidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'}`}>
            <LogOut size={18} /><span className={sidebarCollapsed ? 'lg:hidden' : ''}>Log out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <button type="button" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar overlay" />}

      <div className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-60'}`}>
        <header className="customer-surface customer-border-soft sticky top-0 z-20 flex h-16 items-center justify-between border-b px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button type="button" className="customer-secondary rounded-lg p-2 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={20} /></button>
            <div><p className="customer-text text-sm font-semibold">Portal Administration</p><p className="customer-muted text-xs">Users, access and global communications</p></div>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setAccountOpen((value) => !value)} className="customer-border customer-surface flex items-center gap-3 rounded-xl border px-3 py-2 text-left shadow-sm transition hover:bg-[var(--customer-surface-secondary)]">
              <span className="customer-primary-bg flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white">{initials(user?.name)}</span>
              <span className="hidden sm:block"><span className="customer-text block text-sm font-semibold">{user?.name}</span><span className="customer-muted block text-xs">{user?.email}</span></span>
              <ChevronDown size={16} className="customer-muted" />
            </button>
            {accountOpen && <div className="customer-card absolute right-0 top-14 z-40 w-64 rounded-xl border p-2 shadow-xl"><div className="px-3 py-2"><p className="customer-muted text-xs font-semibold uppercase">Appearance</p><div className="mt-2 grid grid-cols-3 gap-1"><ThemeChoice value="light" active={preference === 'light'} onClick={() => setPreference('light')} icon={<Sun size={14} />} /><ThemeChoice value="dark" active={preference === 'dark'} onClick={() => setPreference('dark')} icon={<Moon size={14} />} /><ThemeChoice value="system" active={preference === 'system'} onClick={() => setPreference('system')} icon={<Monitor size={14} />} /></div></div><button type="button" onClick={() => void handleLogout()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#b42318] transition hover:bg-red-50"><LogOut size={16} /> Log out</button></div>}
          </div>
        </header>
        <main className="px-4 py-5 lg:px-6"><Outlet /></main>
      </div>
    </div>
  );
}

function ThemeChoice({ value, icon, active, onClick }: { value: CustomerThemePreference; icon: ReactNode; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${active ? 'bg-[var(--customer-primary-soft)] text-[var(--customer-primary)]' : 'customer-secondary hover:bg-[var(--customer-surface-secondary)]'}`}>{icon}{value}</button>;
}

function initials(name?: string) {
  return (name ?? 'PA').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
