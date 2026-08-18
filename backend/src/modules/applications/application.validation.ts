import { z } from 'zod';

export const applicationReferenceSchema = z
  .string()
  .trim()
  .regex(/^APP-\d{4}-\d{6}$/i, 'Application reference must use APP-YYYY-000000 format')
  .transform((value) => value.toUpperCase());

export const applicationStatusLookupSchema = z.object({
  reference: applicationReferenceSchema,
  email: z.email().transform((value) => value.toLowerCase()),
});
