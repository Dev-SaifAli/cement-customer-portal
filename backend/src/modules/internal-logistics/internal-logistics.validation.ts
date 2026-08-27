import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const saudiMobile = z
  .string()
  .trim()
  .regex(/^(?:\+966|966|0)?5\d{8}$/, 'Enter a valid Saudi mobile number.');

export const logisticsIdSchema = z.string().uuid();
export const logisticsListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
});

export const transporterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  companyName: z.string().trim().min(1).max(160),
  contactPerson: optionalText(120),
  phone: saudiMobile,
  email: z.string().trim().email().max(254).nullable().optional(),
  crNumber: optionalText(40),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
export const updateTransporterSchema = transporterSchema.partial();

export const transporterCostSchema = z.object({
  transporterId: z.string().uuid(),
  haderCityId: z.string().uuid(),
  cementType: z.enum(['STANDARD_CEMENT', 'WHITE_CEMENT']),
  costPerTon: z.number().finite().min(0).max(999_999_999.99),
});
export const updateTransporterCostSchema = transporterCostSchema
  .partial()
  .omit({ transporterId: true });

export const haderTruckSchema = z.object({
  plateNumber: z.string().trim().min(2).max(40),
  vehicleType: z.string().trim().min(1).max(80),
  capacityTon: z.number().finite().positive().max(9999.999),
  modelYear: z.number().int().min(1950).max(2200).nullable().optional(),
  assignedDriverId: z.string().uuid().nullable().optional(),
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'INACTIVE']).default('AVAILABLE'),
});
export const updateHaderTruckSchema = haderTruckSchema.partial();

export const haderDriverSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mobile: saudiMobile,
  licenseNumber: z.string().trim().min(2).max(80),
  licenseExpiry: z.iso.date().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
export const updateHaderDriverSchema = haderDriverSchema.partial();

export const logisticsEntitySchema = z.enum(['TRANSPORTER', 'TRUCK', 'DRIVER']);
export const logisticsDocumentTypeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9_-]{2,40}$/i);

export type LogisticsList = z.infer<typeof logisticsListSchema>;
export type TransporterInput = z.infer<typeof transporterSchema>;
export type TransporterCostInput = z.infer<typeof transporterCostSchema>;
export type HaderTruckInput = z.infer<typeof haderTruckSchema>;
export type HaderDriverInput = z.infer<typeof haderDriverSchema>;
