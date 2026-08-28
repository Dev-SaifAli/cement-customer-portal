import type { RequestHandler } from 'express';
import { AppError } from '../../errors/app-error.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { requireSalesAuth } from '../sales-auth/sales-auth.middleware.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import type { NotificationAuthenticatedRequest } from './notifications.types.js';

export const requireNotificationAuth: RequestHandler = (request, response, next) => {
  const audience = request.header('x-portal-audience')?.toLowerCase();
  if (audience !== 'customer' && audience !== 'sales') {
    next(
      new AppError('A valid portal audience is required.', 400, 'NOTIFICATION_AUDIENCE_REQUIRED'),
    );
    return;
  }

  const auth = audience === 'customer' ? requireCustomerAuth : requireSalesAuth;
  void auth(request, response, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    const authenticatedRequest = request as NotificationAuthenticatedRequest;
    if (audience === 'customer') {
      const user = (request as CustomerAuthenticatedRequest).customerUser;
      if (!user) {
        next(new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED'));
        return;
      }
      authenticatedRequest.notificationActor = { audience: 'CUSTOMER', user };
    } else {
      const user = (request as SalesAuthenticatedRequest).salesUser;
      if (!user) {
        next(new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED'));
        return;
      }
      authenticatedRequest.notificationActor = { audience: 'SALES', user };
    }
    next();
  });
};
