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
  role: 'SALES_REP' | 'HADER_MANAGER' | 'PRICE_MANAGER' | 'PRICING_ADMIN';
}

export type SalesQuotationStatus =
  | 'PENDING_SALES_REVIEW'
  | 'UNDER_REVIEW'
  | 'PENDING_HADER_APPROVAL'
  | 'PENDING_PRICE_APPROVAL'
  | 'READY_FOR_CUSTOMER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CLARIFICATION_REQUESTED';

export type SalesQuotationApprovalStatus =
  'NOT_REQUIRED' | 'REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SalesQuotationSummary {
  id: string;
  reference: string | null;
  customer: string;
  submittedAt: string | null;
  itemCount: number;
  fulfilmentType: 'PICKUP' | 'DELIVERY';
  total: number | null;
  status: SalesQuotationStatus;
}

export interface SalesQuotationDetails {
  id: string;
  reference: string | null;
  status: SalesQuotationStatus;
  customer: {
    id: string;
    companyName: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
  };
  submittedBy: string | null;
  requestedDate: string | null;
  fulfilmentType: 'PICKUP' | 'DELIVERY';
  pricingCity: { id: string; name: string | null } | null;
  destination: {
    id?: string;
    name?: string;
    city?: string;
    region?: string;
    streetAddress?: string;
    postalCode?: string;
    country?: string;
  } | null;
  notes: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  validUntil: string | null;
  paymentTerms: string | null;
  commercialNotes: string | null;
  subtotal: number | null;
  vatRate: number;
  vatAmount: number | null;
  grandTotal: number | null;
  productPriceChanged: boolean;
  deliveryPriceChanged: boolean;
  approvals: { hader: SalesQuotationApprovalStatus; price: SalesQuotationApprovalStatus };
  items: Array<{
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    image: string | null;
    unitWeightKg: number;
    equivalentTons: number;
    quantity: number;
    uom: string;
    packagingType: string;
    productListPrice: number | null;
    productPrice: number | null;
    discountMode: 'PERCENT' | 'SAR_PER_TON' | null;
    discountValue: number | null;
    discountAmountPerTon: number | null;
    deliveryListPrice: number | null;
    deliveryPrice: number | null;
    customerRate: number | null;
    amount: number | null;
  }>;
  events: Array<{
    id: string;
    previousStatus: SalesQuotationStatus | 'DRAFT' | null;
    newStatus: SalesQuotationStatus;
    action: string;
    reason: string | null;
    changedBy: string;
    actorType: 'SALES' | 'CUSTOMER';
    actorRole: string | null;
    createdAt: string;
  }>;
  contract: {
    id: string;
    reference: string | null;
    status: string | null;
  } | null;
  allowedActions: {
    startReview: boolean;
    editPricing: boolean;
    submitApproval: boolean;
    sendToCustomer: boolean;
    approve: boolean;
    reject: boolean;
    createContract: boolean;
  };
}

export interface SalesContractDetails {
  id: string;
  reference: string | null;
  sourceQuotation: {
    id: string;
    reference: string | null;
    acceptedAt: string | null;
  } | null;
  customerAccountId: string;
  customerCompanyName: string | null;
  status: string;
  productCode?: string | null;
  productName?: string | null;
  packaging?: string;
  uom?: string;
  quantity?: number;
  startDate: string;
  endDate: string;
  fulfilment: 'PICKUP' | 'DELIVERY';
  deliveryCity: string | null;
  totalQuantityTons: number | null;
  shippedQuantityTons?: number;
  remainingQuantityTons?: number;
  customerRate?: number;
  productPrice?: number | null;
  deliveryPrice?: number | null;
  subtotal?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  grandTotal: number | null;
  paymentTerms?: string | null;
  commercialNotes?: string | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
  items?: Array<{
    productCode?: string | null;
    productName?: string | null;
    packagingType?: string | null;
    uom?: string | null;
    quantity?: number | null;
    equivalentTons?: number | null;
    productListPrice?: number | null;
    productPrice?: number | null;
    discountMode?: 'PERCENT' | 'SAR_PER_TON' | null;
    discountValue?: number | null;
    discountAmountPerTon?: number | null;
    deliveryPrice?: number | null;
    customerRate?: number | null;
    amount?: number | null;
  }>;
  statusHistory?: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    action: string;
    reason: string | null;
    changedByName: string | null;
    createdAt: string;
  }>;
  activatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesContractsList {
  items: SalesContractDetails[];
  pagination: SalesApplicationsPagination;
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
  activatedAt: string | null;
  statusHistory: SalesStatusHistoryItem[];
}

export interface SalesStatusHistoryItem {
  id: string;
  previousStatus: SalesApplicationStatus | null;
  newStatus: SalesApplicationStatus;
  reason: string | null;
  changedBy: string;
  changedByName: string | null;
  changedByEmail: string | null;
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

export interface SalesFilterOption {
  value: string;
  label: string;
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
  reference?: string;
  company?: string;
  contact?: string;
  submittedFrom?: string;
  submittedTo?: string;
  status?: SalesApplicationStatus | '';
  page?: number;
  pageSize?: number;
}) => {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.reference) searchParams.set('reference', params.reference);
  if (params.company) searchParams.set('company', params.company);
  if (params.contact) searchParams.set('contact', params.contact);
  if (params.submittedFrom) searchParams.set('submittedFrom', params.submittedFrom);
  if (params.submittedTo) searchParams.set('submittedTo', params.submittedTo);
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

export const getSalesApplicationFilterOptions = async (params: {
  field: 'reference' | 'company' | 'contact' | 'contactEmail' | 'contactPhone' | 'status';
  search?: string;
  limit?: number;
}) => {
  const searchParams = new URLSearchParams({ field: params.field });
  if (params.search) searchParams.set('search', params.search);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const response = await requestSales<{
    success: boolean;
    data: { options: SalesFilterOption[] };
  }>(`/sales/applications/filter-options?${searchParams.toString()}`);

  return response.data.options;
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

export const activateSalesApplication = async (id: string) => {
  const response = await requestSales<{
    success: boolean;
    data: {
      activated: boolean;
      message?: string;
      account: {
        id: string;
        registrationId: string;
        companyName: string;
        status: string;
        activatedAt: string;
      } | null;
      application: SalesApplicationDetails;
    };
  }>(`/sales/applications/${id}/activate`, {
    method: 'POST',
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

export const listSalesQuotations = async (params: {
  page?: number;
  reference?: string;
  customer?: string;
  submittedDate?: string;
  fulfilmentType?: '' | 'PICKUP' | 'DELIVERY';
  status?: '' | SalesQuotationStatus;
}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const response = await requestSales<{
    success: boolean;
    data: {
      items: SalesQuotationSummary[];
      pagination: SalesApplicationsPagination;
    };
  }>(`/sales/quotations${query.size ? `?${query}` : ''}`);
  return response.data;
};

export const getSalesQuotation = async (id: string) => {
  const response = await requestSales<{
    success: boolean;
    data: { quotation: SalesQuotationDetails };
  }>(`/sales/quotations/${id}`);
  return response.data.quotation;
};

const quotationAction = async (id: string, action: string, body?: unknown) => {
  const response = await requestSales<{
    success: boolean;
    data: { quotation: SalesQuotationDetails };
  }>(`/sales/quotations/${id}/${action}`, {
    method: action === 'pricing' ? 'PATCH' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return response.data.quotation;
};

export const startSalesQuotationReview = (id: string) => quotationAction(id, 'start-review');
export const updateSalesQuotationPricing = (
  id: string,
  payload: {
    items: Array<{
      id: string;
      productPrice: number;
      deliveryPrice?: number;
      discountMode?: 'PERCENT' | 'SAR_PER_TON' | null;
      discountValue?: number | null;
    }>;
    validUntil: string;
    paymentTerms: string;
    commercialNotes: string;
  },
) => quotationAction(id, 'pricing', payload);
export const submitSalesQuotationApproval = (id: string) => quotationAction(id, 'submit-approval');
export const approveSalesQuotation = (id: string) => quotationAction(id, 'approve');
export const rejectSalesQuotation = (id: string, reason: string) =>
  quotationAction(id, 'reject', { reason });
export const sendSalesQuotationToCustomer = (id: string) => quotationAction(id, 'send-to-customer');

export const createContractFromSalesQuotation = async (
  id: string,
  payload: {
    startDate: string;
    endDate: string;
    totalQuantityTons: number;
    internalNotes?: string;
  },
) => {
  const response = await requestSales<{
    success: boolean;
    data: { contract: SalesContractDetails };
  }>(`/sales/quotations/${id}/contract`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data.contract;
};

export const listSalesContracts = async (params: {
  page?: number;
  search?: string;
  status?: '' | 'DRAFT' | 'ACTIVE' | 'PENDING_SALES_REVIEW';
}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });

  const response = await requestSales<{ success: boolean; data: SalesContractsList }>(
    `/sales/contracts${query.size ? `?${query}` : ''}`,
  );
  return response.data;
};

export const getSalesContract = async (id: string) => {
  const response = await requestSales<{
    success: boolean;
    data: { contract: SalesContractDetails };
  }>(`/sales/contracts/${id}`);
  return response.data.contract;
};

export const activateSalesContract = async (id: string) => {
  const response = await requestSales<{
    success: boolean;
    data: { contract: SalesContractDetails };
  }>(`/sales/contracts/${id}/activate`, { method: 'POST' });
  return response.data.contract;
};

export const extendSalesContract = async (
  id: string,
  payload: { additionalQuantityTons?: number; endDate?: string; reason?: string },
) => {
  const response = await requestSales<{
    success: boolean;
    data: { contract: SalesContractDetails };
  }>(`/sales/contracts/${id}/extend`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data.contract;
};
