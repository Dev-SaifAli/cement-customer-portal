import { z } from 'zod';

const optionalFilterSchema = z
  .string()
  .trim()
  .max(100, 'Filter must be 100 characters or fewer.')
  .optional()
  .transform((value) => (value ? value : undefined));

export const listCustomerProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: optionalFilterSchema,
  category: optionalFilterSchema,
  packagingType: optionalFilterSchema,
  uom: optionalFilterSchema,
});

export type ListCustomerProductsQuery = z.infer<typeof listCustomerProductsSchema>;
