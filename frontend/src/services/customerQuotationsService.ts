import type { CustomerLocation } from './customerLocationsService';
import type { CustomerProduct } from './customerProductsService';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type QuotationFulfilmentType = 'PICKUP' | 'DELIVERY';
export type QuotationStatus =
  | 'DRAFT'
  | 'PENDING_SALES_REVIEW'
  | 'UNDER_REVIEW'
  | 'PENDING_HADER_APPROVAL'
  | 'PENDING_PRICE_APPROVAL'
  | 'READY_FOR_CUSTOMER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CLARIFICATION_REQUESTED';

export interface CustomerQuotationSummary {
  id: string;
  reference: string | null;
  status: QuotationStatus;
  fulfilmentType: QuotationFulfilmentType;
  deliveryLocation: string | null;
  requestedDate: string | null;
  itemCount: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerQuotationListFilters {
  page?: number;
  reference?: string;
  createdDate?: string;
  requestedDate?: string;
  fulfilmentType?: QuotationFulfilmentType | '';
  deliveryLocation?: string;
  status?: QuotationStatus | '';
}

export interface CustomerQuotationListResult {
  items: CustomerQuotationSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface PickupLocation {
  id: string;
  name: string;
  city: string;
  region: string;
}

export interface CustomerQuotationItemPayload {
  productId: string;
  quantityTon: number;
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
  validUntil: string | null;
  paymentTerms: string | null;
  commercialNotes: string | null;
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  grandTotal: number | null;
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
      | 'unitWeightKg'
      | 'commercialUom'
      | 'category'
    >;
    packagingType: string;
    uom: string;
    quantity: number;
    quantityTon: number;
    packagingQuantity: number | null;
    commercialUom: 'TON';
    unitWeightKg: number;
    equivalentTons: number;
    palletRequired: boolean;
    palletType: string | null;
    palletQuantity: number | null;
    customerRate: number | null;
    amount: number | null;
    commercialDiscountApplied?: boolean;
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

interface QuotationListResponse {
  success: boolean;
  data: CustomerQuotationListResult;
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
    '/customer/pickup-locations',
  );

  return response.data.locations;
};

export const listCustomerQuotations = async (filters: CustomerQuotationListFilters = {}) => {
  const searchParams = new URLSearchParams();
  if (filters.page) searchParams.set('page', String(filters.page));
  if (filters.reference?.trim()) searchParams.set('reference', filters.reference.trim());
  if (filters.createdDate) searchParams.set('createdDate', filters.createdDate);
  if (filters.requestedDate) searchParams.set('requestedDate', filters.requestedDate);
  if (filters.fulfilmentType) searchParams.set('fulfilmentType', filters.fulfilmentType);
  if (filters.deliveryLocation?.trim())
    searchParams.set('deliveryLocation', filters.deliveryLocation.trim());
  if (filters.status) searchParams.set('status', filters.status);

  const response = await requestCustomerQuotations<QuotationListResponse>(
    `/customer/quotations${searchParams.size ? `?${searchParams.toString()}` : ''}`,
  );

  return response.data;
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

export const acceptCustomerQuotation = async (id: string) =>
  customerQuotationDecision(id, 'accept');

export const rejectCustomerQuotation = async (id: string, reason: string) =>
  customerQuotationDecision(id, 'reject', reason);

export const requestCustomerQuotationClarification = async (id: string, message: string) =>
  customerQuotationDecision(id, 'request-clarification', message);

async function customerQuotationDecision(
  id: string,
  action: 'accept' | 'reject' | 'request-clarification',
  reason?: string,
) {
  const response = await requestCustomerQuotations<QuotationResponse>(
    `/customer/quotations/${encodeURIComponent(id)}/${action}`,
    {
      method: 'POST',
      ...(reason === undefined ? {} : { body: JSON.stringify({ reason }) }),
    },
  );

  return response.data.quotation;
}

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
