import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const optionalDraftString = (schema: z.ZodType<string>) =>
  z.preprocess(emptyToUndefined, schema.optional());

const digits = (length: number, message: string) =>
  optionalDraftString(z.string().regex(new RegExp(`^\\d{${length}}$`), message));

const saudiMobile = optionalDraftString(
  z.string().regex(/^\+9665\d{8}$/, 'Phone number must use +9665XXXXXXXX format'),
);

const companySchema = z
  .object({
    companyName: z.string().trim().optional(),
    crNumber: digits(10, 'CR Number must contain exactly 10 digits'),
    vatNumber: digits(15, 'VAT Number must contain exactly 15 digits'),
    streetAddress: z.string().trim().optional(),
    city: z.string().trim().optional(),
    region: z.string().trim().optional(),
    country: z.string().trim().optional(),
    postalCode: digits(5, 'Postal Code must contain exactly 5 digits'),
  })
  .partial();

const contactSchema = z
  .object({
    fullName: z.string().trim().optional(),
    jobTitle: z.string().trim().optional(),
    email: optionalDraftString(z.email('Enter a valid work email address')),
    phone: saudiMobile,
  })
  .partial();

const documentMetadataSchema = z
  .object({
    fileName: z.string().optional(),
    fileSize: z.number().nonnegative().optional(),
    fileType: z.string().optional(),
    expiryDate: z.string().optional(),
  })
  .partial();

const documentsSchema = z
  .object({
    cr: documentMetadataSchema.optional(),
    vat: documentMetadataSchema.optional(),
  })
  .partial();

const deliveryLocationSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1, 'Location name is required'),
    siteId: z.string(),
    streetAddress: z.string().trim().min(1, 'Street address is required'),
    city: z.string().trim().min(1, 'City is required'),
    region: z.string().trim().min(1, 'Region is required'),
    country: z.string().trim().min(1, 'Country is required'),
    postalCode: z.string().optional(),
    contactPerson: z.string().trim().min(1, 'Contact person is required'),
    contactPhone: z.string().regex(/^\+9665\d{8}$/, 'Phone number must use +9665XXXXXXXX format'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    isPrimary: z.boolean().optional(),
  })
  .refine(
    (value) => (value.latitude === undefined) === (value.longitude === undefined),
    'Both latitude and longitude are required when a map location is selected',
  );

const administratorSchema = z
  .object({
    fullName: z.string().trim().optional(),
    jobTitle: z.string().trim().optional(),
    email: optionalDraftString(z.email('Enter a valid work email address')),
    phone: saudiMobile,
    password: optionalDraftString(z.string().min(8, 'Password must be at least 8 characters')),
    confirmPassword: z.string().optional(),
  })
  .partial()
  .refine((value) => !value.password || value.password === value.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

export const updateRegistrationSchema = z.object({
  currentStep: z.number().int().min(1).max(6).optional(),
  company: companySchema.optional(),
  contact: contactSchema.optional(),
  documents: documentsSchema.optional(),
  deliveryLocations: z.array(deliveryLocationSchema).optional(),
  administrator: administratorSchema.optional(),
});

export const createRegistrationSchema = updateRegistrationSchema;

export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>;
