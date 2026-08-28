import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LogOut,
  Menu,
  PackageCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo/Logo';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { getSalesRoleLabel } from '../../utils/salesRouting';

export function HaderLayout() {
  const { user, logout } = useSalesAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const signOut = async () => {
    await logout();
    navigate('/sales/login', { replace: true });
  };
  return (
    <div className="customer-portal customer-page-bg customer-text min-h-screen font-['Manrope',system-ui,sans-serif]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r border-slate-200 bg-white transition-all lg:translate-x-0 ${collapsed ? 'lg:w-[72px]' : 'lg:w-60'} ${open ? 'translate-x-0' : '-translate-x-full'} w-60`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <Link to="/hader/delivery-requests" className={collapsed ? 'lg:hidden' : ''}>
            <Logo size="sm" />
          </Link>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:block"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button onClick={() => setOpen(false)} className="lg:hidden">
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-2 p-3">
          <Nav
            to="/hader/delivery-requests"
            icon={<ClipboardList size={18} />}
            label="Delivery Requests"
            collapsed={collapsed}
          />
          <Nav
            to="/hader/shipments"
            icon={<PackageCheck size={18} />}
            label="Shipments"
            collapsed={collapsed}
          />
        </nav>
      </aside>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className={`transition-all ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-60'}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 lg:hidden">
            <Menu size={20} />
          </button>
          <div>
            <p className="text-sm font-bold">Hader Delivery Operations</p>
            <p className="text-xs text-slate-500">Delivery requests and shipment preparation</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell audience="sales" />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-slate-500">{user ? getSalesRoleLabel(user.role) : ''}</p>
            </div>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
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
function Nav({
  to,
  icon,
  label,
  collapsed,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center rounded-xl py-3 text-sm font-semibold ${collapsed ? 'justify-center px-3' : 'gap-3 px-4'} ${isActive ? 'bg-[#f6f2fa] text-[#54247a]' : 'text-slate-600 hover:bg-slate-50'}`
      }
      title={collapsed ? label : undefined}
    >
      {icon}
      <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
    </NavLink>
  );
}
