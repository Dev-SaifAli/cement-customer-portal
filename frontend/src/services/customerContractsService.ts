const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface CustomerContractSummary {
  id: string;
  reference: string | null;
  sourceQuotation: { id: string; reference: string | null } | null;
  productCode: string | null;
  productName: string | null;
  packaging: string;
  uom: string;
  fulfilment: 'PICKUP' | 'DELIVERY';
  haderCity: string | null;
  pickupLocation: { id: string; name: string; city: string | null } | null;
  shipTo: { id: string | null; name: string | null; city: string | null; region: string | null } | null;
  totalQuantityTons: number;
  shippedQuantityTons: number;
  remainingQuantityTons: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE';
  customerRate: number;
  activatedAt: string | null;
}

export interface CustomerContractDetails extends CustomerContractSummary {
  quantity: number;
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  grandTotal: number | null;
  paymentTerms: string | null;
  commercialNotes: string | null;
  customerNotes: string | null;
  items: Array<{
    productCode: string | null;
    productName: string | null;
    packagingType: string | null;
    uom: string | null;
    quantity: number | null;
    quantityTon: number | null;
    commercialUom: 'TON';
    packagingQuantity: number | null;
    packagingUom: string | null;
    equivalentTons: number | null;
    customerRate: number | null;
    amount: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerContractsList {
  items: CustomerContractSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface ApiErrorBody {
  error?: { message?: string };
  message?: string;
}

export class CustomerContractsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerContractsApiError';
  }
}

export const listCustomerContracts = async (params: {
  page?: number;
  search?: string;
  product?: string;
  date?: string;
} = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const response = await requestCustomerContracts<{
    success: boolean;
    data: CustomerContractsList;
  }>(`/customer/contracts${query.size ? `?${query}` : ''}`);

  return response.data;
};

export const getCustomerContract = async (id: string) => {
  const response = await requestCustomerContracts<{
    success: boolean;
    data: { contract: CustomerContractDetails };
  }>(`/customer/contracts/${encodeURIComponent(id)}`);

  return response.data.contract;
};

async function requestCustomerContracts<TResponse>(path: string, options: RequestInit = {}) {
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
    throw new CustomerContractsApiError('Unable to connect to the contracts service.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody & TResponse;
  if (!response.ok) {
    throw new CustomerContractsApiError(
      data.error?.message ?? data.message ?? 'Contract request failed.',
    );
  }
  return data;
}
