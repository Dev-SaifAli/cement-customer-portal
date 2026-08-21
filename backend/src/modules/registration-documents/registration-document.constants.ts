export const registrationDocumentTypes = ['cr', 'vat'] as const;

export type RegistrationDocumentType = (typeof registrationDocumentTypes)[number];

export const maxRegistrationDocumentSizeBytes = 10 * 1024 * 1024;

export const allowedRegistrationDocumentMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const allowedRegistrationDocumentExtensions = ['.pdf', '.jpg', '.jpeg', '.png'] as const;

export const registrationDocumentLabels: Record<RegistrationDocumentType, string> = {
  cr: 'Commercial Registration',
  vat: 'VAT Certificate',
};
