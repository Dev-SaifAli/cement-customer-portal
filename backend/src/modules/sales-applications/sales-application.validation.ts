import { z } from 'zod';

export const salesApplicationStatuses = [
  'DRAFT',
  'PENDING_SALES_REVIEW',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'ACTIVATED',
] as const;

const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Application id is invalid.',
  );

export const salesApplicationIdSchema = z.object({
  id: uuidSchema,
});

export const listSalesApplicationsSchema = z.object({
  search: z
    .string()
    .trim()
    .max(100, 'Search must be 100 characters or fewer.')
    .optional()
    .transform((value) => (value ? value : undefined)),
  reference: z
    .string()
    .trim()
    .max(100, 'Reference filter must be 100 characters or fewer.')
    .optional()
    .transform((value) => (value ? value : undefined)),
  company: z
    .string()
    .trim()
    .max(100, 'Company filter must be 100 characters or fewer.')
    .optional()
    .transform((value) => (value ? value : undefined)),
  contact: z
    .string()
    .trim()
    .max(100, 'Contact filter must be 100 characters or fewer.')
    .optional()
    .transform((value) => (value ? value : undefined)),
  submittedFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Submitted from date must use YYYY-MM-DD format.')
    .optional(),
  submittedTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Submitted to date must use YYYY-MM-DD format.')
    .optional(),
  status: z.enum(salesApplicationStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const salesApplicationFilterOptionsSchema = z.object({
  field: z.enum(['reference', 'company', 'contact', 'contactEmail', 'contactPhone', 'status']),
  search: z
    .string()
    .trim()
    .max(100, 'Filter option search must be 100 characters or fewer.')
    .optional()
    .transform((value) => (value ? value : undefined)),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateSalesApplicationStatusSchema = z
  .object({
    status: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
    reason: z
      .string()
      .trim()
      .max(1000, 'Reason must be 1000 characters or fewer.')
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .superRefine((value, context) => {
    if (['REJECTED', 'CHANGES_REQUESTED'].includes(value.status) && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Reason is required for rejected or changes requested applications.',
      });
    }
  });
