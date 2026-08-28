const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
export type DeliveryRequestStatus =
  'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CONVERTED_TO_SHIPMENT';
export type ShipmentStatus =
  'CREATED' | 'ASSIGNED' | 'LOADING' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'CLOSED';
export interface DeliveryRequest {
  id: string;
  requestNumber: string;
  status: DeliveryRequestStatus;
  order: { id: string; number: string };
  contract: { id: string; reference: string | null } | null;
  customer: { id: string; companyName: string; contact: string | null; phone: string | null };
  product: { id: string; code: string; name: string; packaging: string; uom: string };
  quantityTon: number;
  equivalentBags: number | null;
  haderCity: { id: string | null; name: string | null };
  shipTo: Record<string, unknown> | null;
  requestedDate: string | null;
  notes: string | null;
  customerRatePerTon: number;
  totalAmount: number;
  shippedTon: number;
  remainingTon: number;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Shipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  quantityTon: number;
  scheduledDate: string | null;
  deliveredAt: string | null;
  createdAt: string;
  deliveryRequest: DeliveryRequest;
}
export interface InternalPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export async function listDeliveryRequests(page = 1, search = '', status = '') {
  return list<DeliveryRequest>('/hader/delivery-requests', page, search, status);
}
export async function getDeliveryRequest(id: string) {
  const r = await request<{ success: true; data: { request: DeliveryRequest } }>(
    `/hader/delivery-requests/${id}`,
  );
  return r.data.request;
}
export async function approveDeliveryRequest(id: string) {
  const r = await request<{ success: true; data: { request: DeliveryRequest } }>(
    `/hader/delivery-requests/${id}/approve`,
    { method: 'POST' },
  );
  return r.data.request;
}
export async function rejectDeliveryRequest(id: string, reason: string) {
  const r = await request<{ success: true; data: { request: DeliveryRequest } }>(
    `/hader/delivery-requests/${id}/reject`,
    json('POST', { reason }),
  );
  return r.data.request;
}
export async function createShipment(
  requestId: string,
  payload: { clientRequestId: string; quantityTon: number; scheduledDate?: string },
) {
  const r = await request<{ success: true; data: { shipment: Shipment } }>(
    `/hader/delivery-requests/${requestId}/create-shipment`,
    json('POST', payload),
  );
  return r.data.shipment;
}
export async function listShipments(
  page = 1,
  search = '',
  status = '',
  audience: 'hader' | 'sales' = 'hader',
) {
  return list<Shipment>(`/${audience}/shipments`, page, search, status);
}
export async function getShipment(id: string, audience: 'hader' | 'sales' = 'hader') {
  const r = await request<{ success: true; data: { shipment: Shipment } }>(
    `/${audience}/shipments/${id}`,
  );
  return r.data.shipment;
}
async function list<T>(path: string, page: number, search: string, status: string) {
  const q = new URLSearchParams({ page: String(page) });
  if (search) q.set('search', search);
  if (status) q.set('status', status);
  const r = await request<{ success: true; data: { items: T[]; pagination: InternalPagination } }>(
    `${path}?${q}`,
  );
  return r.data;
}
function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
async function request<T>(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...options, credentials: 'include' });
  } catch {
    throw new Error('Unable to connect to the Hader delivery service.');
  }
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(data.error?.message ?? data.message ?? 'Hader delivery request failed.');
  return data;
}
