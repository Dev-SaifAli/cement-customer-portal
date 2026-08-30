import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { adminNotificationsService } from './admin-notifications.service.js';
import {
  adminNotificationIdSchema,
  adminNotificationListSchema,
  createAdminNotificationSchema,
  updateAdminNotificationSchema,
} from './admin-notifications.validation.js';

function actorId(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) throw new AppError('Authentication is required.', 401, 'SALES_AUTH_REQUIRED');
  return request.salesUser.id;
}

export const adminNotificationsController = {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    response.json({ success: true, data: await adminNotificationsService.list(adminNotificationListSchema.parse(request.query)) });
  },
  async create(request: SalesAuthenticatedRequest, response: Response) {
    const notification = await adminNotificationsService.create(createAdminNotificationSchema.parse(request.body), actorId(request));
    response.status(201).json({ success: true, data: { notification } });
  },
  async update(request: SalesAuthenticatedRequest, response: Response) {
    const { id } = adminNotificationIdSchema.parse(request.params);
    const notification = await adminNotificationsService.update(id, updateAdminNotificationSchema.parse(request.body), actorId(request));
    response.json({ success: true, data: { notification } });
  },
  async publish(request: SalesAuthenticatedRequest, response: Response) {
    const { id } = adminNotificationIdSchema.parse(request.params);
    const notification = await adminNotificationsService.publish(id, actorId(request));
    response.json({ success: true, data: { notification } });
  },
};
