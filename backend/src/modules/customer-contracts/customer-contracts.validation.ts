import { z } from 'zod';

export const customerContractIdSchema = z.string().uuid();

export const listCustomerContractsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: z.literal('ACTIVE').optional(),
  search: z.string().trim().max(100).optional(),
  product: z.string().trim().max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ListCustomerContractsQuery = z.infer<typeof listCustomerContractsSchema>;
