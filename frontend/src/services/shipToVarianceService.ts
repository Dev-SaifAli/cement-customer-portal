const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type ShipToVarianceStatus =
  | 'NO_VARIANCE'
  | 'VARIANCE_DETECTED'
  | 'PRICING_NOT_CONFIGURED';

export interface ShipToVariance {
  id: string;
  shipment: { id: string; number: string; status: string };
  order: { id: string; number: string };
  customer: { companyName: string };
  product: { id: string; code: string; name: string; packaging: string };
  quantityTon: number;
  orderedCity: { id: string; name: string };
  actualCity: { id: string; name: string };
  orderedPricePerTon: number;
  actualPricePerTon: number | null;
  differencePerTon: number | null;
  extraCharge: number | null;
  status: ShipToVarianceStatus;
  lastUpdated: string;
  decision?: ShipToVarianceDecision | null;
}

export type ShipToVarianceDecisionStatus =
  | 'DISMISSED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export interface ShipToVarianceDecision {
  id: string;
  shipment: { id: string; number: string };
  order: { id: string; number: string };
  customer: { companyName: string };
  product: { id: string; code: string; name: string };
  quantityTon: number;
  orderedCity: { id: string; name: string };
  actualCity: { id: string; name: string };
  orderedPricePerTon: number;
  actualPricePerTon: number;
  differencePerTon: number;
  extraCharge: number;
  status: ShipToVarianceDecisionStatus;
  raisedOrDismissedBy: string;
  decidedBy: string | null;
  rejectionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listShipToVariances(params: {
  page: number;
  search?: string;
  status?: Exclude<ShipToVarianceStatus, 'NO_VARIANCE'> | '';
}) {
  const query = new URLSearchParams({ page: String(params.page) });
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  const response = await request<{
    success: boolean;
    data: {
      items: ShipToVariance[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };
  }>(`/price-manager/ship-to-variances?${query}`);
  return response.data;
}

export async function getShipToVariance(shipmentId: string) {
  const response = await request<{
    success: boolean;
    data?: { variance?: ShipToVariance };
  }>(`/price-manager/ship-to-variances/${encodeURIComponent(shipmentId)}`);

  const variance = response.data?.variance;
  if (!variance) {
    throw new Error('Unable to load ship-to variance.');
  }

  return variance;
}

export async function dismissShipToVariance(shipmentId: string) {
  return varianceDecisionRequest(
    `/price-manager/ship-to-variances/${encodeURIComponent(shipmentId)}/dismiss`,
  );
}

export async function raiseShipToVarianceCharge(shipmentId: string) {
  return varianceDecisionRequest(
    `/price-manager/ship-to-variances/${encodeURIComponent(shipmentId)}/raise-charge`,
  );
}

export async function listShipToVarianceChargeApprovals(page: number) {
  const response = await request<{
    success: boolean;
    data: {
      items: ShipToVarianceDecision[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };
  }>(`/commercial-director/ship-to-variance-charges?page=${page}`);
  return response.data;
}

export async function getShipToVarianceChargeApproval(id: string) {
  const response = await request<{ success: boolean; data: { decision: ShipToVarianceDecision } }>(
    `/commercial-director/ship-to-variance-charges/${encodeURIComponent(id)}`,
  );
  return response.data.decision;
}

export async function approveShipToVarianceCharge(id: string) {
  return commercialDecisionRequest(id, 'approve');
}

export async function rejectShipToVarianceCharge(id: string, reason: string) {
  return commercialDecisionRequest(id, 'reject', { reason });
}

async function varianceDecisionRequest(path: string) {
  const response = await request<{ success: boolean; data: { decision: ShipToVarianceDecision } }>(
    path,
    { method: 'POST' },
  );
  return response.data.decision;
}

async function commercialDecisionRequest(id: string, action: 'approve' | 'reject', body?: object) {
  const response = await request<{ success: boolean; data: { decision: ShipToVarianceDecision } }>(
    `/commercial-director/ship-to-variance-charges/${encodeURIComponent(id)}/${action}`,
    { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) },
  );
  return response.data.decision;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}) },
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(data.error?.message ?? data.message ?? 'Ship-to variance request failed.');
  }
  return data;
}
