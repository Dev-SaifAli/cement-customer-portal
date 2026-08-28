const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type NotificationAudience = 'customer' | 'sales';

export interface PortalNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

async function request<T>(audience: NotificationAudience, path: string, options?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}/notifications${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'x-portal-audience': audience,
      ...(options?.body ? { 'content-type': 'application/json' } : {}),
      ...options?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string };
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? 'Notification request failed.');
  }
  return payload.data as T;
}

export const notificationsService = {
  async list(audience: NotificationAudience) {
    return request<{ notifications: PortalNotification[] }>(audience, '/');
  },
  async unreadCount(audience: NotificationAudience) {
    return request<{ unreadCount: number }>(audience, '/unread-count');
  },
  async markRead(audience: NotificationAudience, id: string) {
    return request<{ notification: PortalNotification }>(audience, `/${id}/read`, {
      method: 'PATCH',
    });
  },
  async markAllRead(audience: NotificationAudience) {
    return request<{ unreadCount: number }>(audience, '/read-all', { method: 'PATCH' });
  },
};
