import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { salesLoginSchema } from './sales-auth.validation.js';
import { salesAuthCookieName } from './sales-auth.constants.js';
import { salesAuthService } from './sales-auth.service.js';
import type { SalesAuthenticatedRequest } from './sales-auth.types.js';
import { salesTokenService } from './sales-token.service.js';

export class SalesAuthController {
  async login(request: Request, response: Response) {
    const payload = salesLoginSchema.parse(request.body);
    const result = await salesAuthService.login(payload);

    response.cookie(salesAuthCookieName, result.token, salesTokenService.getCookieOptions());
    response.status(200).json({
      success: true,
      data: {
        user: result.user,
      },
    });
  }

  async me(request: SalesAuthenticatedRequest, response: Response) {
    if (!request.salesUser) {
      throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
    }

    response.status(200).json({
      success: true,
      data: {
        user: request.salesUser,
      },
    });
  }

  async logout(_request: Request, response: Response) {
    response.clearCookie(salesAuthCookieName, {
      ...salesTokenService.getCookieOptions(),
      maxAge: undefined,
    });
    response.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  }
}

export const salesAuthController = new SalesAuthController();
