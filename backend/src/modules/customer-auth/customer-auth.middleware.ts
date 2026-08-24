import type { RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { customerAuthCookieName } from './customer-auth.constants.js';
import { customerAuthService } from './customer-auth.service.js';
import type { CustomerAuthenticatedRequest } from './customer-auth.types.js';
import { customerTokenService } from './customer-token.service.js';

export const requireCustomerAuth: RequestHandler = asyncHandler(
  async (request, _response, next) => {
    const token = getCustomerAuthToken(request.headers.authorization, request.headers.cookie);
    const payload = customerTokenService.verifyToken(token);
    const user = await customerAuthService.getAuthenticatedUser(payload.sub);

    (request as CustomerAuthenticatedRequest).customerUser = user;
    next();
  },
);

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
