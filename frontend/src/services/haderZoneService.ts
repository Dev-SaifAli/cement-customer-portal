const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface HaderBoundaryCity {
  id: string;
  name: string;
  isHaderEnabled: boolean;
  isActive: boolean;
  boundary: GeoJsonPolygon | null;
  boundaryStatus: 'CONFIGURED' | 'NOT_CONFIGURED';
  boundaryUpdatedAt: string | null;
  boundaryUpdatedBy: string | null;
}

export async function listHaderBoundaryCities() {
  const response = await request<{ success: boolean; data: { cities: HaderBoundaryCity[] } }>(
    '/admin/hader-cities',
  );
  return response.data.cities;
}

export async function saveHaderBoundary(cityId: string, boundary: GeoJsonPolygon) {
  const response = await request<{ success: boolean; data: { city: HaderBoundaryCity } }>(
    `/admin/hader-cities/${encodeURIComponent(cityId)}/boundary`,
    { method: 'PUT', body: JSON.stringify({ boundary }) },
  );
  return response.data.city;
}

export async function clearHaderBoundary(cityId: string) {
  const response = await request<{ success: boolean; data: { city: HaderBoundaryCity } }>(
    `/admin/hader-cities/${encodeURIComponent(cityId)}/boundary`,
    { method: 'DELETE' },
  );
  return response.data.city;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    ...(options.body ? { headers: { 'content-type': 'application/json' } } : {}),
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(body.error?.message ?? body.message ?? 'Request failed.');
  return body;
}
