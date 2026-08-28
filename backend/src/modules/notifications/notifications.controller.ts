import type { RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { AppError } from '../../errors/app-error.js';
import { notificationsService } from './notifications.service.js';
import type { NotificationAuthenticatedRequest } from './notifications.types.js';

function actor(request: NotificationAuthenticatedRequest) {
  const value = request.notificationActor;
  if (!value) throw new AppError('Authentication is required.', 401, 'AUTH_REQUIRED');
  return { audience: value.audience, userId: value.user.id };
}

export const listNotifications: RequestHandler = asyncHandler(async (request, response) => {
  const current = actor(request as NotificationAuthenticatedRequest);
  const notifications = await notificationsService.list(current.audience, current.userId);
  response.json({ success: true, data: { notifications } });
});

export const getUnreadCount: RequestHandler = asyncHandler(async (request, response) => {
  const current = actor(request as NotificationAuthenticatedRequest);
  const unreadCount = await notificationsService.unreadCount(current.audience, current.userId);
  response.json({ success: true, data: { unreadCount } });
});

export const markNotificationRead: RequestHandler = asyncHandler(async (request, response) => {
  const current = actor(request as NotificationAuthenticatedRequest);
  const notificationId = Array.isArray(request.params.id)
    ? (request.params.id[0] ?? '')
    : (request.params.id ?? '');
  const notification = await notificationsService.markRead(
    current.audience,
    current.userId,
    notificationId,
  );
  response.json({ success: true, data: { notification } });
});

export const markAllNotificationsRead: RequestHandler = asyncHandler(async (request, response) => {
  const current = actor(request as NotificationAuthenticatedRequest);
  await notificationsService.markAllRead(current.audience, current.userId);
  response.json({ success: true, data: { unreadCount: 0 } });
});
