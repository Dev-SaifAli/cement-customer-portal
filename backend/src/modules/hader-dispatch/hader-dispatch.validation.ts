import { z } from 'zod';

export const dispatchIdSchema = z.uuid();
export const dispatchListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  search: z.string().trim().max(100).optional(),
  status: z.string().trim().max(40).optional(),
  haderCityId: z.uuid().optional(),
  requestedDate: z.iso.date().optional(),
  productId: z.uuid().optional(),
});
export const assignShipmentSchema = z.object({
  transporterId: z.uuid(),
  truckId: z.uuid(),
  driverId: z.uuid(),
});
export const scheduleShipmentSchema = z.object({
  scheduledDate: z.iso.date(),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid 24-hour time.'),
});

export type DispatchListQuery = z.infer<typeof dispatchListQuerySchema>;
export type AssignShipmentInput = z.infer<typeof assignShipmentSchema>;
export type ScheduleShipmentInput = z.infer<typeof scheduleShipmentSchema>;
