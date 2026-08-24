import type { CustomerLocation } from './customerLocationsService';
import type { CustomerProduct } from './customerProductsService';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type QuotationFulfilmentType = 'PICKUP' | 'DELIVERY';
export type QuotationStatus = 'DRAFT' | 'PENDING_SALES_REVIEW';

export interface PickupLocation {
  id: string;
  name: string;
  city: string;
  region: string;
}

export interface CustomerQuotationItemPayload {
  productId: string;
  quantity: number;
  palletRequired?: boolean;
  palletType?: string;
  palletQuantity?: number;
}

export interface CustomerQuotationPayload {
  fulfilmentType: QuotationFulfilmentType;
  pickupLocationId?: string;
  shipToLocationId?: string;
  requestedDate?: string;
  notes?: string;
  items: CustomerQuotationItemPayload[];
}

export interface CustomerQuotation {
  id: string;
  reference: string | null;
  status: QuotationStatus;
  fulfilmentType: QuotationFulfilmentType;
  pickupLocationId: string | null;
  pickupLocation: PickupLocation | null;
  shipToLocationId: string | null;
  shipToLocation: CustomerLocation | null;
  requestedDate: string | null;
  notes: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    productId: string;
    product: Pick<
      CustomerProduct,
      | 'id'
      | 'productCode'
      | 'productName'
      | 'description'
      | 'shortDescription'
      | 'image'
      | 'packagingType'
      | 'uom'
      | 'category'
    >;
    packagingType: string;
    uom: string;
    quantity: number;
    palletRequired: boolean;
    palletType: string | null;
    palletQuantity: number | null;
  }>;
}

interface PickupLocationsResponse {
  success: boolean;
  data: {
    locations: PickupLocation[];
  };
}

interface QuotationResponse {
  success: boolean;
  data: {
    quotation: CustomerQuotation;
  };
}

interface ApiErrorBody {
  error?: {
    message?: string;
  };
  message?: string;
}

export class CustomerQuotationsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerQuotationsApiError';
  }
}

export const getPickupLocations = async () => {
  const response = await requestCustomerQuotations<PickupLocationsResponse>(
    '/customer/quotations/pickup-locations',
  );

  return response.data.locations;
};

export const createCustomerQuotation = async (payload: CustomerQuotationPayload) => {
  const response = await requestCustomerQuotations<QuotationResponse>('/customer/quotations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data.quotation;
};

export const getCustomerQuotation = async (id: string) => {
  const response = await requestCustomerQuotations<QuotationResponse>(
    `/customer/quotations/${encodeURIComponent(id)}`,
  );

  return response.data.quotation;
};

export const updateCustomerQuotation = async (id: string, payload: CustomerQuotationPayload) => {
  const response = await requestCustomerQuotations<QuotationResponse>(
    `/customer/quotations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );

  return response.data.quotation;
};

export const submitCustomerQuotation = async (id: string) => {
  const response = await requestCustomerQuotations<QuotationResponse>(
    `/customer/quotations/${encodeURIComponent(id)}/submit`,
    {
      method: 'POST',
    },
  );

  return response.data.quotation;
};

async function requestCustomerQuotations<TResponse>(path: string, options: RequestInit = {}) {
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
    throw new CustomerQuotationsApiError('Unable to connect to the quotation service.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody & TResponse;

  if (!response.ok) {
    throw new CustomerQuotationsApiError(
      data.error?.message ?? data.message ?? 'Quotation request failed.',
    );
  }

  return data;
}
