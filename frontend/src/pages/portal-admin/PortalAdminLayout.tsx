import { Bell, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, type AppShellNavigationItem } from '../../components/app-shell/AppShell';
import { useCustomerTheme } from '../../context/CustomerThemeContext';
import { useSalesAuth } from '../../context/SalesAuthContext';

const navigation: AppShellNavigationItem[] = [
  { to: '/portal-admin/users', label: 'User Management', icon: <Users size={18} /> },
  { to: '/portal-admin/notifications', label: 'Global Notifications', icon: <Bell size={18} /> },
];

export function PortalAdminLayout() {
  const { user, logout } = useSalesAuth();
  const { preference, setPreference } = useCustomerTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  const current = navigation.find(
    ({ to }) => location.pathname === to || location.pathname.startsWith(`${to}/`),
  );

  return (
    <AppShell
      homePath="/portal-admin/users"
      portalLabel="Portal Administration"
      navigation={[{ label: 'Administration', items: navigation }]}
      pageContext={{
        title: current?.label ?? 'Portal Administration',
        subtitle: 'Users, access and global communications',
      }}
      user={{
        name: user?.name,
        email: user?.email,
        roleLabel: 'Portal Administrator',
      }}
      themePreference={preference}
      onThemeChange={setPreference}
      onLogout={handleLogout}
      collapseStorageKey="portal_admin_sidebar_collapsed"
    />
  );
}
