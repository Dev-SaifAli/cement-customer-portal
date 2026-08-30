import type { SalesUser } from './salesService';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type GlobalNotificationAudience = 'CUSTOMER' | 'SALES';
export type GlobalNotificationStatus = 'ACTIVE' | 'INACTIVE';
export type GlobalNotificationRole = SalesUser['role'] | 'CUSTOMER_ADMIN' | 'PURCHASER' | 'FINANCE_USER' | 'VIEWER';

export interface GlobalNotification {
  id: string;
  title: string;
  message: string;
  audience: GlobalNotificationAudience;
  targetRoles: GlobalNotificationRole[];
  status: GlobalNotificationStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  deliveredCount: number;
}

export interface GlobalNotificationInput {
  title: string;
  message: string;
  audience: GlobalNotificationAudience;
  targetRoles: GlobalNotificationRole[];
  status: GlobalNotificationStatus;
}

export class AdminNotificationsApiError extends Error {}

export async function listGlobalNotifications(input: { page: number; audience?: GlobalNotificationAudience; status?: GlobalNotificationStatus }) {
  const params = new URLSearchParams({ page: String(input.page) });
  if (input.audience) params.set('audience', input.audience);
  if (input.status) params.set('status', input.status);
  return request<{ success: true; data: { notifications: GlobalNotification[]; pagination: { page: number; pageSize: number; total: number } } }>(`/portal-admin/notifications?${params}`).then((result) => result.data);
}

export async function createGlobalNotification(input: GlobalNotificationInput) {
  return request<{ success: true; data: { notification: GlobalNotification } }>('/portal-admin/notifications', { method: 'POST', body: JSON.stringify(input) }).then((result) => result.data.notification);
}

export async function updateGlobalNotification(id: string, input: Partial<GlobalNotificationInput>) {
  return request<{ success: true; data: { notification: GlobalNotification } }>(`/portal-admin/notifications/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }).then((result) => result.data.notification);
}

export async function publishGlobalNotification(id: string) {
  return request<{ success: true; data: { notification: GlobalNotification } }>(`/portal-admin/notifications/${encodeURIComponent(id)}/publish`, { method: 'POST' }).then((result) => result.data.notification);
}

async function request<T>(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: 'include',
      ...(options.body ? { headers: { 'content-type': 'application/json' } } : {}),
    });
  } catch {
    throw new AdminNotificationsApiError('Unable to connect to the notification service.');
  }
  const body = (await response.json().catch(() => ({}))) as T & { message?: string; error?: { message?: string } };
  if (!response.ok) throw new AdminNotificationsApiError(body.error?.message ?? body.message ?? 'Unable to complete the notification request.');
  return body;
}
