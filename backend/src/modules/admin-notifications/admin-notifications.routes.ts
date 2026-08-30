import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { adminNotificationsController } from './admin-notifications.controller.js';

export const adminNotificationsRouter = Router();
adminNotificationsRouter.use(requireSalesAuth, requireSalesRole('PORTAL_ADMINISTRATOR'));
adminNotificationsRouter.get('/', asyncHandler((request, response) => adminNotificationsController.list(request, response)));
adminNotificationsRouter.post('/', asyncHandler((request, response) => adminNotificationsController.create(request, response)));
adminNotificationsRouter.patch('/:id', asyncHandler((request, response) => adminNotificationsController.update(request, response)));
adminNotificationsRouter.post('/:id/publish', asyncHandler((request, response) => adminNotificationsController.publish(request, response)));
