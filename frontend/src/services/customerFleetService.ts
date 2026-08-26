const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type FleetStatus = 'ACTIVE' | 'INACTIVE';
export interface FleetAttachment {
  id: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}
export interface CustomerTruck {
  id: string;
  truckNumber: string;
  plateNumber: string;
  vehicleType: string;
  capacityTon: number;
  carrierName: string | null;
  status: FleetStatus;
  attachments: FleetAttachment[];
  createdAt: string;
  updatedAt: string;
}
export interface CustomerDriver {
  id: string;
  driverNumber: string;
  name: string;
  mobile: string;
  licenseNumber: string;
  licenseExpiry: string | null;
  status: FleetStatus;
  attachments: FleetAttachment[];
  createdAt: string;
  updatedAt: string;
}
export interface FleetPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface TruckPayload {
  plateNumber: string;
  vehicleType: string;
  capacityTon: number;
  carrierName?: string;
  status: FleetStatus;
}
export interface DriverPayload {
  name: string;
  mobile: string;
  licenseNumber: string;
  licenseExpiry?: string;
  status: FleetStatus;
}

export async function getCustomerTrucks(page = 1, search = '', status = '') {
  const query = new URLSearchParams({ page: String(page) });
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  const response = await fleetRequest<{
    success: true;
    data: { trucks: CustomerTruck[]; pagination: FleetPagination };
  }>(`/customer/trucks?${query}`);
  return response.data;
}
export async function createCustomerTruck(payload: TruckPayload) {
  const response = await fleetRequest<{ success: true; data: { truck: CustomerTruck } }>(
    '/customer/trucks',
    jsonOptions('POST', payload),
  );
  return response.data.truck;
}
export async function updateCustomerTruck(id: string, payload: Partial<TruckPayload>) {
  const response = await fleetRequest<{ success: true; data: { truck: CustomerTruck } }>(
    `/customer/trucks/${id}`,
    jsonOptions('PATCH', payload),
  );
  return response.data.truck;
}
export async function getCustomerDrivers(page = 1, search = '', status = '') {
  const query = new URLSearchParams({ page: String(page) });
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  const response = await fleetRequest<{
    success: true;
    data: { drivers: CustomerDriver[]; pagination: FleetPagination };
  }>(`/customer/drivers?${query}`);
  return response.data;
}
export async function createCustomerDriver(payload: DriverPayload) {
  const response = await fleetRequest<{ success: true; data: { driver: CustomerDriver } }>(
    '/customer/drivers',
    jsonOptions('POST', payload),
  );
  return response.data.driver;
}
export async function updateCustomerDriver(id: string, payload: Partial<DriverPayload>) {
  const response = await fleetRequest<{ success: true; data: { driver: CustomerDriver } }>(
    `/customer/drivers/${id}`,
    jsonOptions('PATCH', payload),
  );
  return response.data.driver;
}
export async function uploadFleetDocument(
  entity: 'trucks' | 'drivers',
  entityId: string,
  documentType: string,
  file: File,
) {
  const response = await fleetRequest<{ success: true; data: { attachment: FleetAttachment } }>(
    `/customer/${entity}/${entityId}/documents/${documentType}`,
    {
      method: 'PUT',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'x-file-name': file.name,
      },
      body: file,
    },
  );
  return response.data.attachment;
}
export function getFleetDocumentUrl(
  entity: 'trucks' | 'drivers',
  entityId: string,
  attachmentId: string,
) {
  return `${apiBaseUrl}/customer/${entity}/${entityId}/documents/${attachmentId}`;
}

function jsonOptions(method: string, payload: unknown): RequestInit {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
}
async function fleetRequest<T>(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...options, credentials: 'include' });
  } catch {
    throw new Error('Unable to connect to the fleet service.');
  }
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message ?? data.message ?? 'Fleet request failed.');
  return data;
}
