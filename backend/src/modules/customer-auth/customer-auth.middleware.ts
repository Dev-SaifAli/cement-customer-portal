import type { RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { customerAuthCookieName } from './customer-auth.constants.js';
import { customerAuthService } from './customer-auth.service.js';
import type { CustomerAuthenticatedRequest } from './customer-auth.types.js';
import type { CustomerRole } from './customer-roles.js';
import { customerTokenService } from './customer-token.service.js';
import { AppError } from '../../errors/app-error.js';

export const requireCustomerAuth: RequestHandler = asyncHandler(
  async (request, _response, next) => {
    const token = getCustomerAuthToken(request.headers.authorization, request.headers.cookie);
    const payload = customerTokenService.verifyToken(token);
    const user = await customerAuthService.getAuthenticatedUser(payload.sub);

    (request as CustomerAuthenticatedRequest).customerUser = user;
    next();
  },
);

export function requireCustomerRole(...roles: CustomerRole[]): RequestHandler {
  return (request, _response, next) => {
    const user = (request as CustomerAuthenticatedRequest).customerUser;
    if (!user) {
      next(new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED'));
      return;
    }
    if (!roles.includes(user.role)) {
      next(
        new AppError(
          'You are not authorized to access this Customer Portal module.',
          403,
          'CUSTOMER_ROLE_FORBIDDEN',
        ),
      );
      return;
    }
    next();
  };
}

function getCustomerAuthToken(authorizationHeader?: string, cookieHeader?: string) {
  const bearerToken = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : undefined;

  return bearerToken || getCookieValue(cookieHeader, customerAuthCookieName) || '';
}

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const cookie = cookies.find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}
