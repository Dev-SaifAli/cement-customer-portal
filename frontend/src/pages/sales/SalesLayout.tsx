import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo/Logo';
import { useSalesAuth } from '../../context/SalesAuthContext';
import type { ReactNode } from 'react';

export function SalesLayout() {
  const { user, logout } = useSalesAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/sales/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-60'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`flex h-16 items-center border-b border-slate-200 ${
            sidebarCollapsed ? 'justify-center px-3' : 'justify-between px-5'
          }`}
        >
          <Link
            to="/sales/dashboard"
            className={`flex min-w-0 items-center gap-3 ${sidebarCollapsed ? 'lg:hidden' : ''}`}
          >
            <Logo size="sm" />
          </Link>
          <button
            className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:inline-flex"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
        <nav className={`space-y-2 ${sidebarCollapsed ? 'p-3' : 'p-4'}`}>
          <SalesNavLink
            to="/sales/dashboard"
            icon={<BarChart3 size={18} />}
            collapsed={sidebarCollapsed}
          >
            Dashboard
          </SalesNavLink>
          <SalesNavLink
            to="/sales/applications"
            icon={<ClipboardList size={18} />}
            collapsed={sidebarCollapsed}
          >
            Applications
          </SalesNavLink>
          <SalesNavLink
            to="/sales/quotations"
            icon={<FileText size={18} />}
            collapsed={sidebarCollapsed}
          >
            Quotations
          </SalesNavLink>
        </nav>
      </aside>

      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <div
        className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-60'}`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-900">Internal Sales Review</p>
              <p className="text-xs text-slate-500">Review submitted customer applications</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">
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
}: {
  to: string;
  icon: ReactNode;
  children: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? children : undefined}
      className={({ isActive }) =>
        `flex items-center rounded-xl text-sm font-semibold transition ${
          collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'
        } ${
          isActive
            ? 'bg-[#f6f2fa] text-[#4b2c71]'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
        }`
      }
      end={to === '/sales/dashboard'}
    >
      {icon}
      <span className={collapsed ? 'lg:hidden' : ''}>{children}</span>
    </NavLink>
  );
}
