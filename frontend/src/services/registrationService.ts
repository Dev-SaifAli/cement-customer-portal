import type { RegistrationData, SubmittedApplication } from '../context/RegistrationContext';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface RegistrationDraftResponse {
  id: string;
  reference: string | null;
  status: string;
  currentStep: number;
  company: Partial<RegistrationData['company']>;
  contact: Partial<RegistrationData['contact']>;
  documents: Partial<RegistrationData['documents']>;
  deliveryLocations: RegistrationData['deliveryLocations'];
  administrator: Partial<RegistrationData['administrator']>;
  submittedAt: string | null;
  updatedAt: string;
}

interface ApiRegistrationResponse {
  success: boolean;
  registration: RegistrationDraftResponse;
  error?: {
    code?: string;
    errors?: Record<string, string>;
    message?: string;
  };
  errors?: Record<string, string>;
  message?: string;
}

export class RegistrationServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly errors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'RegistrationServiceError';
  }
}

const requestRegistration = async (
  path: string,
  options?: RequestInit,
): Promise<RegistrationDraftResponse> => {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...options?.headers,
      },
    });
  } catch {
    throw new RegistrationServiceError('Unable to connect to the registration service.');
  }

  const data = (await response.json().catch(() => ({}))) as Partial<ApiRegistrationResponse>;

  if (!response.ok || !data.registration) {
    const serverMessage = data.error?.message ?? data.message;
    const safeMessage = getSafeErrorMessage(response.status, serverMessage);

    throw new RegistrationServiceError(
      safeMessage,
      response.status,
      data.error?.code,
      data.error?.errors ?? data.errors,
    );
  }

  return data.registration;
};

const getSafeErrorMessage = (status: number, serverMessage?: string) => {
  if (status === 503) return 'Unable to connect to the registration service.';
  if (status >= 500) return 'Unable to process your registration right now. Please try again.';
  if (serverMessage) return serverMessage;
  if (status === 404) return 'Registration draft not found.';
  return 'Registration request failed. Please try again.';
};

export const createRegistrationDraft = (
  payload: Partial<RegistrationData> & { currentStep?: number } = {},
) =>
  requestRegistration('/registrations', {
    method: 'POST',
    body: JSON.stringify(toApiDraftPayload({ currentStep: 1, ...payload })),
  });

export const getRegistrationDraft = (id: string) => requestRegistration(`/registrations/${id}`);

export const updateRegistrationDraft = (
  id: string,
  payload: Partial<RegistrationData> & { currentStep?: number },
) =>
  requestRegistration(`/registrations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(toApiDraftPayload(payload)),
  });

export const uploadRegistrationDocument = (id: string, documentType: 'cr' | 'vat', file: File) =>
  requestRegistration(`/registrations/${id}/documents/${documentType}`, {
    method: 'PUT',
    headers: {
      'content-type': file.type,
      'x-file-name': file.name,
    },
    body: file,
  });

export const submitRegistrationDraft = async (id: string): Promise<SubmittedApplication> => {
  const registration = await requestRegistration(`/registrations/${id}/submit`, {
    method: 'POST',
  });

  return {
    reference: registration.reference ?? '',
    status: 'UNDER_REVIEW',
    statusLabel: 'Pending Sales Review',
    submittedAt: registration.submittedAt ?? new Date().toISOString(),
  };
};

const toApiDraftPayload = (payload: Partial<RegistrationData> & { currentStep?: number }) => ({
  currentStep: payload.currentStep,
  company: payload.company,
  contact: payload.contact ? normalizeContact(payload.contact) : undefined,
  documents: payload.documents ? normalizeDocuments(payload.documents) : undefined,
  deliveryLocations: payload.deliveryLocations?.map((location) => ({
    ...location,
    contactPhone: normalizeSaudiDraftPhone(location.contactPhone),
  })),
  administrator: payload.administrator ? normalizeAdministrator(payload.administrator) : undefined,
});

const normalizeContact = (contact: Partial<RegistrationData['contact']>) => ({
  ...contact,
  phone: contact.phone ? normalizeSaudiDraftPhone(contact.phone) : contact.phone,
});

const normalizeDocuments = (documents: Partial<RegistrationData['documents']>) => ({
  cr: documents.cr ? toDocumentMetadata(documents.cr) : undefined,
  vat: documents.vat ? toDocumentMetadata(documents.vat) : undefined,
});

const normalizeAdministrator = (administrator: Partial<RegistrationData['administrator']>) => {
  const { confirmPassword, password, phone, ...details } = administrator;
  const normalized = {
    ...details,
    phone: phone ? normalizeSaudiDraftPhone(phone) : phone,
  };

  if (
    password &&
    confirmPassword &&
    password === confirmPassword &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  ) {
    return {
      ...normalized,
      password,
      confirmPassword,
    };
  }

  return normalized;
};

const toDocumentMetadata = (document: RegistrationData['documents']['cr']) => ({
  fileName: document.file?.name ?? document.fileName,
  fileSize: document.file?.size ?? document.fileSize,
  fileType: document.file?.type ?? document.fileType,
  expiryDate: document.expiryDate,
});

const normalizeSaudiBackendPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('966')
    ? digits.slice(3)
    : digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  return local ? `+966${local.slice(0, 9)}` : '';
};

const normalizeSaudiDraftPhone = (phone: string) => {
  const normalized = normalizeSaudiBackendPhone(phone);
  return /^\+9665\d{8}$/.test(normalized) ? normalized : undefined;
};
