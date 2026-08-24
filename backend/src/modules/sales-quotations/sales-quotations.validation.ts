import { z } from 'zod';

export const salesQuotationStatuses = [
  'PENDING_SALES_REVIEW',
  'UNDER_REVIEW',
  'PENDING_HADER_APPROVAL',
  'PENDING_PRICE_APPROVAL',
  'READY_FOR_CUSTOMER',
  'ACCEPTED',
  'REJECTED',
  'CLARIFICATION_REQUESTED',
] as const;

const uuidSchema = z.uuid('Quotation id is invalid.');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

export const salesQuotationIdSchema = z.object({ id: uuidSchema });

export const listSalesQuotationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  reference: optionalText(100),
  customer: optionalText(100),
  submittedDate: dateSchema.optional(),
  fulfilmentType: z.enum(['PICKUP', 'DELIVERY']).optional(),
  status: z.enum(salesQuotationStatuses).optional(),
});

const priceSchema = z.coerce.number().finite().min(0).max(999999999.99);
const discountModeSchema = z.enum(['PERCENT', 'SAR_PER_TON']);
const discountValueSchema = z.coerce.number().finite().min(0).max(999999999.99);

export const updateSalesQuotationPricingSchema = z.object({
  items: z
    .array(
      z.object({
        id: uuidSchema,
        productPrice: priceSchema,
        deliveryPrice: priceSchema.optional(),
        discountMode: discountModeSchema.nullish(),
        discountValue: discountValueSchema.nullish(),
      }),
    )
    .min(1, 'At least one priced item is required.'),
  validUntil: dateSchema,
  paymentTerms: z.string().trim().min(1, 'Payment terms are required.').max(200),
  commercialNotes: z.string().trim().max(1000).optional().default(''),
});

export const rejectSalesQuotationApprovalSchema = z.object({
  reason: z.string().trim().min(1, 'A rejection reason is required.').max(1000),
});

export type ListSalesQuotationsQuery = z.infer<typeof listSalesQuotationsSchema>;
export type SalesQuotationPricingPayload = z.infer<typeof updateSalesQuotationPricingSchema>;
