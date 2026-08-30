import { z } from 'zod';
import { salesRoles } from '../sales-auth/sales-auth.types.js';

const emailSchema = z.string().trim().email('A valid email address is required.').toLowerCase();
const nameSchema = z.string().trim().min(2, 'Name is required.').max(120);

export const adminUserListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(120).optional(),
  role: z.enum(salesRoles).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const adminUserIdSchema = z.object({ id: z.string().uuid('A valid user id is required.') });

export const createAdminUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
    confirmPassword: z.string(),
    role: z.enum(salesRoles),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const updateAdminUserSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    role: z.enum(salesRoles).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one user field is required.',
  });

export type AdminUserListInput = z.infer<typeof adminUserListSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
