const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type ProductStatus = 'Active' | 'Inactive';
export interface AdminProduct {
  id: string;
  productCode: string;
  productName: string;
  description: string | null;
  shortDescription: string | null;
  image: string | null;
  packaging: string;
  uom: string;
  productType: string;
  displayOrder: number;
  isActive: boolean;
  unitWeightKg: number;
  isWhiteCement: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  priceSummary: {
    cityCount: number;
    minListPrice: number | null;
    prices: Array<{ city: string; listPrice: number }>;
  };
}
export interface ProductPrice {
  id: string;
  cityId: string;
  city: string;
  listPrice: number;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}
export interface ProductCity { id: string; name: string }
export interface ProductBagSize { id: string; unitWeightKg: number; label: string }
export interface ProductDetail { product: AdminProduct; prices: ProductPrice[]; cities: ProductCity[] }
export interface ProductFilter {
  field: 'productCode' | 'productName' | 'packaging' | 'uom' | 'status' | 'unitWeightKg' | 'updatedAt';
  condition: string;
  value: string | number | Array<string | number>;
  join: 'AND' | 'OR';
}
export interface ProductInput {
  productCode?: string;
  productName: string;
  description?: string | null;
  shortDescription?: string | null;
  image?: string | null;
  productType: string;
  packaging: string;
  uom: string;
  unitWeightKg: number;
  isWhiteCement?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}

export class AdminProductsApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

export async function listAdminProducts(input: {
  page: number;
  pageSize: number;
  search?: string | undefined;
  filters?: ProductFilter[] | undefined;
}) {
  const params = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize) });
  if (input.search) params.set('search', input.search);
  if (input.filters?.length) params.set('filters', JSON.stringify(input.filters));
  return request<{ success: boolean; data: { products: AdminProduct[]; pagination: { page: number; pageSize: number; total: number } } }>(`/admin/products?${params}`).then((result) => result.data);
}
export async function getAdminProduct(id: string) { return request<{ success: boolean; data: ProductDetail }>(`/admin/products/${encodeURIComponent(id)}`).then((result) => result.data); }
export async function createAdminProduct(input: ProductInput) { return request<{ success: boolean; data: { product: AdminProduct } }>('/admin/products', { method: 'POST', body: JSON.stringify(input) }).then((result) => result.data.product); }
export async function updateAdminProduct(id: string, input: Partial<ProductInput>) { return request<{ success: boolean; data: { product: AdminProduct } }>(`/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }).then((result) => result.data.product); }
export async function bulkAdminProducts(ids: string[], action: 'ACTIVATE' | 'DEACTIVATE' | 'DELETE') { return request('/admin/products/bulk-action', { method: 'POST', body: JSON.stringify({ ids, action }) }); }
export async function saveAdminProductPrice(productId: string, cityId: string, listPrice: number) { return request(`/admin/product-prices/products/${encodeURIComponent(productId)}`, { method: 'PUT', body: JSON.stringify({ cityId, listPrice }) }); }
export async function listAdminBagSizes(search: string, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  return request<{ success: boolean; data: { bagSizes: ProductBagSize[] } }>(
    `/admin/product-options/bag-sizes?${params}`,
    signal ? { signal } : {},
  ).then((result) => result.data.bagSizes);
}
export async function createAdminBagSize(unitWeightKg: number) {
  return request<{ success: boolean; data: { bagSize: ProductBagSize } }>(
    '/admin/product-options/bag-sizes',
    { method: 'POST', body: JSON.stringify({ unitWeightKg }) },
  ).then((result) => result.data.bagSize);
}

async function request<T = unknown>(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...options, credentials: 'include', headers: { ...(options.body ? { 'content-type': 'application/json' } : {}) } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AdminProductsApiError('Unable to connect to the product service.');
  }
  const body = await response.json().catch(() => ({})) as { message?: string; error?: { message?: string } } & T;
  if (!response.ok) throw new AdminProductsApiError(body.error?.message ?? body.message ?? 'Unable to complete the product request.', response.status);
  return body;
}
