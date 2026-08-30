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
  haderZoneStatus: 'WITHIN_HADER_ZONE' | 'OUTSIDE_HADER_ZONE' | null;
}
export interface Shipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  quantityTon: number;
  scheduledDate: string | null;
  scheduledTime: string | null;
  assignedAt: string | null;
  dispatchedAt: string | null;
  assignment: {
    transporter: { id: string; name: string | null };
    truck: {
      id: string;
      number: string | null;
      plateNumber: string | null;
      vehicleType: string | null;
      capacityTon: number;
    } | null;
    driver: {
      id: string;
      name: string | null;
      mobile: string | null;
      licenseNumber: string | null;
    } | null;
  } | null;
  deliveredAt: string | null;
  createdAt: string;
  deliveryRequest: DeliveryRequest;
}
export interface DispatchEvent {
  eventType: string;
  previousStatus: string | null;
  newStatus: string | null;
  notes: string | null;
  actor: string;
  createdAt: string;
}
export type DispatchShipment = Shipment & { history: DispatchEvent[] };
export type DeliveryExecutionStatus =
  'LOADED' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'CLOSED';
export interface DeliveryTeamShipment {
  id: string;
  shipmentNumber: string;
  status: DeliveryExecutionStatus;
  quantityTon: number;
  equivalentBags: number | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  requestedDate: string | null;
  dispatchedAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  order: { id: string; number: string };
  contract: { id: string; reference: string | null } | null;
  customer: { companyName: string };
  product: { id: string; code: string; name: string; packaging: string; uom: string };
  haderCity: { id: string | null; name: string | null };
  shipTo: Record<string, unknown> | null;
  assignment: Shipment['assignment'];
  history?: DispatchEvent[];
}
export type ShipmentPodDocumentType = 'DELIVERY_PHOTO' | 'SIGNED_POD';
export interface ShipmentPodDocument {
  id: string;
  documentType: ShipmentPodDocumentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}
export interface ShipmentPod {
  id: string;
  shipment: { id: string; number: string };
  receiver: string;
  deliveredQuantityTon: number;
  deliveryTime: string;
  location: { latitude: number; longitude: number } | null;
  evidence: string | null;
  documents: ShipmentPodDocument[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface CreateShipmentPodPayload {
  receiver: string;
  deliveredQuantityTon: number;
  deliveryTime: string;
  latitude?: number;
  longitude?: number;
  evidence?: string;
}
export interface DispatchResource {
  id: string;
  name?: string;
  companyName?: string;
  truckNumber?: string;
  plateNumber?: string;
  vehicleType?: string;
  capacityTon?: number;
  driverNumber?: string;
  mobile?: string;
  licenseNumber?: string;
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
export async function listDispatch(params: {
  page: number;
  status?: string | undefined;
  haderCityId?: string | undefined;
  requestedDate?: string | undefined;
  productId?: string | undefined;
}) {
  const q = new URLSearchParams({ page: String(params.page) });
  for (const [key, value] of Object.entries(params))
    if (key !== 'page' && value) q.set(key, String(value));
  const r = await request<{
    success: true;
    data: { items: Shipment[]; pagination: InternalPagination };
  }>(`/hader/dispatch?${q}`);
  return r.data;
}
export async function getDispatchShipment(id: string) {
  const r = await request<{ success: true; data: { shipment: DispatchShipment } }>(
    `/hader/dispatch/${id}`,
  );
  return r.data.shipment;
}
export async function getDispatchFilters() {
  const r = await request<{
    success: true;
    data: {
      cities: { id: string; name: string }[];
      products: { id: string; code: string; name: string }[];
    };
  }>('/hader/dispatch/filters');
  return r.data;
}
export async function getDispatchResources() {
  const [transporters, trucks, drivers] = await Promise.all([
    request<{ success: true; data: { transporters: DispatchResource[] } }>('/hader/transporters'),
    request<{ success: true; data: { trucks: DispatchResource[] } }>('/hader/delivery-fleet'),
    request<{ success: true; data: { drivers: DispatchResource[] } }>('/hader/delivery-drivers'),
  ]);
  return {
    transporters: transporters.data.transporters,
    trucks: trucks.data.trucks,
    drivers: drivers.data.drivers,
  };
}
export async function assignShipment(
  id: string,
  payload: { transporterId: string; truckId: string; driverId: string },
) {
  const r = await request<{ success: true; data: { shipment: DispatchShipment } }>(
    `/hader/shipments/${id}/assign`,
    json('POST', payload),
  );
  return r.data.shipment;
}
export async function scheduleShipment(
  id: string,
  payload: { scheduledDate: string; scheduledTime: string },
) {
  const r = await request<{ success: true; data: { shipment: DispatchShipment } }>(
    `/hader/shipments/${id}/schedule`,
    json('POST', payload),
  );
  return r.data.shipment;
}
export async function dispatchShipment(id: string) {
  const r = await request<{ success: true; data: { shipment: DispatchShipment } }>(
    `/hader/shipments/${id}/dispatch`,
    { method: 'POST' },
  );
  return r.data.shipment;
}

export async function listDeliveryTeam(params: {
  page: number;
  search?: string;
  status?: DeliveryExecutionStatus | '';
  haderCityId?: string;
  deliveryDate?: string;
  driverId?: string;
  truckId?: string;
}) {
  const query = new URLSearchParams({ page: String(params.page) });
  Object.entries(params).forEach(([key, value]) => {
    if (key !== 'page' && value) query.set(key, String(value));
  });
  const response = await request<{
    success: true;
    data: { items: DeliveryTeamShipment[]; pagination: InternalPagination };
  }>(`/hader/delivery-team?${query}`);
  return response.data;
}

export async function getDeliveryTeamShipment(id: string) {
  const response = await request<{
    success: true;
    data: { shipment: DeliveryTeamShipment };
  }>(`/hader/delivery-team/${id}`);
  return response.data.shipment;
}

export async function getShipmentPod(shipmentId: string): Promise<ShipmentPod | null> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/hader/shipments/${shipmentId}/pod`, {
      credentials: 'include',
    });
  } catch {
    throw new Error('Unable to connect to the proof of delivery service.');
  }
  if (response.status === 404) return null;
  const result = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { pod?: ShipmentPod };
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.data?.pod) {
    throw new Error(result.error?.message ?? result.message ?? 'Unable to load proof of delivery.');
  }
  return result.data.pod;
}

export async function createShipmentPod(shipmentId: string, payload: CreateShipmentPodPayload) {
  const response = await request<{ success: true; data: { pod: ShipmentPod } }>(
    `/hader/shipments/${shipmentId}/pod`,
    json('POST', payload),
  );
  return response.data.pod;
}

export async function updateShipmentPod(shipmentId: string, payload: CreateShipmentPodPayload) {
  const response = await request<{ success: true; data: { pod: ShipmentPod } }>(
    `/hader/shipments/${shipmentId}/pod`,
    json('PATCH', payload),
  );
  return response.data.pod;
}

export async function uploadShipmentPodDocument(
  shipmentId: string,
  documentType: ShipmentPodDocumentType,
  file: File,
) {
  const response = await request<{
    success: true;
    data: { document: ShipmentPodDocument };
  }>(`/hader/shipments/${shipmentId}/pod/documents/${documentType}`, {
    method: 'PUT',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-file-name': file.name,
    },
    body: file,
  });
  return response.data.document;
}

export async function getShipmentPodDocumentBlob(shipmentId: string, documentId: string) {
  let response: Response;
  try {
    response = await fetch(
      `${apiBaseUrl}/hader/shipments/${shipmentId}/pod/documents/${documentId}`,
      { credentials: 'include' },
    );
  } catch {
    throw new Error('Unable to connect to the proof of delivery service.');
  }
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: { message?: string };
    };
    throw new Error(result.error?.message ?? result.message ?? 'Unable to open POD document.');
  }
  return response.blob();
}

async function deliveryTeamAction(id: string, action: string) {
  const response = await request<{
    success: true;
    data: { shipment: DeliveryTeamShipment };
  }>(`/hader/shipments/${id}/${action}`, { method: 'POST' });
  return response.data.shipment;
}

export const startShipmentDelivery = (id: string) => deliveryTeamAction(id, 'start-delivery');
export const markShipmentDelivered = (id: string) => deliveryTeamAction(id, 'deliver');
export const closeDeliveryShipment = (id: string) => deliveryTeamAction(id, 'close');
export interface LoadingBoardItem {
  id: string;
  shipmentNumber: string;
  orderNumber: string;
  customer: string;
  product: { id: string; code: string; name: string; packaging: string };
  quantityTon: number;
  truck: string | null;
  driver: string | null;
  loadingStatus: 'WAITING' | 'NOTIFIED' | 'AT_GATE' | 'LOADING' | 'LOADED';
  queuePosition: number | null;
  loadingPoint: { id: string; name: string | null; type: string | null } | null;
  notifiedAt: string | null;
  arrivedAt: string | null;
  atGateAt: string | null;
  loadingStartedAt: string | null;
  loadingCompletedAt: string | null;
}
export type LoadingDetail = DispatchShipment & {
  loading: LoadingBoardItem;
  compatibleLoadingPoints: {
    id: string;
    code: string;
    name: string;
    type: string;
    capacityTon: number | null;
    capacityTonPerHour: number | null;
    maxTrucks: number;
    status: string;
  }[];
};
export async function listLoadingControl(page: number, status = '', productId = '') {
  const q = new URLSearchParams({ page: String(page) });
  if (status) q.set('status', status);
  if (productId) q.set('productId', productId);
  const r = await request<{
    success: true;
    data: {
      items: LoadingBoardItem[];
      counters: {
        waiting: number;
        notified: number;
        atGate: number;
        loading: number;
        completed: number;
      };
      products: { id: string; code: string; name: string }[];
      pagination: InternalPagination;
    };
  }>(`/hader/loading-control?${q}`);
  return r.data;
}
export async function getLoadingShipment(id: string) {
  const r = await request<{ success: true; data: { shipment: LoadingDetail } }>(
    `/hader/loading-control/${id}`,
  );
  return r.data.shipment;
}
async function loadingAction(id: string, action: string, body?: unknown) {
  const r = await request<{ success: true; data: { shipment: LoadingDetail } }>(
    `/hader/shipments/${id}/${action}`,
    body === undefined ? { method: 'POST' } : json('POST', body),
  );
  return r.data.shipment;
}
export const notifyLoadingDriver = (id: string, remind = false) =>
  loadingAction(id, 'notify', { remind });
export const recordLoadingArrival = (id: string, stage: 'PARKING' | 'GATE') =>
  loadingAction(id, 'arrival', { stage });
export const assignLoadingPoint = (id: string, loadingPointId: string) =>
  loadingAction(id, 'loading-point', { loadingPointId });
export const startShipmentLoading = (id: string) => loadingAction(id, 'start-loading');
export const completeShipmentLoading = (id: string) => loadingAction(id, 'complete-loading');
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
