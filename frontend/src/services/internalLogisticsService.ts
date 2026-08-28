const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
export type LogisticsKind = 'transporters' | 'transporter-costs' | 'fleet' | 'drivers';
export interface Page<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
export interface Transporter {
  id: string;
  transporterNumber: string;
  name: string;
  companyName: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  crNumber: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string;
}
export interface TransporterCost {
  id: string;
  transporterId: string;
  transporterNumber?: string;
  companyName?: string;
  haderCityId: string;
  haderCityName?: string;
  cementType: 'STANDARD_CEMENT' | 'WHITE_CEMENT';
  costPerTon: number;
  createdBy?: string;
  updatedBy?: string;
  updatedAt: string;
}
export interface HaderTruck {
  id: string;
  truckNumber: string;
  plateNumber: string;
  vehicleType: string;
  capacityTon: number;
  modelYear: number | null;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'INACTIVE';
  updatedAt: string;
}
export interface HaderDriver {
  id: string;
  driverNumber: string;
  name: string;
  mobile: string;
  licenseNumber: string;
  licenseExpiry: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string;
}
export interface LogisticsReferences {
  transporters: { id: string; transporter_number: string; company_name: string }[];
  cities: { id: string; name: string }[];
  drivers: { id: string; driver_number: string; name: string }[];
}
export type LogisticsRecord = Transporter | TransporterCost | HaderTruck | HaderDriver;

export async function listLogistics<T>(
  kind: LogisticsKind,
  page: number,
  search: string,
  status?: string,
) {
  const q = new URLSearchParams({ page: String(page) });
  if (search) q.set('search', search);
  if (status) q.set('status', status);
  const data = await request<{ success: true; data: Record<string, Page<T>> }>(
    `/admin/${kind}?${q}`,
  );
  const key = kind === 'transporter-costs' ? 'costs' : kind === 'fleet' ? 'trucks' : kind;
  return data.data[key] as Page<T>;
}
export async function createLogistics<T>(kind: LogisticsKind, payload: unknown) {
  const data = await request<{ success: true; data: Record<string, T> }>(`/admin/${kind}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return Object.values(data.data)[0] as T;
}
export async function updateLogistics<T>(kind: LogisticsKind, id: string, payload: unknown) {
  const data = await request<{ success: true; data: Record<string, T> }>(
    `/admin/${kind}/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return Object.values(data.data)[0] as T;
}
export async function getLogisticsReferences() {
  return (await request<{ success: true; data: LogisticsReferences }>('/admin/logistics-reference'))
    .data;
}
export async function uploadLogisticsDocument(
  entityType: 'transporter' | 'truck' | 'driver',
  id: string,
  documentType: string,
  file: File,
) {
  return request(`/admin/${entityType}/${id}/documents/${documentType}`, {
    method: 'PUT',
    headers: { 'content-type': file.type || 'application/octet-stream', 'x-file-name': file.name },
    body: file,
  });
}

export class LogisticsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'LogisticsApiError';
  }
}
async function request<T>(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body && typeof options.body === 'string'
          ? { 'content-type': 'application/json' }
          : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new LogisticsApiError('Unable to connect to the logistics service.');
  }
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new LogisticsApiError(
      data.error?.message ?? data.message ?? 'Unable to complete the request.',
      response.status,
    );
  return data as T;
}
