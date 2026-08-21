import { z } from 'zod';
import {
  maxRegistrationDocumentSizeBytes,
  registrationDocumentTypes,
} from './registration-document.constants.js';

const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Application id is invalid.',
  );

export const registrationDocumentParamsSchema = z.object({
  id: uuidSchema,
  documentType: z.enum(registrationDocumentTypes),
});

export const salesDocumentParamsSchema = z.object({
  id: uuidSchema,
  documentId: z.enum(registrationDocumentTypes),
});

export const uploadRegistrationDocumentHeadersSchema = z.object({
  'x-file-name': z.string().trim().min(1, 'File name is required.').max(255),
  'content-type': z.preprocess(
    (value) => (typeof value === 'string' ? value.split(';')[0]?.trim().toLowerCase() : value),
    z.string().optional(),
  ),
  'content-length': z.coerce
    .number()
    .int()
    .positive()
    .max(maxRegistrationDocumentSizeBytes)
    .optional(),
});

export const salesDocumentQuerySchema = z.object({
  download: z
    .enum(['1', 'true'])
    .optional()
    .transform((value) => Boolean(value)),
});
