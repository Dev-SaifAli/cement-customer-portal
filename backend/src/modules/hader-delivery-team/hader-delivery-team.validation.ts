import { z } from 'zod';

export const deliveryTeamShipmentIdSchema = z.uuid();

export const deliveryTeamListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['LOADED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED']).optional(),
  haderCityId: z.uuid().optional(),
  deliveryDate: z.iso.date().optional(),
  driverId: z.uuid().optional(),
  truckId: z.uuid().optional(),
});

export type DeliveryTeamListQuery = z.infer<typeof deliveryTeamListSchema>;
