import { z } from 'zod';

export const wholeTonQuantityMessage = 'Quantity must be a whole number of tons.';

const wholeCommercialTons = <T extends z.ZodNumber>(schema: T) =>
  schema
    .finite()
    .int(wholeTonQuantityMessage)
    .positive('Quantity must be greater than zero.');

export const wholeCommercialTonsSchema = wholeCommercialTons(z.number());
export const coercedWholeCommercialTonsSchema = wholeCommercialTons(z.coerce.number() as z.ZodNumber);