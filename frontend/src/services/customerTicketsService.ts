const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type CustomerTicketStatus = 'DRAFT' | 'SUBMITTED' | 'OPEN' | 'CLOSED';
export type CrmHandoffStatus = 'NOT_SENT' | 'SENT';

export interface CustomerTicket {
  id: string;
  ticketNumber: string;
  customer: {
    accountId: string;
    companyName: string | null;
  };
  customerUser: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
  };
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  };
  description: string;
  status: CustomerTicketStatus;
  crmHandoffStatus: CrmHandoffStatus;
  crmResponse: string | null;
  crmResolvedAt: string | null;
  sales: {
    sentAt: string | null;
    userId: string;
    userName: string | null;
  } | null;
  events?: CustomerTicketEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTicketEvent {
  id: string;
  type: 'TICKET_CREATED' | 'TICKET_SUBMITTED' | 'TICKET_SENT_TO_CRM' | 'TICKET_CLOSED';
  previousStatus: CustomerTicketStatus | null;
  newStatus: CustomerTicketStatus | null;
  actor: {
    kind: 'CUSTOMER' | 'SALES';
    id: string;
    name: string | null;
    role: string | null;
  } | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface CustomerTicketListResult {
  items: CustomerTicket[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerTicketFilterRule {
  field:
    | 'ticketNumber'
    | 'customer'
    | 'description'
    | 'status'
    | 'crmHandoff'
    | 'createdDate'
    | 'updatedDate'
    | 'createdBy';
  condition: 'equals' | 'contains' | 'before' | 'after' | 'between';
  value: string;
  valueTo?: string;
}

export interface SalesTicketFilterRule {
  field: 'ticketNumber' | 'customer' | 'description' | 'status' | 'crmHandoff' | 'createdDate';
  condition: 'equals' | 'contains' | 'before' | 'after';
  value: string;
}

export class CustomerTicketsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerTicketsApiError';
  }
}

export async function listCustomerTickets(
  params: { page?: number; filters?: CustomerTicketFilterRule[] } = {},
) {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.filters?.length) query.set('filters', JSON.stringify(params.filters));
  const response = await request<{ success: boolean; data: CustomerTicketListResult }>(
    `/customer/tickets${query.size ? `?${query}` : ''}`,
  );
  return parseTicketListResult(response.data);
}

export async function createCustomerTicket(payload: { description: string }) {
  const response = await request<{ success: boolean; data: { ticket: CustomerTicket } }>(
    '/customer/tickets',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return response.data.ticket;
}

export async function updateCustomerTicketDraft(id: string, payload: { description: string }) {
  const response = await request<{ success: boolean; data: { ticket: CustomerTicket } }>(
    `/customer/tickets/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
  return response.data.ticket;
}

export async function getCustomerTicket(id: string) {
  const response = await request<{ success: boolean; data: { ticket: CustomerTicket } }>(
    `/customer/tickets/${encodeURIComponent(id)}`,
  );
  return response.data.ticket;
}

export async function submitCustomerTicket(id: string) {
  const response = await request<{ success: boolean; data: { ticket: CustomerTicket } }>(
    `/customer/tickets/${encodeURIComponent(id)}/submit`,
    { method: 'POST' },
  );
  return response.data.ticket;
}

export async function deleteCustomerTicket(id: string) {
  await request<void>(`/customer/tickets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listSalesTickets(
  params: { page?: number; filters?: SalesTicketFilterRule[] } = {},
) {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.filters?.length) query.set('filters', JSON.stringify(params.filters));
  const response = await request<{ success: boolean; data: CustomerTicketListResult }>(
    `/sales/tickets${query.size ? `?${query}` : ''}`,
  );
  return parseTicketListResult(response.data);
}

export async function getSalesTicket(id: string) {
  const response = await request<{ success: boolean; data: { ticket: CustomerTicket } }>(
    `/sales/tickets/${encodeURIComponent(id)}`,
  );
  return response.data.ticket;
}

export async function sendSalesTicketToCrm(id: string) {
  const response = await request<{ success: boolean; data: { ticket: CustomerTicket } }>(
    `/sales/tickets/${encodeURIComponent(id)}/send-to-crm`,
    { method: 'POST' },
  );
  return response.data.ticket;
}

async function request<T>(path: string, options: RequestInit = {}) {
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
    throw new CustomerTicketsApiError('Unable to connect to the service request system.');
  }

  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new CustomerTicketsApiError(
      data.error?.message ?? data.message ?? 'Service request failed.',
    );
  }

  return data;
}

function parseTicketListResult(value: unknown): CustomerTicketListResult {
  if (!isTicketListResult(value)) {
    throw new CustomerTicketsApiError('Unable to load service requests.');
  }

  return value;
}

function isTicketListResult(value: unknown): value is CustomerTicketListResult {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.pagination)) {
    return false;
  }

  const { page, pageSize, total, totalPages } = value.pagination;
  return (
    typeof page === 'number' &&
    Number.isFinite(page) &&
    typeof pageSize === 'number' &&
    Number.isFinite(pageSize) &&
    typeof total === 'number' &&
    Number.isFinite(total) &&
    typeof totalPages === 'number' &&
    Number.isFinite(totalPages)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
