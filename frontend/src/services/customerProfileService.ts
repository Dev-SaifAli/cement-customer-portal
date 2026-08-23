const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface CustomerProfileData {
  account: {
    id: string;
    companyName: string;
    status: string;
    activatedAt: string | null;
  };
  administrator: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: 'CUSTOMER_ADMIN';
  };
  registration: {
    id: string;
    reference: string | null;
    status: string;
  };
}

interface CustomerProfileResponse {
  success: boolean;
  data: CustomerProfileData;
}

interface ApiErrorBody {
  error?: {
    message?: string;
  };
  message?: string;
}

export class CustomerProfileApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerProfileApiError';
  }
}

export const getCustomerProfile = async () =>
  requestCustomerProfile('/customer/profile');

export const updateCustomerProfile = async (payload: {
  administratorName?: string;
  contactPhone?: string;
}) =>
  requestCustomerProfile('/customer/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

async function requestCustomerProfile(path: string, options: RequestInit = {}) {
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
    throw new CustomerProfileApiError('Unable to connect to the customer profile service.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody &
    CustomerProfileResponse;

  if (!response.ok) {
    throw new CustomerProfileApiError(
      data.error?.message ?? data.message ?? 'Customer profile request failed.',
    );
  }

  return data.data;
}
