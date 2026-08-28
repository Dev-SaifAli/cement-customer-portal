import { Router } from 'express';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.controller.js';
import { requireNotificationAuth } from './notifications.middleware.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireNotificationAuth);
notificationsRouter.get('/', listNotifications);
notificationsRouter.get('/unread-count', getUnreadCount);
notificationsRouter.patch('/read-all', markAllNotificationsRead);
notificationsRouter.patch('/:id/read', markNotificationRead);
