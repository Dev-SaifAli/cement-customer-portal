import { z } from 'zod';

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const quotationItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    productId: z.string().uuid(),
    quantity: z.coerce.number().positive('Quantity must be greater than zero.'),
    palletRequired: z.boolean().optional().default(false),
    palletType: optionalText(80),
    palletQuantity: z.coerce.number().int().positive().optional(),
  })
  .superRefine((value, context) => {
    if (value.palletRequired && !value.palletType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['palletType'],
        message: 'Pallet type is required when pallet is selected.',
      });
    }

    if (value.palletRequired && !value.palletQuantity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['palletQuantity'],
        message: 'Pallet quantity is required when pallet is selected.',
      });
    }
  });

export const customerQuotationPayloadSchema = z
  .object({
    fulfilmentType: z.enum(['PICKUP', 'DELIVERY']),
    pickupLocationId: optionalText(80),
    shipToLocationId: optionalText(120),
    requestedDate: optionalText(20),
    notes: optionalText(1000),
    items: z.array(quotationItemSchema).min(1, 'At least one product is required.'),
  })
  .superRefine((value, context) => {
    if (value.fulfilmentType === 'PICKUP' && !value.pickupLocationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pickupLocationId'],
        message: 'Pickup location is required.',
      });
    }

    if (!value.shipToLocationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shipToLocationId'],
        message: 'Ship-to location is required.',
      });
    }

    if (!value.requestedDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestedDate'],
        message: 'Requested date is required.',
      });
      return;
    }

    const requestedDate = new Date(`${value.requestedDate}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (Number.isNaN(requestedDate.getTime()) || requestedDate < today) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestedDate'],
        message: 'Requested date cannot be in the past.',
      });
    }
  });

export const customerQuotationIdSchema = z.string().uuid();

export const listCustomerQuotationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export type CustomerQuotationPayload = z.infer<typeof customerQuotationPayloadSchema>;
export type ListCustomerQuotationsQuery = z.infer<typeof listCustomerQuotationsSchema>;
