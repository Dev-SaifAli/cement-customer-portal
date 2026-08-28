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

const directOrderBaseSchema = z.object({
  clientRequestId: z.string().uuid(),
  productId: z.string().uuid(),
  quantityTons: z
    .number()
    .finite()
    .positive()
    .max(999_999_999.999)
    .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7, {
      message: 'Quantity supports up to 3 decimal places.',
    }),
  fulfilmentType: z.enum(['DELIVERY', 'PICKUP']),
  shipToLocationId: z.string().trim().min(1).nullable().optional(),
  pickupLocationId: z.string().trim().min(1).nullable().optional(),
  requestedDeliveryDate: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const priceDirectOrderSchema = directOrderBaseSchema.omit({ clientRequestId: true });
export const createDirectOrderSchema = directOrderBaseSchema;

export const customerOrderIdSchema = z.string().uuid();

export const listCustomerOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(120).optional(),
  orderType: z.enum(['DIRECT', 'CONTRACT']).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
});

export type CreateCustomerOrderPayload = z.infer<typeof createCustomerOrderSchema>;
export type DirectOrderPricingPayload = z.infer<typeof priceDirectOrderSchema>;
export type CreateDirectOrderPayload = z.infer<typeof createDirectOrderSchema>;
export type ListCustomerOrdersQuery = z.infer<typeof listCustomerOrdersSchema>;
