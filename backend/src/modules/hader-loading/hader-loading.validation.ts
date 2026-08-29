import { z } from 'zod';

export const loadingIdSchema = z.uuid();
export const loadingListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  status: z.enum(['WAITING', 'NOTIFIED', 'AT_GATE', 'LOADING', 'LOADED']).optional(),
  productId: z.uuid().optional(),
});
export const notifyDriverSchema = z.object({ remind: z.boolean().optional().default(false) });
export const arrivalSchema = z.object({ stage: z.enum(['PARKING', 'GATE']) });
export const loadingPointSchema = z.object({ loadingPointId: z.uuid() });
export type LoadingListQuery = z.infer<typeof loadingListSchema>;
