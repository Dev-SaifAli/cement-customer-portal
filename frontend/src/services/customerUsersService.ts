import type { CustomerRole } from './customerAuthService';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: CustomerRole;
  roleLabel: string;
  isActive: boolean;
  passwordMustChange: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerUserPayload {
  name: string;
  email: string;
  phone: string;
  role: CustomerRole;
  isActive: boolean;
}

export interface UpdateCustomerUserPayload {
  name?: string;
  phone?: string;
  role?: CustomerRole;
  isActive?: boolean;
}

interface CustomerUsersResponse {
  success: boolean;
  data: {
    users: CustomerUser[];
  };
}

interface CreateCustomerUserResponse {
  success: boolean;
  data: {
    user: CustomerUser;
    temporaryPassword: string;
  };
}

interface CustomerUserResponse {
  success: boolean;
  data: {
    user: CustomerUser;
  };
}

interface ApiErrorBody {
  error?: {
    message?: string;
  };
  message?: string;
}

export class CustomerUsersApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerUsersApiError';
  }
}

export const getCustomerUsers = async () => {
  const response = await requestCustomerUsers<CustomerUsersResponse>('/customer/users');

  return response.data.users;
};

export const createCustomerUser = async (payload: CreateCustomerUserPayload) => {
  const response = await requestCustomerUsers<CreateCustomerUserResponse>('/customer/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const getCustomerUser = async (id: string) => {
  const response = await requestCustomerUsers<CustomerUserResponse>(`/customer/users/${id}`);

  return response.data.user;
};

export const updateCustomerUser = async (id: string, payload: UpdateCustomerUserPayload) => {
  const response = await requestCustomerUsers<CustomerUserResponse>(`/customer/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  return response.data.user;
};

async function requestCustomerUsers<TResponse>(path: string, options: RequestInit = {}) {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new CustomerUsersApiError('Unable to connect to the customer users service.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody & TResponse;

  if (!response.ok) {
    throw new CustomerUsersApiError(
      data.error?.message ?? data.message ?? 'Customer users request failed.',
    );
  }

  return data as TResponse;
}
