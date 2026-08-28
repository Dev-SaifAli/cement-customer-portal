const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type CustomerShipmentStatus =
  'CREATED' | 'ASSIGNED' | 'LOADING' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'CLOSED';

export interface CustomerShipmentEvent {
  id: string;
  eventType: string;
  previousStatus: CustomerShipmentStatus | null;
  newStatus: CustomerShipmentStatus | null;
  createdAt: string;
}

export interface CustomerShipment {
  id: string;
  shipmentNumber: string;
  status: CustomerShipmentStatus;
  quantityTon: number;
  equivalentBags: number | null;
  scheduledDate: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: { id: string; number: string };
  contract: { id: string | null; reference: string | null };
  product: {
    id: string;
    code: string;
    name: string;
    packaging: string;
    uom: string;
  };
  fulfilmentType: 'DELIVERY' | 'PICKUP';
  haderCity: string | null;
  shipTo: {
    id?: string;
    name?: string;
    streetAddress?: string;
    city?: string;
    region?: string;
    country?: string;
  } | null;
  requestedDate: string | null;
  events?: CustomerShipmentEvent[];
}

export interface CustomerShipmentsList {
  items: CustomerShipment[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listCustomerShipments(
  params: {
    page?: number;
    search?: string;
    status?: CustomerShipmentStatus | '';
    dateFrom?: string;
    dateTo?: string;
  } = {},
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const response = await request<{ success: true; data: CustomerShipmentsList }>(
    `/customer/shipments${query.size ? `?${query}` : ''}`,
  );
  return response.data;
}

export async function getCustomerShipment(id: string) {
  const response = await request<{ success: true; data: { shipment: CustomerShipment } }>(
    `/customer/shipments/${encodeURIComponent(id)}`,
  );
  return response.data.shipment;
}

async function request<T>(path: string) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include' });
  } catch {
    throw new Error('Unable to connect to the shipment service.');
  }
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(data.error?.message ?? data.message ?? 'Shipment request failed.');
  return data;
}
