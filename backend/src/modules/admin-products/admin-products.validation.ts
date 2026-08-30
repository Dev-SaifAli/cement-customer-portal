import { z } from 'zod';

const optionalText = z.string().trim().max(2000).optional().nullable();

export const productParamsSchema = z.object({ id: z.string().uuid() });

const productFields = z.object({
    productCode: z.string().trim().max(100).optional(),
    productName: z.string().trim().min(1, 'Product name is required.').max(200),
    description: optionalText,
    shortDescription: z.string().trim().max(500).optional().nullable(),
    image: z.string().trim().max(1_000_000).optional().nullable(),
    productType: z.string().trim().min(1, 'Product type is required.').max(100),
    packaging: z.string().trim().min(1, 'Packaging is required.').max(100),
    uom: z.string().trim().min(1, 'UOM is required.').max(50),
    unitWeightKg: z.coerce.number().finite().positive('Unit weight must be greater than zero.'),
    isWhiteCement: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    displayOrder: z.coerce.number().int().min(0).optional().default(0),
  });

export const productInputSchema = productFields.superRefine((value, context) => {
    if (value.packaging.toLowerCase().includes('bag') && value.unitWeightKg <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['unitWeightKg'],
        message: 'Bag size is required for bagged products.',
      });
    }
  });

export const productUpdateSchema = productFields.partial();

export const productListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().refine((value) => value === 10 || value === 20).default(10),
  search: z.string().trim().max(200).optional(),
  filters: z.string().max(10000).optional(),
});

export const bulkProductActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['ACTIVATE', 'DEACTIVATE', 'DELETE']),
});

export const bagSizeListSchema = z.object({
  search: z.string().trim().max(30).optional().default(''),
});

export const bagSizeCreateSchema = z.object({
  unitWeightKg: z.coerce
    .number()
    .finite()
    .positive('Enter a valid bag weight in KG.')
    .refine(
      (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < Number.EPSILON * 1000,
      'Bag weight can have no more than 3 decimal places.',
    ),
});

export const productFilterSchema = z.array(
  z.object({
    field: z.enum([
      'productCode',
      'productName',
      'packaging',
      'uom',
      'status',
      'unitWeightKg',
      'updatedAt',
    ]),
    condition: z.enum([
      'equals',
      'notEquals',
      'contains',
      'startsWith',
      'endsWith',
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
      'between',
      'before',
      'after',
      'in',
    ]),
    value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]),
    join: z.enum(['AND', 'OR']).default('AND'),
  }),
).max(12);

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type ProductFilter = z.infer<typeof productFilterSchema>[number];
