import { z } from 'zod';

export const deliveryRequestStatusSchema = z.enum([
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CONVERTED_TO_SHIPMENT',
]);
export const shipmentStatusSchema = z.enum([
  'CREATED',
  'ASSIGNED',
  'LOADING',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CLOSED',
]);
export const haderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  search: z.string().trim().max(100).optional(),
  status: z.string().trim().max(40).optional(),
  haderCityId: z.uuid().optional(),
  requestedDate: z.iso.date().optional(),
  productId: z.uuid().optional(),
});
export const haderIdSchema = z.uuid();
export const rejectDeliveryRequestSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
export const createShipmentSchema = z.object({
  clientRequestId: z.uuid().optional(),
  quantityTon: z.coerce.number().positive('Shipment quantity must be greater than zero.'),
  scheduledDate: z.iso.date().optional(),
});
export type HaderListQuery = z.infer<typeof haderListQuerySchema>;
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
