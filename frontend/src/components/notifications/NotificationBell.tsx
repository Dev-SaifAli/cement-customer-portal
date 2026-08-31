import { Bell, CheckCheck, FileText, PackageCheck, RefreshCw, ShoppingBag } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  notificationsService,
  type NotificationAudience,
  type PortalNotification,
} from '../../services/notificationsService';

export function NotificationBell({ audience }: { audience: NotificationAudience }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const result = await notificationsService.unreadCount(audience);
      setUnreadCount(result.unreadCount);
    } catch {
      // Polling failures stay silent; opening the panel provides an explicit retry state.
    }
  }, [audience]);

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await notificationsService.list(audience);
      setNotifications(result.notifications);
      setUnreadCount(result.notifications.filter((notification) => !notification.readAt).length);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [audience]);

  useEffect(() => {
    void refreshCount();
    const timer = window.setInterval(() => void refreshCount(), 60_000);
    const onFocus = () => void refreshCount();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshCount]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void refreshNotifications();
  };

  const openNotification = async (notification: PortalNotification) => {
    if (!notification.readAt) {
      try {
        await notificationsService.markRead(audience, notification.id);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
          ),
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch {
        return;
      }
    }
    if (notification.actionUrl && validActionUrl(notification.actionUrl, audience)) {
      setOpen(false);
      navigate(notification.actionUrl);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsService.markAllRead(audience);
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
      );
      setUnreadCount(0);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="customer-border customer-secondary relative inline-flex h-10 w-10 items-center justify-center rounded-lg border transition hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#991f18] px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="customer-card absolute right-0 top-12 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border"
        >
          <div className="customer-border-soft flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="customer-text text-sm font-bold">Notifications</p>
              <p className="customer-muted mt-0.5 text-[11px]">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="customer-primary inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="space-y-3 p-4" aria-label="Loading notifications">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="customer-primary-soft h-16 animate-pulse rounded-lg" />
                ))}
              </div>
            )}
            {error && !loading && (
              <div className="px-5 py-8 text-center">
                <p className="customer-text text-sm font-semibold">Unable to load notifications.</p>
                <button
                  type="button"
                  onClick={() => void refreshNotifications()}
                  className="customer-primary mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
                >
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            )}
            {!loading && !error && notifications.length === 0 && (
              <div className="px-5 py-9 text-center">
                <span className="customer-primary-soft customer-primary mx-auto flex h-10 w-10 items-center justify-center rounded-full">
                  <Bell size={18} />
                </span>
                <p className="customer-text mt-3 text-sm font-semibold">
                  You&apos;re all caught up
                </p>
                <p className="customer-muted mt-1 text-xs">No notifications yet.</p>
              </div>
            )}
            {!error &&
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  role="menuitem"
                  onClick={() => void openNotification(notification)}
                  className={`customer-border-soft flex w-full gap-3 border-b px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--customer-surface-secondary)] ${
                    notification.readAt ? '' : 'customer-primary-soft'
                  }`}
                >
                  <span className="customer-surface customer-border customer-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
                    <NotificationIcon type={notification.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="customer-text block truncate text-sm font-semibold">
                      {notification.title}
                    </span>
                    <span className="customer-secondary mt-0.5 block line-clamp-2 text-xs leading-5">
                      {notification.message}
                    </span>
                    <span className="customer-muted mt-1 block text-[11px]">
                      {relativeTime(notification.createdAt)}
                    </span>
                  </span>
                  {!notification.readAt && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--customer-primary)]" />
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  if (type.includes('ORDER')) return <ShoppingBag size={17} />;
  if (type.includes('SHIPMENT') || type.includes('DELIVERY')) return <PackageCheck size={17} />;
  return <FileText size={17} />;
}

function validActionUrl(url: string, audience: NotificationAudience) {
  return (
    url.startsWith(audience === 'customer' ? '/customer/' : '/sales/') ||
    (audience === 'sales' && url.startsWith('/hader/'))
  );
}

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'Just now';
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return seconds <= 1 ? 'Just now' : `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
