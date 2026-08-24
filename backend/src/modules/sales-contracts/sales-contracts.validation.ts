import { z } from 'zod';

const uuidSchema = z.string().uuid();

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const optionalMoney = z.coerce.number().min(0).optional();

export const contractStatuses = [
  'DRAFT',
  'PENDING_SALES_REVIEW',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'ACTIVE',
  'CANCELLED',
] as const;

export const listSalesContractsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: optionalText(100),
  status: z.enum(contractStatuses).optional(),
  customerAccountId: uuidSchema.optional(),
});

export const salesContractIdSchema = z.object({
  id: uuidSchema,
});

export const salesContractPayloadSchema = z
  .object({
    customerAccountId: uuidSchema,
    productId: uuidSchema,
    quantity: z.coerce.number().positive('Quantity must be greater than zero.'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must use YYYY-MM-DD format.'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must use YYYY-MM-DD format.'),
    fulfilment: z.enum(['PICKUP', 'DELIVERY']),
    pickupLocationId: optionalText(80),
    deliveryLocationId: optionalText(120),
    deliveryCity: optionalText(120),
    palletRequired: z.boolean().optional().default(false),
    palletType: optionalText(80),
    productListPrice: z.coerce.number().min(0),
    productPrice: z.coerce.number().min(0),
    deliveryListPrice: optionalMoney,
    deliveryPrice: optionalMoney,
  })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be greater than or equal to start date.',
      });
    }

    if (value.fulfilment === 'PICKUP' && !value.pickupLocationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pickupLocationId'],
        message: 'Pickup location is required for pick-up contracts.',
      });
    }

    if (value.fulfilment === 'DELIVERY' && !value.deliveryLocationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryLocationId'],
        message: 'Delivery location is required for delivery contracts.',
      });
    }

    if (value.palletRequired && !value.palletType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['palletType'],
        message: 'Pallet type is required when pallet is selected.',
      });
    }
  });

export type ListSalesContractsQuery = z.infer<typeof listSalesContractsSchema>;
export type SalesContractPayload = z.infer<typeof salesContractPayloadSchema>;
