const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type OrderStatus = 'DRAFT' | 'SUBMITTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export interface PickupTruckSnapshot {
  id: string;
  plateNumber: string;
  vehicleType: string;
  capacityTon: number;
}

export interface PickupDriverSnapshot {
  id: string;
  name: string;
  mobile: string;
  licenseNumber: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  contract: { id: string; reference: string | null } | null;
  orderType: 'DIRECT' | 'CONTRACT';
  status: OrderStatus;
  fulfilmentType: 'PICKUP' | 'DELIVERY';
  requestedQuantityTons: number;
  remainingContractQuantityTons: number | null;
  preferredDeliveryDate: string | null;
  deliveryNotes: string | null;
  shipTo: {
    id?: string;
    name?: string;
    city?: string;
    region?: string;
    streetAddress?: string;
  } | null;
  pickupLocation: { id: string; name: string | null } | null;
  pickupTruck: PickupTruckSnapshot | null;
  pickupDriver: PickupDriverSnapshot | null;
  haderCity: string | null;
  deliveryRequest: {
    id: string;
    requestNumber: string | null;
    status: string | null;
  } | null;
  product: {
    id: string;
    code: string;
    name: string;
    packaging: string;
    uom: string;
    unitWeightKg: number | null;
    equivalentPackagingUnits: number | null;
  };
  customerRatePerTon: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectOrderInput {
  productId: string;
  quantityTons: number;
  fulfilmentType: 'DELIVERY' | 'PICKUP';
  shipToLocationId: string | null;
  pickupLocationId: string | null;
  requestedDeliveryDate: string | null;
  notes: string | null;
}

export interface DirectOrderPricing {
  product: {
    id: string;
    code: string;
    name: string;
    image: string | null;
    packaging: string;
    uom: string;
    commercialUom: 'TON';
  };
  quantityTons: number;
  equivalentPackagingUnits: number | null;
  fulfilmentType: 'DELIVERY' | 'PICKUP';
  haderCity: { id: string; name: string };
  shipTo: CustomerOrder['shipTo'];
  pickupLocation: CustomerOrder['pickupLocation'];
  customerRatePerTon: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
}

export interface CustomerOrdersList {
  items: CustomerOrder[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export class CustomerOrdersApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerOrdersApiError';
  }
}

export async function createCustomerOrder(
  contractId: string,
  payload: {
    clientRequestId: string;
    requestedQuantityTons: number;
    preferredDeliveryDate: string | null;
    deliveryNotes: string | null;
    truckId: string | null;
    driverId: string | null;
  },
) {
  const response = await request<{ success: boolean; data: { order: CustomerOrder } }>(
    `/customer/contracts/${encodeURIComponent(contractId)}/orders`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return response.data.order;
}

export async function priceDirectOrder(payload: DirectOrderInput) {
  const response = await request<{ success: boolean; data: { pricing: DirectOrderPricing } }>(
    '/customer/orders/price',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return response.data.pricing;
}

export async function createDirectOrder(payload: DirectOrderInput & { clientRequestId: string }) {
  const response = await request<{ success: boolean; data: { order: CustomerOrder } }>(
    '/customer/orders',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return response.data.order;
}

export async function listCustomerOrders(
  params: {
    page?: number;
    search?: string;
    orderType?: 'DIRECT' | 'CONTRACT' | '';
    status?: OrderStatus | '';
  } = {},
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const response = await request<{ success: boolean; data: CustomerOrdersList }>(
    `/customer/orders${query.size ? `?${query}` : ''}`,
  );
  return response.data;
}

export async function getCustomerOrder(id: string) {
  const response = await request<{ success: boolean; data: { order: CustomerOrder } }>(
    `/customer/orders/${encodeURIComponent(id)}`,
  );
  return response.data.order;
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
    throw new CustomerOrdersApiError('Unable to connect to the orders service.');
  }
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new CustomerOrdersApiError(
      data.error?.message ?? data.message ?? 'Order request failed.',
    );
  }
  return data;
}
