import { z } from 'zod';

export const pickupLocationIdSchema = z.uuid();
export const pickupLocationListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
export const pickupLocationInputSchema = z.object({
  name: z.string().trim().min(1, 'Location name is required.').max(150),
  cityId: z.uuid('City is required.'),
  address: z.string().trim().min(1, 'Address is required.').max(500),
  postalCode: z.string().trim().max(20).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
}).superRefine((value, context) => {
  if ((value.latitude == null) !== (value.longitude == null)) {
    context.addIssue({ code: 'custom', path: ['latitude'], message: 'Select both latitude and longitude.' });
  }
});
export const updatePickupLocationSchema = pickupLocationInputSchema;
export type PickupLocationInput = z.infer<typeof pickupLocationInputSchema>;
export type PickupLocationList = z.infer<typeof pickupLocationListSchema>;
