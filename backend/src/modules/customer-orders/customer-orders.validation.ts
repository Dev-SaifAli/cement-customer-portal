import { z } from 'zod';

export const customerOrderContractIdSchema = z.string().uuid();

export const createCustomerOrderSchema = z.object({
  clientRequestId: z.string().uuid(),
  requestedQuantityTons: z
    .number()
    .finite()
    .positive()
    .max(999_999_999.999)
    .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7, {
      message: 'Requested quantity supports up to 3 decimal places.',
    }),
  preferredDeliveryDate: z.iso.date().nullable().optional(),
  deliveryNotes: z.string().trim().max(1000).nullable().optional(),
  truckId: z.uuid().nullable().optional(),
  driverId: z.uuid().nullable().optional(),
});

export const customerOrderIdSchema = z.string().uuid();

export const listCustomerOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
});

export type CreateCustomerOrderPayload = z.infer<typeof createCustomerOrderSchema>;
export type ListCustomerOrdersQuery = z.infer<typeof listCustomerOrdersSchema>;
