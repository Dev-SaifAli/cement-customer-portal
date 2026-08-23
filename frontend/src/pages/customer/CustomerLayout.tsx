import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo/Logo';
import { useCustomerAuth } from '../../context/CustomerAuthContext';

export function CustomerLayout() {
  const { account, logout, user } = useCustomerAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const isCustomerAdmin = user?.role === 'CUSTOMER_ADMIN';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Manrope',system-ui,sans-serif] text-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`flex h-16 items-center border-b border-slate-200 ${
            sidebarCollapsed ? 'justify-center px-3' : 'justify-between px-5'
          }`}
        >
          <Link
            to="/customer/dashboard"
            className={`flex min-w-0 items-center gap-3 ${sidebarCollapsed ? 'lg:hidden' : ''}`}
          >
            <Logo size="sm" />
          </Link>
          <button
            type="button"
            className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:inline-flex"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className={`space-y-2 ${sidebarCollapsed ? 'p-3' : 'p-4'}`}>
          <CustomerNavLink
            to="/customer/dashboard"
            icon={<LayoutDashboard size={18} />}
            collapsed={sidebarCollapsed}
            onClick={() => setSidebarOpen(false)}
          >
            Dashboard
          </CustomerNavLink>
          <CustomerNavLink
            to="/customer/profile"
            icon={<UserCircle size={18} />}
            collapsed={sidebarCollapsed}
            onClick={() => setSidebarOpen(false)}
          >
            Profile
          </CustomerNavLink>
          <CustomerNavLink
            to="/customer/locations"
            icon={<MapPin size={18} />}
            collapsed={sidebarCollapsed}
            onClick={() => setSidebarOpen(false)}
          >
            Delivery Locations
          </CustomerNavLink>
          {isCustomerAdmin && (
            <CustomerNavLink
              to="/customer/users"
              icon={<Users size={18} />}
              collapsed={sidebarCollapsed}
              onClick={() => setSidebarOpen(false)}
            >
              Users
            </CustomerNavLink>
          )}
        </nav>
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
        className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Dashboard</p>
              <p className="truncate text-xs text-slate-500">
                {account?.companyName ?? 'AlSafwa Cement customer account'}
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#4b2c71] hover:bg-[#f6f2fa] hover:text-[#4b2c71]"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
            >
              <UserCircle size={18} />
              <span className="hidden sm:inline">Account</span>
              <ChevronDown size={15} />
            </button>
            {profileMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
              >
                <div className="border-b border-slate-100 px-3 py-3">
                  <p className="truncate text-sm font-bold text-slate-950">{user?.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
                  <p className="mt-2 truncate text-xs font-semibold text-[#4b2c71]">
                    {account?.companyName}
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-[#f6f2fa] hover:text-[#4b2c71]"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function CustomerNavLink({
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
      className={({ isActive }) =>
        `group relative flex items-center rounded-xl border text-sm font-semibold transition ${
          collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'
        } ${
          isActive
            ? 'border-[#decbe5] bg-[#f6f2fa] text-[#4b2c71] shadow-sm'
            : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950'
        }`
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className={collapsed ? 'lg:hidden' : ''}>{children}</span>
      {collapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 lg:block">
          {children}
        </span>
      )}
    </NavLink>
  );
}
