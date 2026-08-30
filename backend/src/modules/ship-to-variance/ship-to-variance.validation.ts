import { z } from 'zod';

export const shipToVarianceListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['VARIANCE_DETECTED', 'PRICING_NOT_CONFIGURED']).optional(),
});

export const shipToVarianceShipmentIdSchema = z.uuid();
export const shipToVarianceDecisionIdSchema = z.uuid();
export const rejectShipToVarianceChargeSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export type ShipToVarianceListQuery = z.infer<typeof shipToVarianceListSchema>;
