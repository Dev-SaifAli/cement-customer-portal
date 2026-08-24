import { BadgeDollarSign, ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo/Logo';
import { useSalesAuth } from '../../context/SalesAuthContext';

export function PricingAdminLayout() {
  const { user, logout } = useSalesAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/sales/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1a1b23]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r border-[#e3e1e8] bg-white transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`flex h-16 items-center border-b border-[#e3e1e8] ${
            sidebarCollapsed ? 'justify-center px-3' : 'justify-between px-4'
          }`}
        >
          <Link to="/admin/product-prices" className={sidebarCollapsed ? 'lg:hidden' : ''}>
            <Logo size="sm" />
          </Link>
          <button
            type="button"
            className="hidden rounded-lg p-2 text-[#64748b] hover:bg-[#f6f2fa] lg:inline-flex"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-[#64748b] hover:bg-[#f6f2fa] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className={sidebarCollapsed ? 'p-3' : 'p-4'}>
          <NavLink
            to="/admin/product-prices"
            title={sidebarCollapsed ? 'Pricing' : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-xl py-3 text-sm font-semibold transition ${
                sidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'
              } ${
                isActive
                  ? 'bg-[#f6f2fa] text-[#54247a]'
                  : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1a1b23]'
              }`
            }
          >
            <BadgeDollarSign size={18} />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Pricing</span>
          </NavLink>
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-[#e3e1e8] p-3">
          {!sidebarCollapsed && (
            <div className="mb-2 min-w-0 px-2 py-2">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-[#64748b]">Pricing Administrator</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleLogout()}
            title={sidebarCollapsed ? 'Log out' : undefined}
            className={`flex w-full items-center rounded-xl py-3 text-sm font-semibold text-[#64748b] hover:bg-red-50 hover:text-[#b42318] ${
              sidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'
            }`}
          >
            <LogOut size={18} />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Log out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <div
        className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#e3e1e8] bg-white/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-[#64748b] hover:bg-[#f6f2fa] lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-sm font-semibold">Pricing Administration</p>
              <p className="text-xs text-[#64748b]">Portal-owned quotation baseline prices</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-[#64748b]">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e3e1e8] px-3 text-sm font-semibold text-[#64748b] hover:bg-red-50 hover:text-[#b42318]"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>
        <main className="px-4 py-5 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
