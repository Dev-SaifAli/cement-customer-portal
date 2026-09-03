import { z } from 'zod';

export const ticketIdSchema = z.string().uuid();

export const createCustomerTicketSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Description is required.')
    .max(2000, 'Description must be 2,000 characters or fewer.'),
});

export const updateCustomerTicketDraftSchema = createCustomerTicketSchema;

const customerTicketFilterFieldSchema = z.enum([
  'ticketNumber',
  'description',
  'status',
  'crmHandoff',
  'createdDate',
  'updatedDate',
  'createdBy',
]);

const salesTicketFilterFieldSchema = z.enum([
  'ticketNumber',
  'customer',
  'description',
  'status',
  'crmHandoff',
  'createdDate',
]);

const customerTicketFilterConditionSchema = z.enum([
  'equals',
  'contains',
  'before',
  'after',
  'between',
]);

const customerTicketFilterSchema = z
  .object({
    field: customerTicketFilterFieldSchema,
    condition: customerTicketFilterConditionSchema,
    value: z.string().trim().min(1).max(200),
    valueTo: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((filter, context) => {
    const allowedConditions: Record<
      z.infer<typeof customerTicketFilterFieldSchema>,
      Array<z.infer<typeof customerTicketFilterConditionSchema>>
    > = {
      ticketNumber: ['equals', 'contains'],
      description: ['contains'],
      status: ['equals'],
      crmHandoff: ['equals'],
      createdDate: ['before', 'after', 'between'],
      updatedDate: ['before', 'after', 'between'],
      createdBy: ['equals'],
    };

    if (!allowedConditions[filter.field].includes(filter.condition)) {
      context.addIssue({
        code: 'custom',
        path: ['condition'],
        message: 'Filter condition is not supported for this field.',
      });
    }

    if (filter.condition === 'between' && !filter.valueTo) {
      context.addIssue({
        code: 'custom',
        path: ['valueTo'],
        message: 'End value is required for between filters.',
      });
    }

    if (filter.condition !== 'between' && filter.valueTo !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['valueTo'],
        message: 'End value is only supported for between filters.',
      });
    }

    if (filter.field === 'status') {
      const validStatuses = ['DRAFT', 'SUBMITTED', 'OPEN', 'CLOSED'];
      if (!validStatuses.includes(filter.value)) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'Invalid ticket status filter.',
        });
      }
    }

    if (filter.field === 'crmHandoff') {
      const validHandoffStatuses = ['NOT_SENT', 'SENT'];
      if (!validHandoffStatuses.includes(filter.value)) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'Invalid CRM handoff filter.',
        });
      }
    }

    if (filter.field === 'createdDate' || filter.field === 'updatedDate') {
      if (!isIsoDate(filter.value)) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'Filter date must use YYYY-MM-DD.',
        });
      }
      if (filter.valueTo !== undefined && !isIsoDate(filter.valueTo)) {
        context.addIssue({
          code: 'custom',
          path: ['valueTo'],
          message: 'Filter end date must use YYYY-MM-DD.',
        });
      }
    }
  });

const customerTicketFiltersSchema = z.preprocess((value) => {
  if (value === undefined || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, z.array(customerTicketFilterSchema).max(10).default([]));

const salesTicketFilterSchema = z
  .object({
    field: salesTicketFilterFieldSchema,
    condition: customerTicketFilterConditionSchema,
    value: z.string().trim().min(1).max(200),
    valueTo: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((filter, context) => {
    const allowedConditions: Record<
      z.infer<typeof salesTicketFilterFieldSchema>,
      Array<z.infer<typeof customerTicketFilterConditionSchema>>
    > = {
      ticketNumber: ['equals', 'contains'],
      customer: ['equals', 'contains'],
      description: ['contains'],
      status: ['equals'],
      crmHandoff: ['equals'],
      createdDate: ['before', 'after'],
    };

    if (!allowedConditions[filter.field].includes(filter.condition)) {
      context.addIssue({
        code: 'custom',
        path: ['condition'],
        message: 'Filter condition is not supported for this field.',
      });
    }

    if (filter.valueTo !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['valueTo'],
        message: 'End value is not supported for Sales ticket filters.',
      });
    }

    if (filter.field === 'status') {
      const validStatuses = ['SUBMITTED', 'OPEN', 'CLOSED'];
      if (!validStatuses.includes(filter.value)) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'Invalid ticket status filter.',
        });
      }
    }

    if (filter.field === 'crmHandoff') {
      const validHandoffStatuses = ['NOT_SENT', 'SENT'];
      if (!validHandoffStatuses.includes(filter.value)) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'Invalid CRM handoff filter.',
        });
      }
    }

    if (filter.field === 'createdDate' && !isIsoDate(filter.value)) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Filter date must use YYYY-MM-DD.',
      });
    }
  });

const salesTicketFiltersSchema = z.preprocess((value) => {
  if (value === undefined || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, z.array(salesTicketFilterSchema).max(10).default([]));

export const listCustomerTicketsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  filters: customerTicketFiltersSchema,
});

export const listSalesTicketsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(['SUBMITTED', 'OPEN', 'CLOSED']).optional(),
  search: z.string().trim().max(120).optional(),
  filters: salesTicketFiltersSchema,
});

export type CreateCustomerTicketInput = z.infer<typeof createCustomerTicketSchema>;
export type UpdateCustomerTicketDraftInput = z.infer<typeof updateCustomerTicketDraftSchema>;
export type ListCustomerTicketsQuery = z.infer<typeof listCustomerTicketsSchema>;
export type ListSalesTicketsQuery = z.infer<typeof listSalesTicketsSchema>;

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
