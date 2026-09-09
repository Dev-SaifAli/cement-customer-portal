import type { OrderCreator } from '../utils/orderCreator';
import type { OrderStatus, PickupDriverSnapshot, PickupTruckSnapshot } from './customerOrdersService';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface OperationalOrder {
  id: string;
  orderNumber: string;
  contract: { id: string; reference: string | null } | null;
  customer: { id: string; companyName: string | null };
  product: { id: string; code: string; name: string; packaging: string; uom: string };
  requestedQuantityTons: number;
  fulfilmentType: 'PICKUP' | 'DELIVERY';
  preferredDeliveryDate: string | null;
  haderCity: string | null;
  palletRequired: boolean;
  palletType: string | null;
  palletQuantity: number | null;
  shipTo: CustomerOrderShipTo | null;
  pickupLocation: { id: string; name: string | null; city: string | null } | null;
  pickupTruck: PickupTruckSnapshot | null;
  pickupDriver: PickupDriverSnapshot | null;
  status: OrderStatus;
  creator: OrderCreator | null;
  processing: { processedBySalesUserId: string | null; processedAt: string } | null;
  deliveryRequest: { id: string; requestNumber: string | null; status: string | null } | null;
  shipmentSummary: {
    count: number;
    latestStatus: string | null;
    firstShipment: { id: string; shipmentNumber: string | null } | null;
  };
  createdAt: string;
}

interface CustomerOrderShipTo {
  id?: string;
  name?: string;
  city?: string;
  region?: string;
  streetAddress?: string;
}

interface OperationalOrdersList {
  items: OperationalOrder[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listOperationalOrders(input: {
  page: number;
  search?: string | undefined;
  status?: OrderStatus | undefined;
  signal?: AbortSignal | undefined;
}) {
  const query = new URLSearchParams({ page: String(input.page) });
  if (input.search) query.set('search', input.search);
  if (input.status) query.set('status', input.status);
  return (
    await request<{ success: true; data: OperationalOrdersList }>(
      `/hader/orders?${query}`,
      input.signal ? { signal: input.signal } : {},
    )
  ).data;
}

export async function getOperationalOrder(id: string, signal?: AbortSignal) {
  return (
    await request<{ success: true; data: { order: OperationalOrder } }>(
      `/hader/orders/${encodeURIComponent(id)}`,
      signal ? { signal } : {},
    )
  ).data.order;
}

export async function startOperationalOrderProcessing(id: string) {
  return (
    await request<{ success: true; data: { order: OperationalOrder } }>(
      `/hader/orders/${encodeURIComponent(id)}/start-processing`,
      { method: 'POST' },
    )
  ).data.order;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message ?? 'Unable to load orders.');
  return data;
}
