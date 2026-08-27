import type { CustomerOrder, OrderStatus } from './customerOrdersService';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface SalesOrder extends CustomerOrder {
  customer: { id: string; companyName: string | null };
  shipmentSummary: { count: number; latestStatus: string | null };
}

export async function listSalesOrders(
  params: {
    page?: number;
    search?: string;
    status?: OrderStatus | '';
  } = {},
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const response = await request<{
    success: boolean;
    data: {
      items: SalesOrder[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };
  }>(`/sales/orders${query.size ? `?${query}` : ''}`);
  return response.data;
}

async function request<T>(path: string) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include' });
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message ?? data.message ?? 'Order request failed.');
  return data;
}
