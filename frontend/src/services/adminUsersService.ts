import type { SalesUser } from './salesService';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type InternalUserRole = SalesUser['role'];
export type InternalUserStatus = 'ACTIVE' | 'INACTIVE';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: InternalUserRole;
  status: InternalUserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserInput {
  name: string;
  email: string;
  role: InternalUserRole;
  status: InternalUserStatus;
}

export class AdminUsersApiError extends Error {}

export async function listAdminUsers(input: {
  page: number;
  search?: string;
  role?: InternalUserRole;
  status?: InternalUserStatus;
}) {
  const params = new URLSearchParams({ page: String(input.page) });
  if (input.search) params.set('search', input.search);
  if (input.role) params.set('role', input.role);
  if (input.status) params.set('status', input.status);
  return request<{
    success: true;
    data: {
      users: AdminUser[];
      pagination: { page: number; pageSize: number; total: number };
    };
  }>(`/admin/users?${params}`).then((result) => result.data);
}

export async function createAdminUser(input: AdminUserInput & {
  password: string;
  confirmPassword: string;
}) {
  return request<{ success: true; data: { user: AdminUser } }>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((result) => result.data.user);
}

export async function updateAdminUser(id: string, input: Partial<AdminUserInput>) {
  return request<{ success: true; data: { user: AdminUser } }>(
    `/admin/users/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  ).then((result) => result.data.user);
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
    throw new AdminUsersApiError('Unable to connect to the user management service.');
  }
  const body = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new AdminUsersApiError(
      body.error?.message ?? body.message ?? 'Unable to complete the user request.',
    );
  }
  return body;
}
