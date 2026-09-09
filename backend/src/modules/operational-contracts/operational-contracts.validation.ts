import { z } from 'zod';

export const operationalContractIdSchema = z.string().uuid();
export const listOperationalContractsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(120).optional(),
  productId: z.string().uuid().optional(),
  startDate: z.iso.date().optional(),
});

export type ListOperationalContractsQuery = z.infer<typeof listOperationalContractsSchema>;
