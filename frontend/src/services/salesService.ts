const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type SalesApplicationStatus =
  | 'DRAFT'
  | 'PENDING_SALES_REVIEW'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'ACTIVATED';

export interface SalesUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

export interface SalesApplicationSummary {
  id: string;
  reference: string | null;
  status: SalesApplicationStatus;
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesApplicationDetails {
  id: string;
  reference: string | null;
  status: SalesApplicationStatus;
  currentStep: number;
  company: Record<string, unknown>;
  contact: Record<string, unknown>;
  documents: Record<string, unknown>;
  deliveryLocations: Array<Record<string, unknown>>;
  administrator: Record<string, unknown>;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  statusHistory: SalesStatusHistoryItem[];
}

export interface SalesStatusHistoryItem {
  id: string;
  previousStatus: SalesApplicationStatus | null;
  newStatus: SalesApplicationStatus;
  reason: string | null;
  changedBy: string;
  createdAt: string;
}

export interface SalesApplicationsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SalesApplicationsList {
  items: SalesApplicationSummary[];
  pagination: SalesApplicationsPagination;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

export class SalesApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'SalesApiError';
  }
}

const requestSales = async <TResponse>(path: string, options: RequestInit = {}) => {
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
    throw new SalesApiError('Unable to connect to the Sales service.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody & TResponse;

  if (!response.ok) {
    throw new SalesApiError(
      data.error?.message ?? data.message ?? 'Sales request failed.',
      response.status,
      data.error?.code,
    );
  }

  return data as TResponse;
};

export const salesLogin = async (payload: { email: string; password: string }) => {
  const response = await requestSales<{ success: boolean; data: { user: SalesUser } }>(
    '/sales/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  return response.data.user;
};

export const getSalesMe = async () => {
  const response = await requestSales<{ success: boolean; data: { user: SalesUser } }>(
    '/sales/auth/me',
  );

  return response.data.user;
};

export const salesLogout = async () => {
  await requestSales<{ success: boolean; message: string }>('/sales/auth/logout', {
    method: 'POST',
  });
};

export const listSalesApplications = async (params: {
  search?: string;
  status?: SalesApplicationStatus | '';
  page?: number;
  pageSize?: number;
}) => {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.status) searchParams.set('status', params.status);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));

  const response = await requestSales<{ success: boolean; data: SalesApplicationsList }>(
    `/sales/applications${searchParams.size ? `?${searchParams.toString()}` : ''}`,
  );

  return response.data;
};

export const getSalesApplication = async (id: string) => {
  const response = await requestSales<{
    success: boolean;
    data: { application: SalesApplicationDetails };
  }>(`/sales/applications/${id}`);

  return response.data.application;
};

export const updateSalesApplicationStatus = async (
  id: string,
  payload: {
    status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
    reason?: string;
  },
) => {
  const response = await requestSales<{
    success: boolean;
    data: {
      statusChanged: boolean;
      message?: string;
      application: SalesApplicationDetails;
    };
  }>(`/sales/applications/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const getSalesApplicationDocumentUrl = (
  applicationId: string,
  documentId: string,
  options: { download?: boolean } = {},
) =>
  `${apiBaseUrl}/sales/applications/${applicationId}/documents/${documentId}${
    options.download ? '?download=1' : ''
  }`;
