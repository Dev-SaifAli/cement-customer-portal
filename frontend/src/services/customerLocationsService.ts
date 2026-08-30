import type { Coordinates } from '../config/map';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface CustomerLocation {
  id: string;
  name: string;
  siteId: string;
  streetAddress: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  contactPerson: string;
  contactPhone: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
  isPrimary: boolean;
  createdAt?: string | null | undefined;
}

export type CustomerLocationPayload = Omit<
  CustomerLocation,
  'id' | 'siteId' | 'isPrimary' | 'createdAt'
> & {
  isPrimary?: boolean | undefined;
  latitude?: Coordinates['latitude'] | undefined;
  longitude?: Coordinates['longitude'] | undefined;
};

interface CustomerLocationsResponse {
  success: boolean;
  data: {
    locations: CustomerLocation[];
  };
}

interface ApiErrorBody {
  errors?: Record<string, string>;
  error?: {
    message?: string;
    errors?: Record<string, string>;
  };
  message?: string;
}

export class CustomerLocationsApiError extends Error {
  constructor(
    message: string,
    public readonly errors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'CustomerLocationsApiError';
  }
}

export const getCustomerLocations = async () => requestCustomerLocations('/customer/locations');

export const getCustomerLocationCities = async () => {
  const response = await request<{ success: boolean; data: { cities: CustomerLocationCity[] } }>(
    '/customer/locations/cities',
  );
  return response.data.cities;
};

export interface CustomerLocationCity {
  id: string;
  name: string;
}

export const createCustomerLocation = async (payload: CustomerLocationPayload) =>
  requestCustomerLocations('/customer/locations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateCustomerLocation = async (id: string, payload: CustomerLocationPayload) =>
  requestCustomerLocations(`/customer/locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteCustomerLocation = async (id: string) =>
  requestCustomerLocations(`/customer/locations/${id}`, {
    method: 'DELETE',
  });

export const setPrimaryCustomerLocation = async (id: string) =>
  requestCustomerLocations(`/customer/locations/${id}/primary`, {
    method: 'PATCH',
  });

async function requestCustomerLocations(path: string, options: RequestInit = {}) {
  const data = await request<ApiErrorBody & CustomerLocationsResponse>(path, options);
  return data.data.locations;
}

async function request<T>(path: string, options: RequestInit = {}) {
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
    throw new CustomerLocationsApiError('Unable to connect to the delivery locations service.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!response.ok) {
    throw new CustomerLocationsApiError(
      data.error?.message ?? data.message ?? 'Delivery location request failed.',
      data.error?.errors ?? data.errors,
    );
  }

  return data as T;
}
