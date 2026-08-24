import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  PackageSearch,
  FileText,
  BriefcaseBusiness,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo/Logo';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import type { CustomerRole } from '../../services/customerAuthService';

const customerNavigation: Array<{
  to: string;
  label: string;
  icon: ReactNode;
  activePrefix?: string;
  roles: CustomerRole[];
}> = [
  {
    to: '/customer/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
  {
    to: '/customer/profile',
    label: 'Profile',
    icon: <UserCircle size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
  {
    to: '/customer/locations',
    label: 'Delivery Locations',
    icon: <MapPin size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER'],
  },
  {
    to: '/customer/users',
    label: 'Users',
    icon: <Users size={18} />,
    roles: ['CUSTOMER_ADMIN'],
  },
  {
    to: '/customer/products',
    label: 'Products',
    icon: <PackageSearch size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
  {
    to: '/customer/quotations',
    activePrefix: '/customer/quotations',
    label: 'Quotations',
    icon: <FileText size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER'],
  },
  {
    to: '/customer/contracts',
    activePrefix: '/customer/contracts',
    label: 'Contracts',
    icon: <BriefcaseBusiness size={18} />,
    roles: ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'],
  },
];

export function CustomerLayout() {
  const { account, logout, user } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const visibleNavigation = customerNavigation.filter(
    (item) => user?.role && item.roles.includes(user.role),
  );
  const pageContext = getPageContext(location.pathname);
  const initials = getInitials(user?.name);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Manrope',system-ui,sans-serif] text-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-[#e3e1e8] bg-white transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[232px]'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`relative flex h-[60px] items-center border-b border-[#eceaf0] ${
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <Link
            to="/customer/dashboard"
            className={`flex min-w-0 items-center gap-2.5 ${sidebarCollapsed ? 'lg:hidden' : ''}`}
          >
            <Logo size="sm" />
            <span className="min-w-0 border-l border-[#e3e1e8] pl-2.5">
              <span className="block truncate text-sm font-bold leading-tight text-[#54247a]">
                AlSafwa Cement
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">
                Customer Portal
              </span>
            </span>
          </Link>
          <button
            type="button"
            className={`absolute -right-3 top-[18px] hidden h-6 w-6 items-center justify-center rounded-full border border-[#e3e1e8] bg-white text-slate-500 shadow-sm transition hover:border-[#54247a] hover:text-[#54247a] lg:inline-flex ${
              sidebarCollapsed ? '' : ''
            }`}
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
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

        <nav className={`flex-1 space-y-2 overflow-y-auto ${sidebarCollapsed ? 'p-2.5' : 'p-3'}`}>
          {visibleNavigation.map((item) => (
            <CustomerNavLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              activePrefix={item.activePrefix}
              collapsed={sidebarCollapsed}
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </CustomerNavLink>
          ))}
        </nav>

        <div className={`border-t border-[#eceaf0] ${sidebarCollapsed ? 'p-2.5' : 'p-3'}`}>
          <div
            className={`group relative flex items-center rounded-lg border border-[#eceaf0] bg-white ${
              sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f6f2fa] text-xs font-bold text-[#54247a]">
              {initials}
            </span>
            <span className={sidebarCollapsed ? 'lg:hidden' : 'min-w-0'}>
              <span className="block truncate text-xs font-semibold text-[#1a1b23]">
                {user?.name ?? 'Customer user'}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-[#64748b]">
                {account?.companyName ?? 'Customer account'}
              </span>
            </span>
            {sidebarCollapsed && (
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 lg:block">
                {user?.name ?? 'Customer user'}
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
        <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-[#e3e1e8] bg-white/95 px-4 backdrop-blur lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              {pageContext.parent && (
                <>
                  <span className="truncate font-medium text-[#64748b]">{pageContext.parent}</span>
                  <span className="text-[#c5c1ca]">/</span>
                </>
              )}
              <span className="truncate font-semibold text-[#1a1b23]">{pageContext.title}</span>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e3e1e8] bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-[#54247a] hover:bg-[#f6f2fa] hover:text-[#54247a]"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label={`Account menu for ${user?.name ?? 'customer user'}`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f6f2fa] text-[11px] font-bold text-[#54247a]">
                {initials}
              </span>
              <span className="hidden max-w-36 truncate sm:inline">{user?.name}</span>
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

        <main className="min-w-0 px-4 py-5 lg:px-6 lg:py-6">
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
  activePrefix,
  onClick,
}: {
  to: string;
  icon: ReactNode;
  children: string;
  collapsed: boolean;
  activePrefix?: string | undefined;
  onClick?: () => void;
}) {
  const location = useLocation();

  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex h-10 items-center rounded-lg text-[13px] font-medium transition ${
          collapsed ? 'justify-center px-2' : 'gap-3 px-3'
        } ${
          (activePrefix ? location.pathname.startsWith(activePrefix) : isActive)
            ? 'bg-[#f6f2fa] text-[#54247a] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[#54247a]'
            : 'text-[#4b4d5c] hover:bg-slate-50 hover:text-[#1a1b23]'
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

function getPageContext(pathname: string) {
  if (pathname.startsWith('/customer/quotations/')) {
    return {
      parent: 'Quotation',
      title: pathname.endsWith('/new') ? 'New Quotation' : 'Quotation Details',
    };
  }
  if (pathname === '/customer/quotations') return { title: 'Quotations' };
  if (pathname.startsWith('/customer/contracts/')) {
    return { parent: 'Contracts', title: 'Contract Details' };
  }
  if (pathname === '/customer/contracts') return { title: 'Contracts' };
  if (pathname.startsWith('/customer/products/')) {
    return { parent: 'Products', title: 'Product Details' };
  }

  const labels: Record<string, string> = {
    '/customer/dashboard': 'Dashboard',
    '/customer/profile': 'Profile',
    '/customer/locations': 'Delivery Locations',
    '/customer/users': 'Users',
    '/customer/products': 'Products',
  };

  return { title: labels[pathname] ?? 'Customer Portal' };
}

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return 'CU';

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
