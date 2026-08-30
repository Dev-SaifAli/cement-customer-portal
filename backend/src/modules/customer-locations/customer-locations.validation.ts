import { z } from 'zod';

const saudiMobile = z
  .string()
  .trim()
  .regex(/^\+9665\d{8}$/, 'Phone number must use +9665XXXXXXXX format');

export const customerLocationSchema = z
  .object({
    name: z.string().trim().min(1, 'Location name is required.'),
    streetAddress: z.string().trim().min(1, 'Street address is required.'),
    city: z.string().trim().min(1, 'City is required.'),
    region: z.string().trim().min(1, 'Region is required.'),
    country: z.string().trim().min(1, 'Country is required.'),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, 'Postal code must contain exactly 5 digits.')
      .or(z.literal(''))
      .optional(),
    contactPerson: z.string().trim().min(1, 'Contact person is required.'),
    contactPhone: saudiMobile,
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    isPrimary: z.boolean().optional(),
  })
  .refine(
    (value) => (value.latitude === undefined) === (value.longitude === undefined),
    'Both latitude and longitude are required when a map location is selected',
  );

export type CustomerLocationInput = z.infer<typeof customerLocationSchema>;
