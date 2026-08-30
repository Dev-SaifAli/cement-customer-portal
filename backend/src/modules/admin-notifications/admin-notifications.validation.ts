import { z } from 'zod';
import { customerRoles } from '../customer-auth/customer-roles.js';
import { salesRoles } from '../sales-auth/sales-auth.types.js';

const audienceSchema = z.enum(['CUSTOMER', 'SALES']);

export const adminNotificationListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  audience: audienceSchema.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const adminNotificationIdSchema = z.object({ id: z.string().uuid() });

const notificationFields = z.object({
    title: z.string().trim().min(2, 'Title is required.').max(180),
    message: z.string().trim().min(2, 'Message is required.').max(2000),
    audience: audienceSchema,
    targetRoles: z.array(z.string()).max(20).default([]),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  });

const partialNotificationFields = notificationFields.partial();

type NotificationFields = z.infer<typeof notificationFields>;
type PartialNotificationFields = z.infer<typeof partialNotificationFields>;

function validateAudienceRoles(
  value: NotificationFields | PartialNotificationFields,
  context: z.RefinementCtx,
) {
    if (!value.audience || !value.targetRoles) return;
    const allowed = value.audience === 'CUSTOMER' ? customerRoles : salesRoles;
    for (const role of value.targetRoles) {
      if (!(allowed as readonly string[]).includes(role)) {
        context.addIssue({ code: 'custom', path: ['targetRoles'], message: `Role ${role} is not valid for the selected audience.` });
      }
    }
}

export const createAdminNotificationSchema = notificationFields.superRefine(validateAudienceRoles);

export const updateAdminNotificationSchema = partialNotificationFields
  .superRefine(validateAudienceRoles)
  .refine((value) => Object.keys(value).length > 0, 'At least one notification field is required.');

export type AdminNotificationListInput = z.infer<typeof adminNotificationListSchema>;
export type CreateAdminNotificationInput = z.infer<typeof createAdminNotificationSchema>;
export type UpdateAdminNotificationInput = z.infer<typeof updateAdminNotificationSchema>;
