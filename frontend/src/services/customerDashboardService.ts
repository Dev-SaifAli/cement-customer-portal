const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface CustomerDashboardData {
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
    submittedAt: string | null;
  };
  contact: {
    phone: string | null;
  };
  deliveryLocations: {
    count: number;
    items: Array<{
      id: string | null;
      name: string | null;
      siteId: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
      isPrimary: boolean;
      hasMapLocation: boolean;
    }>;
  };
}

interface CustomerDashboardResponse {
  success: boolean;
  data: CustomerDashboardData;
}

interface ApiErrorBody {
  error?: {
    message?: string;
  };
  message?: string;
}

export class CustomerDashboardApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerDashboardApiError';
  }
}

export const getCustomerDashboard = async () => {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/customer/dashboard`, {
      credentials: 'include',
    });
  } catch {
    throw new CustomerDashboardApiError('Unable to load account overview.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody &
    CustomerDashboardResponse;

  if (!response.ok) {
    throw new CustomerDashboardApiError(
      data.error?.message ?? data.message ?? 'Unable to load account overview.',
    );
  }

  return data.data;
};
