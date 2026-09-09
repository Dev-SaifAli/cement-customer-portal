const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface OperationalContract {
  id: string;
  reference: string | null;
  customer: { id: string; name: string };
  product: { id: string; code: string; name: string; packaging: string };
  fulfilment: 'DELIVERY' | 'PICKUP';
  status: string;
  totalQuantityTons: number;
  remainingQuantityTons: number;
  startDate: string;
  endDate: string;
  deliveryLocationId: string | null;
  pickupLocationId: string | null;
  haderCity: string | null;
  shipToCity: string | null;
  orderCount: number;
  customerRatePerTon: number;
  palletRequired: boolean;
  palletType: string | null;
  pickupFleet?: {
    trucks: Array<{ id: string; plateNumber: string; vehicleType: string; capacityTon: number }>;
    drivers: Array<{ id: string; name: string; mobile: string }>;
  } | null;
}

export interface OperationalContractAccess { enabled: boolean; fulfilment: 'DELIVERY' | 'PICKUP' }
export interface OperationalPagination { page: number; pageSize: number; total: number; totalPages: number }

export async function getOperationalContractAccess(signal?: AbortSignal) {
  return (await request<{ success: true; data: OperationalContractAccess }>('/hader/contracts/access', signal ? { signal } : {})).data;
}

export async function listOperationalContracts(input: { page: number; search?: string | undefined; productId?: string | undefined; startDate?: string | undefined; signal?: AbortSignal | undefined }) {
  const query = new URLSearchParams({ page: String(input.page) });
  if (input.search) query.set('search', input.search);
  if (input.productId) query.set('productId', input.productId);
  if (input.startDate) query.set('startDate', input.startDate);
  return (await request<{ success: true; data: { items: OperationalContract[]; pagination: OperationalPagination } }>(`/hader/contracts?${query}`, input.signal ? { signal: input.signal } : {})).data;
}

export async function getOperationalContract(id: string, signal?: AbortSignal) {
  return (await request<{ success: true; data: { contract: OperationalContract } }>(`/hader/contracts/${encodeURIComponent(id)}`, signal ? { signal } : {})).data.contract;
}

export async function getOperationalContractFilters(signal?: AbortSignal) {
  return (await request<{ success: true; data: { products: Array<{ id: string; code: string; name: string }> } }>('/hader/contracts/filters', signal ? { signal } : {})).data;
}

export async function createOperationalContractOrder(id: string, input: {
  clientRequestId: string; requestedQuantityTons: number; preferredDeliveryDate?: string | null;
  deliveryNotes?: string | null; truckId?: string | null; driverId?: string | null;
  palletRequired: boolean; palletType: string | null; palletQuantity: number | null;
}) {
  return (await request<{ success: true; data: { order: { id: string; orderNumber: string } } }>(`/hader/contracts/${encodeURIComponent(id)}/orders`, {
    method: 'POST', body: JSON.stringify(input),
  })).data.order;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options, credentials: 'include',
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? 'Unable to complete the contract request.');
  return data;
}
