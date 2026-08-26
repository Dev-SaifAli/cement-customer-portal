import { z } from 'zod';

export const fleetStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const fleetListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  search: z.string().trim().max(100).optional(),
  status: fleetStatusSchema.optional(),
});

export const createTruckSchema = z.object({
  plateNumber: z.string().trim().min(1, 'Plate number is required.').max(40),
  vehicleType: z.string().trim().min(1, 'Vehicle type is required.').max(80),
  capacityTon: z.coerce.number().positive('Capacity must be greater than zero.'),
  carrierName: z.string().trim().max(120).optional(),
  status: fleetStatusSchema.default('ACTIVE'),
});

export const updateTruckSchema = createTruckSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one truck field is required.');

export const createDriverSchema = z.object({
  name: z.string().trim().min(1, 'Driver name is required.').max(120),
  mobile: z
    .string()
    .trim()
    .regex(/^\+9665\d{8}$/, 'Mobile must use +9665XXXXXXXX format.'),
  licenseNumber: z.string().trim().min(1, 'License number is required.').max(80),
  licenseExpiry: z.iso.date().optional(),
  status: fleetStatusSchema.default('ACTIVE'),
});

export const updateDriverSchema = createDriverSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one driver field is required.');

export const fleetEntityIdSchema = z.uuid();
export const truckDocumentTypeSchema = z.enum(['registration', 'insurance']);
export const driverDocumentTypeSchema = z.enum(['license', 'identity', 'photo']);

export type CreateTruckInput = z.infer<typeof createTruckSchema>;
export type UpdateTruckInput = z.infer<typeof updateTruckSchema>;
export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
