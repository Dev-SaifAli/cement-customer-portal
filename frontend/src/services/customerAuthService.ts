const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface CustomerAuthUser {
  id: string;
  name: string;
  email: string;
  role: CustomerRole;
}

export type CustomerRole = 'CUSTOMER_ADMIN' | 'PURCHASER' | 'FINANCE_USER' | 'VIEWER';

export interface CustomerAuthAccount {
  id: string;
  companyName: string;
}

export interface CustomerAuthSession {
  user: CustomerAuthUser;
  account: CustomerAuthAccount;
}

interface CustomerLoginResponseUser extends CustomerAuthUser {
  account?: CustomerAuthAccount;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

export class CustomerAuthApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'CustomerAuthApiError';
  }
}

const requestCustomerAuth = async <TResponse>(path: string, options: RequestInit = {}) => {
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
    throw new CustomerAuthApiError('Unable to connect to the Customer authentication service.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody & TResponse;

  if (!response.ok) {
    throw new CustomerAuthApiError(
      data.error?.message ?? data.message ?? 'Authentication request failed.',
      response.status,
      data.error?.code,
    );
  }

  return data as TResponse;
};

export const customerLogin = async (payload: { email: string; password: string }) => {
  const response = await requestCustomerAuth<{
    success: boolean;
    data: {
      user: CustomerLoginResponseUser;
      account?: CustomerAuthAccount;
    };
  }>('/customer/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const { account: nestedAccount, ...safeUser } = response.data.user;
  const account = response.data.account ?? nestedAccount;

  if (!account) {
    throw new CustomerAuthApiError('Customer account information is unavailable.');
  }

  return {
    user: {
      id: safeUser.id,
      name: safeUser.name,
      email: safeUser.email,
      role: safeUser.role,
    },
    account: {
      id: account.id,
      companyName: account.companyName,
    },
  };
};

export const getCustomerMe = async () => {
  const response = await requestCustomerAuth<{ success: boolean; data: CustomerAuthSession }>(
    '/customer/auth/me',
  );

  return response.data;
};

export const customerLogout = async () => {
  await requestCustomerAuth<{ success: boolean; message: string }>('/customer/auth/logout', {
    method: 'POST',
  });
};
