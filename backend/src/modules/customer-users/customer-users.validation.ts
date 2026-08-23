import { z } from 'zod';

const emailSchema = z.string().trim().email('A valid email address is required.').toLowerCase();

const nameSchema = z.string().trim().min(2, 'Name is required.');

export const createCustomerUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.literal('CUSTOMER_ADMIN').optional(),
  isActive: z.boolean().optional(),
});

export const updateCustomerUserSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.email !== undefined || value.isActive !== undefined,
    {
      message: 'At least one user field is required.',
    },
  );

export type CreateCustomerUserInput = z.infer<typeof createCustomerUserSchema>;
export type UpdateCustomerUserInput = z.infer<typeof updateCustomerUserSchema>;
