import { z } from 'zod';

export const taxConfigurationIdSchema = z.uuid();

export const taxConfigurationInputSchema = z.object({
  vatMode: z.enum(['LOCAL', 'EXPORT']),
  ratePercent: z.coerce
    .number({ error: 'Tax rate must be a number.' })
    .min(0, 'Tax rate cannot be negative.')
    .max(100, 'Tax rate cannot exceed 100.'),
});

export type TaxConfigurationInput = z.infer<typeof taxConfigurationInputSchema>;
