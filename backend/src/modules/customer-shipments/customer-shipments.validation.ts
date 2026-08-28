import { z } from 'zod';

export const customerShipmentStatusSchema = z.enum([
  'CREATED',
  'ASSIGNED',
  'LOADING',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CLOSED',
]);

export const listCustomerShipmentsSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    search: z.string().trim().max(100).optional(),
    status: customerShipmentStatusSchema.optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateTo >= value.dateFrom, {
    message: 'End date must be on or after start date.',
    path: ['dateTo'],
  });

export const customerShipmentIdSchema = z.uuid();

export type ListCustomerShipmentsQuery = z.infer<typeof listCustomerShipmentsSchema>;
