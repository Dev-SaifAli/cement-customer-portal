import type { RequestHandler } from 'express';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { salesAuthService } from './sales-auth.service.js';
import type { SalesAuthenticatedRequest, SalesRole } from './sales-auth.types.js';
import { salesAuthCookieName } from './sales-auth.constants.js';
import { salesTokenService } from './sales-token.service.js';

export const requireSalesAuth: RequestHandler = asyncHandler(async (request, _response, next) => {
  const token = getSalesAuthToken(request.headers.authorization, request.headers.cookie);
  const payload = salesTokenService.verifyToken(token);
  const user = await salesAuthService.getAuthenticatedUser(payload.sub);

  (request as SalesAuthenticatedRequest).salesUser = user;
  next();
});

export function requireSalesRole(...roles: SalesRole[]): RequestHandler {
  return (request, _response, next) => {
    const user = (request as SalesAuthenticatedRequest).salesUser;
    if (!user) {
      next(new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED'));
      return;
    }
    if (!roles.includes(user.role)) {
      next(
        new AppError(
          'You are not authorized to access this Sales module.',
          403,
          'SALES_ROLE_FORBIDDEN',
        ),
      );
      return;
    }
    next();
  };
}

function getSalesAuthToken(authorizationHeader?: string, cookieHeader?: string) {
  const bearerToken = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : undefined;

  return bearerToken || getCookieValue(cookieHeader, salesAuthCookieName) || '';
}

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const cookie = cookies.find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}
