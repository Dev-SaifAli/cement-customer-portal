import { z } from 'zod';

const saudiMobile = z
  .string()
  .trim()
  .regex(/^\+9665\d{8}$/, 'Phone number must use +9665XXXXXXXX format');

export const updateCustomerProfileSchema = z
  .object({
    administratorName: z.string().trim().min(2, 'Administrator name is required.').optional(),
    contactPhone: saudiMobile.optional(),
  })
  .refine((value) => value.administratorName !== undefined || value.contactPhone !== undefined, {
    message: 'At least one profile field is required.',
  });

export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
