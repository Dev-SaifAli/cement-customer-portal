import { z } from 'zod';
import { customerRoles } from '../customer-auth/customer-roles.js';

const emailSchema = z.string().trim().email('A valid email address is required.').toLowerCase();

const nameSchema = z.string().trim().min(2, 'Name is required.');
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/\d/, 'Password must include a number.');
const saudiPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+9665\d{8}$/, 'Phone number must use +9665XXXXXXXX format');

export const createCustomerUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: saudiPhoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z.enum(customerRoles).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const updateCustomerUserSchema = z
  .object({
    name: nameSchema.optional(),
    phone: saudiPhoneSchema.optional(),
    role: z.enum(customerRoles).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.phone !== undefined ||
      value.role !== undefined ||
      value.isActive !== undefined,
    {
      message: 'At least one user field is required.',
    },
  );

export type CreateCustomerUserInput = z.infer<typeof createCustomerUserSchema>;
export type UpdateCustomerUserInput = z.infer<typeof updateCustomerUserSchema>;
