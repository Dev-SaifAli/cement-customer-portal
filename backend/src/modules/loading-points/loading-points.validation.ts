import { z } from 'zod';

export const loadingPointIdSchema = z.uuid();
export const loadingPointListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  search: z.string().trim().max(100).optional(),
  pointType: z.enum(['SILO', 'BAGGING_LINE']).optional(),
  status: z.enum(['AVAILABLE', 'BUSY', 'FULL', 'INACTIVE']).optional(),
});
const loadingPointFields = z.object({
  pointType: z.enum(['SILO', 'BAGGING_LINE']),
  productId: z.uuid(),
  capacityTon: z.number().finite().positive().max(999_999.999).optional(),
  capacityTonPerHour: z.number().finite().positive().max(999_999.999).optional(),
  maxTrucks: z.number().int().min(1).max(999).optional(),
  status: z.enum(['AVAILABLE', 'BUSY', 'FULL', 'INACTIVE']).default('AVAILABLE'),
});
export const loadingPointSchema = loadingPointFields.superRefine((value, context) => {
  if (value.pointType === 'SILO' && value.capacityTon === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['capacityTon'],
      message: 'Silo capacity must be greater than zero.',
    });
  }
  if (value.pointType === 'BAGGING_LINE' && value.capacityTonPerHour === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['capacityTonPerHour'],
      message: 'Bagging Line capacity must be greater than zero.',
    });
  }
  if (value.pointType === 'BAGGING_LINE' && value.maxTrucks === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['maxTrucks'],
      message: 'Maximum Trucks must be at least one.',
    });
  }
});
export const updateLoadingPointSchema = loadingPointFields.partial();
export const availableLoadingPointsSchema = z.object({ shipmentId: z.uuid() });

export type LoadingPointListQuery = z.infer<typeof loadingPointListSchema>;
export type LoadingPointInput = z.infer<typeof loadingPointSchema>;
