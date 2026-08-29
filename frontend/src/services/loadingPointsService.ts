const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type LoadingPointType = 'SILO' | 'BAGGING_LINE';
export type LoadingPointStatus = 'AVAILABLE' | 'BUSY' | 'FULL' | 'INACTIVE';

export interface LoadingPointProduct {
  id: string;
  code: string;
  name: string;
  packagingType: string;
  compatiblePointType?: LoadingPointType;
}

export interface LoadingPoint {
  id: string;
  pointNumber: string;
  pointType: LoadingPointType;
  product: LoadingPointProduct | null;
  capacityTon: number;
  capacityTonPerHour: number | null;
  maxTrucks: number;
  status: LoadingPointStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LoadingPointInput {
  pointNumber: string;
  pointType: LoadingPointType;
  productId: string;
  capacityTon?: number;
  capacityTonPerHour?: number;
  maxTrucks?: number;
  status: LoadingPointStatus;
}

export async function listLoadingPoints(query: {
  page: number;
  search?: string;
  pointType: LoadingPointType;
  status?: LoadingPointStatus | '';
}) {
  const params = new URLSearchParams({ page: String(query.page), pointType: query.pointType });
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  return (
    await request<{
      success: true;
      data: {
        items: LoadingPoint[];
        products: LoadingPointProduct[];
        pagination: { page: number; pageSize: number; total: number; totalPages: number };
      };
    }>(`/admin/loading-points?${params}`)
  ).data;
}

export async function createLoadingPoint(input: LoadingPointInput) {
  return (
    await request<{ success: true; data: { loadingPoint: LoadingPoint } }>(
      '/admin/loading-points',
      { method: 'POST', body: JSON.stringify(input) },
    )
  ).data.loadingPoint;
}

export async function updateLoadingPoint(id: string, input: Partial<LoadingPointInput>) {
  return (
    await request<{ success: true; data: { loadingPoint: LoadingPoint } }>(
      `/admin/loading-points/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    )
  ).data.loadingPoint;
}

async function request<T>(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    });
  } catch {
    throw new Error('Unable to connect to the loading-point service.');
  }
  const body = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(body.error?.message ?? body.message ?? 'Unable to complete the request.');
  }
  return body as T;
}
