const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type TaxConfigurationStatus = 'ACTIVE' | 'INACTIVE';
export type TaxConfigurationType = 'VAT';
export type VatMode = 'LOCAL' | 'EXPORT';

export interface TaxConfiguration {
  id: string;
  taxName: string;
  taxType: TaxConfigurationType;
  vatMode: VatMode;
  ratePercent: number;
  status: TaxConfigurationStatus;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  appliesTo: readonly ['PRODUCT', 'DELIVERY', 'PALLET'];
}

export interface TaxConfigurationInput {
  vatMode: VatMode;
  ratePercent: number;
}

export class TaxConfigurationRequestError extends Error {
  constructor(message: string, public readonly fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'TaxConfigurationRequestError';
  }
}

export async function listTaxConfigurations() {
  const result = await request<{ success: true; data: { configurations: TaxConfiguration[] } }>(
    '/admin/tax-configurations',
  );
  return result.data.configurations;
}

export async function getTaxConfiguration(id: string) {
  const result = await request<{ success: true; data: { configuration: TaxConfiguration } }>(
    `/admin/tax-configurations/${encodeURIComponent(id)}`,
  );
  return result.data.configuration;
}

export async function createTaxConfiguration(input: TaxConfigurationInput) {
  const result = await request<{ success: true; data: { configuration: TaxConfiguration } }>(
    '/admin/tax-configurations',
    { method: 'POST', body: JSON.stringify(input) },
  );
  return result.data.configuration;
}

export async function updateTaxConfiguration(id: string, input: TaxConfigurationInput) {
  const result = await request<{ success: true; data: { configuration: TaxConfiguration } }>(
    `/admin/tax-configurations/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return result.data.configuration;
}

async function request<T>(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new TaxConfigurationRequestError('Unable to connect to the tax configuration service.');
  }
  const body = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    errors?: Record<string, string>;
    error?: { message?: string; errors?: Record<string, string> };
  };
  if (!response.ok) {
    throw new TaxConfigurationRequestError(
      body.error?.message ?? body.message ?? 'Unable to complete the request.',
      body.error?.errors ?? body.errors ?? {},
    );
  }
  return body as T;
}
