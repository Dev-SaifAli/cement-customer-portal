import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  Monitor,
  Moon,
  BriefcaseBusiness,
  ShoppingBag,
  PackageCheck,
  Sun,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo/Logo';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { useCustomerTheme, type CustomerThemePreference } from '../../context/CustomerThemeContext';
import { getSalesLandingPath, getSalesRoleLabel } from '../../utils/salesRouting';
import type { ReactNode } from 'react';

export function SalesLayout() {
  const { user, logout } = useSalesAuth();
  const { preference: themePreference, setPreference: setThemePreference } = useCustomerTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('sales_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const section = location.pathname.startsWith('/sales/quotations')
    ? user?.role === 'HADER_MANAGER'
      ? { title: 'Delivery Price Approvals', subtitle: 'Review assigned delivery-price exceptions' }
      : user?.role === 'PRICE_MANAGER'
        ? { title: 'Product Price Approvals', subtitle: 'Review assigned product-price exceptions' }
        : {
            title: 'Sales Quotations',
            subtitle: 'Review requirements and prepare customer quotations',
          }
    : location.pathname.startsWith('/sales/contracts')
      ? { title: 'Sales Contracts', subtitle: 'Manage accepted quotation contracts' }
      : location.pathname.startsWith('/sales/orders')
        ? { title: 'Customer Orders', subtitle: 'Review and process submitted customer orders' }
        : location.pathname.startsWith('/sales/shipments')
          ? { title: 'Customer Shipments', subtitle: 'Read-only shipment visibility' }
          : location.pathname.startsWith('/sales/applications')
            ? { title: 'Sales Applications', subtitle: 'Review submitted customer applications' }
            : { title: 'Sales Portal', subtitle: 'Internal customer review workspace' };

  const handleLogout = async () => {
    await logout();
    navigate('/sales/login', { replace: true });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('sales_sidebar_collapsed', String(next));
      } catch {
        // The shell still works when storage is unavailable.
      }
      return next;
    });
  };

  const initials = getInitials(user?.name);

  return (
    <div className="customer-portal customer-page-bg customer-text min-h-screen font-['Manrope',system-ui,sans-serif]">
      <aside
        className={`customer-surface customer-border fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[232px]'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`customer-border-soft relative flex h-[60px] items-center border-b ${
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <Link
            to={user ? getSalesLandingPath(user.role) : '/sales/login'}
            className={`flex min-w-0 items-center gap-2.5 ${sidebarCollapsed ? 'lg:hidden' : ''}`}
          >
            <Logo size="sm" />
            <span className="customer-border min-w-0 border-l pl-2.5">
              <span className="customer-primary block truncate text-sm font-bold leading-tight">
                AlSafwa Cement
              </span>
              <span className="customer-muted mt-0.5 block truncate text-[11px] font-medium">
                Sales Portal
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="customer-surface customer-border customer-secondary absolute -right-3 top-[18px] hidden h-6 w-6 items-center justify-center rounded-full border shadow-sm transition hover:border-[var(--customer-primary)] hover:text-[var(--customer-primary)] lg:inline-flex"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <button
            type="button"
            className="customer-secondary rounded-lg p-2 transition hover:bg-[var(--customer-surface-secondary)] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
        <nav className={`flex-1 space-y-2 overflow-y-auto ${sidebarCollapsed ? 'p-2.5' : 'p-3'}`}>
          {user?.role === 'SALES_REP' && (
            <>
              <SalesNavLink
                to="/sales/dashboard"
                icon={<BarChart3 size={18} />}
                collapsed={sidebarCollapsed}
                onClick={() => setSidebarOpen(false)}
              >
                Dashboard
              </SalesNavLink>
              <SalesNavLink
                to="/sales/applications"
                icon={<ClipboardList size={18} />}
                collapsed={sidebarCollapsed}
                onClick={() => setSidebarOpen(false)}
              >
                Applications
              </SalesNavLink>
            </>
          )}
          <SalesNavLink
            to="/sales/quotations"
            icon={<FileText size={18} />}
            collapsed={sidebarCollapsed}
            onClick={() => setSidebarOpen(false)}
          >
            Quotations
          </SalesNavLink>
          {user?.role === 'SALES_REP' && (
            <>
              <SalesNavLink
                to="/sales/contracts"
                icon={<BriefcaseBusiness size={18} />}
                collapsed={sidebarCollapsed}
                onClick={() => setSidebarOpen(false)}
              >
                Contracts
              </SalesNavLink>
              <SalesNavLink
                to="/sales/orders"
                icon={<ShoppingBag size={18} />}
                collapsed={sidebarCollapsed}
                onClick={() => setSidebarOpen(false)}
              >
                Orders
              </SalesNavLink>
              <SalesNavLink
                to="/sales/shipments"
                icon={<PackageCheck size={18} />}
                collapsed={sidebarCollapsed}
                onClick={() => setSidebarOpen(false)}
              >
                Shipments
              </SalesNavLink>
            </>
          )}
        </nav>

        <div className={`customer-border-soft border-t ${sidebarCollapsed ? 'p-2.5' : 'p-3'}`}>
          <div
            className={`customer-card group relative flex items-center rounded-lg border ${
              sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'
            }`}
          >
            <span className="customer-primary-soft customer-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {initials}
            </span>
            <span className={sidebarCollapsed ? 'lg:hidden' : 'min-w-0'}>
              <span className="customer-text block truncate text-xs font-semibold">
                {user?.name ?? 'Sales user'}
              </span>
              <span className="customer-muted mt-0.5 block truncate text-[10px]">
                {user ? getSalesRoleLabel(user.role) : 'Sales Portal'}
              </span>
            </span>
            {sidebarCollapsed && (
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 lg:block">
                {user?.name ?? 'Sales user'}
              </span>
            )}
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <div
        className={`min-w-0 transition-all duration-200 ${
          sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[232px]'
        }`}
      >
        <header className="customer-surface customer-border sticky top-0 z-20 flex h-[60px] items-center justify-between border-b px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="customer-secondary rounded-lg p-2 transition hover:bg-[var(--customer-surface-secondary)] lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="customer-text truncate text-sm font-semibold">{section.title}</p>
              <p className="customer-muted hidden truncate text-xs sm:block">{section.subtitle}</p>
            </div>
          </div>
          <div className="relative flex items-center gap-2">
            <NotificationBell audience="sales" />
            <button
              type="button"
              onClick={() => setProfileMenuOpen((current) => !current)}
              className="customer-surface customer-border customer-secondary inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)]"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label={`Account menu for ${user?.name ?? 'sales user'}`}
            >
              <span className="customer-primary-soft customer-primary flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold">
                {initials}
              </span>
              <span className="hidden max-w-36 truncate sm:inline">{user?.name}</span>
              <ChevronDown size={15} />
            </button>
            {profileMenuOpen && (
              <div
                role="menu"
                className="customer-card absolute right-0 top-12 z-30 w-72 rounded-xl border p-2"
              >
                <div className="customer-border-soft border-b px-3 py-3">
                  <p className="customer-text truncate text-sm font-bold">{user?.name}</p>
                  <p className="customer-muted mt-0.5 truncate text-xs">{user?.email}</p>
                  <p className="customer-primary mt-2 truncate text-xs font-semibold">
                    {user ? getSalesRoleLabel(user.role) : ''}
                  </p>
                </div>
                <div className="customer-border-soft border-b px-2 py-3">
                  <p className="customer-muted px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.08em]">
                    Appearance
                  </p>
                  <div className="grid grid-cols-3 gap-1" role="group" aria-label="Appearance">
                    <ThemeOption
                      icon={<Sun size={15} />}
                      label="Light"
                      value="light"
                      selected={themePreference === 'light'}
                      onSelect={setThemePreference}
                    />
                    <ThemeOption
                      icon={<Moon size={15} />}
                      label="Dark"
                      value="dark"
                      selected={themePreference === 'dark'}
                      onSelect={setThemePreference}
                    />
                    <ThemeOption
                      icon={<Monitor size={15} />}
                      label="System"
                      value="system"
                      selected={themePreference === 'system'}
                      onSelect={setThemePreference}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="customer-secondary mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)]"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="min-w-0 px-4 py-5 lg:px-6 lg:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SalesNavLink({
  to,
  icon,
  children,
  collapsed,
  onClick,
}: {
  to: string;
  icon: ReactNode;
  children: string;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={collapsed ? children : undefined}
      className={({ isActive }) =>
        `group relative flex items-center rounded-lg text-sm font-semibold transition ${
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
        } ${
          isActive
            ? 'customer-primary-soft customer-primary'
            : 'customer-secondary hover:bg-[var(--customer-surface-secondary)] hover:text-[var(--customer-text)]'
        }`
      }
      end={to === '/sales/dashboard'}
    >
      {icon}
      <span className={collapsed ? 'lg:hidden' : ''}>{children}</span>
      {collapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 lg:block">
          {children}
        </span>
      )}
    </NavLink>
  );
}

function ThemeOption({
  icon,
  label,
  value,
  selected,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  value: CustomerThemePreference;
  selected: boolean;
  onSelect: (value: CustomerThemePreference) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition ${
        selected
          ? 'bg-[var(--customer-primary-soft)] text-[var(--customer-primary)]'
          : 'customer-secondary hover:bg-[var(--customer-surface-secondary)]'
      }`}
      aria-pressed={selected}
    >
      {icon}
      {label}
    </button>
  );
}

function getInitials(name?: string) {
  if (!name) return 'SA';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
