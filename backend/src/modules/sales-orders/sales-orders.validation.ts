import { z } from 'zod';

export const salesOrderIdSchema = z.string().uuid();
export const listSalesOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(120).optional(),
  status: z
    .enum([
      'DRAFT',
      'SUBMITTED',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'PROCESSING',
      'COMPLETED',
      'CANCELLED',
    ])
    .optional(),
});

export const rejectDirectOrderSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export type ListSalesOrdersQuery = z.infer<typeof listSalesOrdersSchema>;
export type RejectDirectOrderPayload = z.infer<typeof rejectDirectOrderSchema>;
