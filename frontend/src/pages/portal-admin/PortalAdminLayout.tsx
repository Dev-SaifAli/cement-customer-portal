import { Bell, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell, type AppShellNavigationItem } from '../../components/app-shell/AppShell';
import { NotificationBell } from '../../components/notifications/NotificationBell';
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

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <AppShell
      portalLabel="Portal Administration"
      navigation={[{ label: 'Administration', items: navigation }]}
      user={{
        name: user?.name,
        email: user?.email,
        roleLabel: 'Portal Administrator',
      }}
      themePreference={preference}
      onThemeChange={setPreference}
      onLogout={handleLogout}
      collapseStorageKey="portal_admin_sidebar_collapsed"
      headerActions={<NotificationBell audience="sales" />}
    />
  );
}
