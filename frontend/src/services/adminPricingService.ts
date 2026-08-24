const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface PricingProduct {
  id: string;
  productCode: string;
  productName: string;
  packagingType: string;
  uom: string;
  image: string | null;
}

export interface PricingCity {
  id: string;
  name: string;
  isHaderEnabled: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface ProductListPrice {
  id: string;
  productId: string;
  cityId: string;
  packagingType: string;
  city: string;
  uom: string;
  listPrice: number;
  configuredBy: string;
  updatedAt: string;
}

export interface HaderDeliveryPrice {
  id: string;
  cityId: string;
  city: string;
  uom: string;
  deliveryPrice: number;
  standardDeliveryPrice: number;
  whiteCementDeliveryPrice: number;
  configuredBy: string;
  updatedAt: string;
}

export interface PricingConfiguration {
  cities: PricingCity[];
  haderCities: PricingCity[];
  products: PricingProduct[];
  productPrices: ProductListPrice[];
  deliveryPrices: HaderDeliveryPrice[];
}

interface ApiErrorBody {
  message?: string;
  error?: { message?: string; code?: string };
}

export class AdminPricingApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AdminPricingApiError';
  }
}

export async function getPricingConfiguration() {
  const response = await request<{ success: boolean; data: PricingConfiguration }>(
    '/admin/product-prices',
  );
  return response.data;
}

export async function saveProductListPrice(
  productId: string,
  input: { cityId: string; listPrice: number },
) {
  const response = await request<{ success: boolean; data: { price: ProductListPrice } }>(
    `/admin/product-prices/products/${encodeURIComponent(productId)}`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
  return response.data.price;
}

export async function saveHaderDeliveryPrice(input: {
  cityId: string;
  standardDeliveryPrice: number;
  whiteCementDeliveryPrice: number;
}) {
  const response = await request<{ success: boolean; data: { price: HaderDeliveryPrice } }>(
    '/admin/product-prices/delivery',
    { method: 'PUT', body: JSON.stringify(input) },
  );
  return response.data.price;
}

export async function setHaderCity(cityId: string, isHaderEnabled: boolean) {
  const response = await request<{ success: boolean; data: { city: PricingCity } }>(
    `/admin/product-prices/cities/${encodeURIComponent(cityId)}/hader`,
    { method: 'PUT', body: JSON.stringify({ isHaderEnabled }) },
  );
  return response.data.city;
}

async function request<T>(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: { ...(options.body ? { 'content-type': 'application/json' } : {}) },
    });
  } catch {
    throw new AdminPricingApiError('Unable to connect to the pricing service.');
  }
  const data = (await response.json().catch(() => ({}))) as ApiErrorBody & T;
  if (!response.ok) {
    throw new AdminPricingApiError(
      data.error?.message ?? data.message ?? 'Unable to update pricing.',
      response.status,
    );
  }
  return data;
}
