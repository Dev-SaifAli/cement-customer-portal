import { z } from 'zod';
import { wholeCommercialTonsSchema } from '../products/commercial-quantity.validation.js';

export const customerOrderContractIdSchema = z.string().uuid();
const customerOrderWholeTonsSchema = wholeCommercialTonsSchema.max(
  999_999_999,
  'Quantity is too large.',
);

const orderPalletFields = {
  palletRequired: z.boolean(),
  palletType: z.string().trim().min(1).nullable(),
  palletQuantity: z.number().int().positive().nullable(),
};

function validateOrderPallet(
  value: { palletRequired: boolean; palletType: string | null; palletQuantity: number | null },
  context: z.RefinementCtx,
) {
  if (value.palletRequired && !value.palletType) {
    context.addIssue({
      code: 'custom',
      path: ['palletType'],
      message: 'Pallet type is required when pallets are enabled.',
    });
  }
  if (value.palletRequired && !value.palletQuantity) {
    context.addIssue({
      code: 'custom',
      path: ['palletQuantity'],
      message: 'Pallet quantity is required when pallets are enabled.',
    });
  }
  if (!value.palletRequired && (value.palletType !== null || value.palletQuantity !== null)) {
    context.addIssue({
      code: 'custom',
      path: ['palletRequired'],
      message: 'Pallet details must be empty when pallets are disabled.',
    });
  }
}

export const createCustomerOrderSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    requestedQuantityTons: customerOrderWholeTonsSchema,
    preferredDeliveryDate: z.iso.date().nullable().optional(),
    deliveryNotes: z.string().trim().max(1000).nullable().optional(),
    truckId: z.uuid().nullable().optional(),
    driverId: z.uuid().nullable().optional(),
    palletRequired: z.boolean().optional(),
    palletType: z.string().trim().min(1).nullable().optional(),
    palletQuantity: z.number().int().positive().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.palletRequired === true && !value.palletType) {
      context.addIssue({
        code: 'custom',
        path: ['palletType'],
        message: 'Pallet type is required when pallets are enabled.',
      });
    }
    if (value.palletRequired === true && !value.palletQuantity) {
      context.addIssue({
        code: 'custom',
        path: ['palletQuantity'],
        message: 'Pallet quantity is required when pallets are enabled.',
      });
    }
    if (
      value.palletRequired === false &&
      (value.palletType != null || value.palletQuantity != null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['palletRequired'],
        message: 'Pallet details must be empty when pallets are disabled.',
      });
    }
  });

const directOrderBaseSchema = z.object({
  clientRequestId: z.string().uuid(),
  productId: z.string().uuid(),
  quantityTons: customerOrderWholeTonsSchema,
  fulfilmentType: z.enum(['DELIVERY', 'PICKUP']),
  shipToLocationId: z.string().trim().min(1).nullable().optional(),
  pickupLocationId: z.string().trim().min(1).nullable().optional(),
  requestedDeliveryDate: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const priceDirectOrderSchema = directOrderBaseSchema.omit({ clientRequestId: true });
export const createDirectOrderSchema = directOrderBaseSchema
  .extend(orderPalletFields)
  .superRefine(validateOrderPallet);

export const customerOrderIdSchema = z.string().uuid();

export const listCustomerOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(120).optional(),
  orderType: z.enum(['DIRECT', 'CONTRACT']).optional(),
  status: z
    .enum([
      'DRAFT',
      'SUBMITTED',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'PROCESSING',
      'COMPLETED',
      'CANCELLED',
    ])
    .optional(),
});

export type CreateCustomerOrderPayload = z.infer<typeof createCustomerOrderSchema>;
export type DirectOrderPricingPayload = z.infer<typeof priceDirectOrderSchema>;
export type CreateDirectOrderPayload = z.infer<typeof createDirectOrderSchema>;
export type ListCustomerOrdersQuery = z.infer<typeof listCustomerOrdersSchema>;
