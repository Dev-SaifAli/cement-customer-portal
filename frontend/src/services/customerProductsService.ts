const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface CustomerProduct {
  id: string;
  productCode: string;
  productName: string;
  description: string | null;
  shortDescription: string | null;
  image: string | null;
  packagingType: string;
  uom: string;
  category: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  priceDisplay: 'PRICE_ON_REQUEST';
}

export interface CustomerProductsQuery {
  page?: number;
  search?: string;
  category?: string;
  packagingType?: string;
  uom?: string;
}

export interface CustomerProductsResult {
  items: CustomerProduct[];
  pagination: {
    page: number;
    pageSize: 10;
    total: number;
    totalPages: number;
  };
}

interface CustomerProductsResponse {
  success: boolean;
  data: CustomerProductsResult;
}

interface CustomerProductResponse {
  success: boolean;
  data: {
    product: CustomerProduct;
  };
}

interface ApiErrorBody {
  error?: {
    message?: string;
  };
  message?: string;
}

export class CustomerProductsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerProductsApiError';
  }
}

export const getCustomerProducts = async (query: CustomerProductsQuery = {}) => {
  const searchParams = new URLSearchParams();

  if (query.page && query.page > 1) searchParams.set('page', String(query.page));
  appendFilter(searchParams, 'search', query.search);
  appendFilter(searchParams, 'category', query.category);
  appendFilter(searchParams, 'packagingType', query.packagingType);
  appendFilter(searchParams, 'uom', query.uom);

  const path = `/customer/products${searchParams.size ? `?${searchParams.toString()}` : ''}`;
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: 'include',
    });
  } catch {
    throw new CustomerProductsApiError('Unable to connect to the product catalog service.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody & CustomerProductsResponse;

  if (!response.ok) {
    throw new CustomerProductsApiError(
      data.error?.message ?? data.message ?? 'Unable to load product catalog.',
    );
  }

  return data.data;
};

export const getCustomerProduct = async (id: string) => {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/customer/products/${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
  } catch {
    throw new CustomerProductsApiError('Unable to connect to the product catalog service.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody & CustomerProductResponse;

  if (!response.ok) {
    throw new CustomerProductsApiError(
      data.error?.message ?? data.message ?? 'Unable to load product details.',
    );
  }

  return data.data.product;
};

function appendFilter(searchParams: URLSearchParams, key: string, value?: string) {
  const trimmedValue = value?.trim();
  if (trimmedValue) searchParams.set(key, trimmedValue);
}
