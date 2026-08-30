import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Logo from '../Logo/Logo';
import type { CustomerThemePreference } from '../../context/CustomerThemeContext';

export interface AppShellNavigationItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
}

export interface AppShellNavigationSection {
  label?: string;
  items: AppShellNavigationItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface AppShellPageContext {
  title: string;
  subtitle?: string;
  parent?: string;
}

interface AppShellProps {
  homePath: string;
  portalLabel: string;
  navigation: AppShellNavigationSection[];
  pageContext: AppShellPageContext;
  user: {
    name: string | null | undefined;
    email: string | null | undefined;
    roleLabel: string | null | undefined;
  };
  themePreference: CustomerThemePreference;
  onThemeChange: (preference: CustomerThemePreference) => void;
  onLogout: () => void | Promise<void>;
  collapseStorageKey: string;
  headerActions?: ReactNode;
}

/**
 * Shared visual shell only. Authentication, route guards, permissions and the
 * navigation supplied by each portal remain owned by their existing layouts.
 */
export function AppShell({
  homePath,
  portalLabel,
  navigation,
  pageContext,
  user,
  themePreference,
  onThemeChange,
  onLogout,
  collapseStorageKey,
  headerActions,
}: AppShellProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(collapseStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(collapseStorageKey, String(next));
      } catch {
        // Sidebar collapse remains usable when browser storage is unavailable.
      }
      return next;
    });
  };

  return (
    <div className="customer-portal customer-page-bg customer-text min-h-screen overflow-x-hidden font-['Manrope',system-ui,sans-serif]">
      <aside
        className={`customer-surface customer-border fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[232px]'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`customer-border-soft relative flex h-[60px] shrink-0 items-center border-b ${
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <Link
            to={homePath}
            className={`flex min-w-0 items-center gap-2.5 ${sidebarCollapsed ? 'lg:hidden' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Logo size="sm" />
            <span className="customer-border min-w-0 border-l pl-2.5">
              <span className="customer-primary block truncate text-sm font-bold leading-tight">
                AlSafwa Cement
              </span>
              <span className="customer-muted mt-0.5 block truncate text-[11px] font-medium">
                {portalLabel}
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

        <nav
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain ${
            sidebarCollapsed ? 'p-2.5' : 'p-3'
          }`}
        >
          {navigation.map((section, sectionIndex) => (
            <SidebarNavigationSection
              key={section.label ?? sectionIndex}
              section={section}
              sectionIndex={sectionIndex}
              pathname={location.pathname}
              sidebarCollapsed={sidebarCollapsed}
              closeMobileSidebar={() => setSidebarOpen(false)}
            />
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <div
        className={`min-w-0 transition-[padding] duration-200 ${
          sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[232px]'
        }`}
      >
        <header className="customer-surface customer-border sticky top-0 z-20 flex h-[60px] items-center justify-between border-b px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="customer-secondary shrink-0 rounded-lg p-2 transition hover:bg-[var(--customer-surface-secondary)] lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              {pageContext.parent && (
                <p className="customer-muted hidden truncate text-[10px] font-semibold sm:block">
                  {pageContext.parent}
                </p>
              )}
              <p className="customer-text truncate text-sm font-semibold">{pageContext.title}</p>
              {pageContext.subtitle && (
                <p className="customer-muted hidden truncate text-xs sm:block">{pageContext.subtitle}</p>
              )}
            </div>
          </div>

          <div className="relative ml-3 flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={() => setProfileOpen((current) => !current)}
              className="customer-surface customer-border customer-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border transition duration-150 hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)]"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-label={`Account menu for ${user.name ?? 'portal user'}`}
            >
              <span className="customer-primary-soft customer-primary flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold">
                {getInitials(user.name)}
              </span>
            </button>
            {profileOpen && (
              <div
                role="menu"
                className="customer-card absolute right-0 top-12 z-30 w-72 origin-top-right rounded-xl border p-2 shadow-xl motion-safe:animate-[fadeSlide_180ms_ease-out]"
              >
                <div className="customer-border-soft border-b px-3 py-3">
                  <p className="customer-text truncate text-sm font-bold">{user.name}</p>
                  {user.email && <p className="customer-muted mt-0.5 truncate text-xs">{user.email}</p>}
                  {user.roleLabel && (
                    <p className="customer-primary mt-2 truncate text-xs font-semibold">{user.roleLabel}</p>
                  )}
                </div>
                <div className="customer-border-soft border-b px-2 py-3">
                  <p className="customer-muted px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.08em]">
                    Appearance
                  </p>
                  <div className="grid grid-cols-3 gap-1" role="group" aria-label="Appearance">
                    <ThemeOption icon={<Sun size={15} />} label="Light" value="light" selected={themePreference === 'light'} onSelect={onThemeChange} />
                    <ThemeOption icon={<Moon size={15} />} label="Dark" value="dark" selected={themePreference === 'dark'} onSelect={onThemeChange} />
                    <ThemeOption icon={<Monitor size={15} />} label="System" value="system" selected={themePreference === 'system'} onSelect={onThemeChange} />
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void onLogout()}
                  className="customer-secondary mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-red-50 hover:text-[#b42318]"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="min-w-0 max-w-full px-4 py-5 motion-safe:animate-[fadeSlide_180ms_ease-out] lg:px-6 lg:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarNavigationSection({
  section,
  sectionIndex,
  pathname,
  sidebarCollapsed,
  closeMobileSidebar,
}: {
  section: AppShellNavigationSection;
  sectionIndex: number;
  pathname: string;
  sidebarCollapsed: boolean;
  closeMobileSidebar: () => void;
}) {
  const [expanded, setExpanded] = useState(section.defaultExpanded ?? true);
  const showItems = sidebarCollapsed || !section.collapsible || expanded;

  return (
    <div className={sectionIndex > 0 ? 'mt-4' : ''}>
      {section.label && !sidebarCollapsed &&
        (section.collapsible ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="customer-secondary flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition duration-150 hover:bg-[var(--customer-surface-secondary)] hover:text-[var(--customer-text)]"
            aria-expanded={expanded}
          >
            <span>{section.label}</span>
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <p className="customer-muted px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.1em]">
            {section.label}
          </p>
        ))}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          showItems ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={`${section.label && section.collapsible && !sidebarCollapsed ? 'mt-1' : ''} space-y-1`}>
            {section.items.map((item) => (
              <SidebarNavigationLink
                key={item.to}
                item={item}
                pathname={pathname}
                sidebarCollapsed={sidebarCollapsed}
                closeMobileSidebar={closeMobileSidebar}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarNavigationLink({
  item,
  pathname,
  sidebarCollapsed,
  closeMobileSidebar,
}: {
  item: AppShellNavigationItem;
  pathname: string;
  sidebarCollapsed: boolean;
  closeMobileSidebar: () => void;
}) {
  const active = item.isActive
    ? item.isActive(pathname)
    : item.end
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(`${item.to}/`);

  return (
    <Link
      to={item.to}
      onClick={closeMobileSidebar}
      title={sidebarCollapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-10 items-center rounded-lg text-[13px] font-semibold transition duration-150 ${
        sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
      } ${
        active
          ? 'customer-primary-soft customer-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--customer-primary)]'
          : 'customer-secondary hover:bg-[var(--customer-surface-secondary)] hover:text-[var(--customer-text)]'
      }`}
    >
      <span className="shrink-0">{item.icon}</span>
      <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
    </Link>
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

function getInitials(name?: string | null) {
  if (!name?.trim()) return 'AP';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
