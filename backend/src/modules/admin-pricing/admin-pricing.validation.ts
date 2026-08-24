import { z } from 'zod';

const price = z.coerce
  .number()
  .finite()
  .nonnegative('Price cannot be negative.')
  .max(999999999999.99, 'Price is too large.');

export const productPriceParamsSchema = z.object({ productId: z.string().uuid() });
export const cityParamsSchema = z.object({ cityId: z.string().uuid() });

export const upsertProductPriceSchema = z.object({
  cityId: z.string().uuid(),
  listPrice: price.positive('List price must be greater than zero.'),
});

export const upsertDeliveryPriceSchema = z.object({
  cityId: z.string().uuid(),
  standardDeliveryPrice: price,
  whiteCementDeliveryPrice: price,
});

export const updateHaderCitySchema = z.object({ isHaderEnabled: z.boolean() });

export type UpsertProductPrice = z.infer<typeof upsertProductPriceSchema>;
export type UpsertDeliveryPrice = z.infer<typeof upsertDeliveryPriceSchema>;
