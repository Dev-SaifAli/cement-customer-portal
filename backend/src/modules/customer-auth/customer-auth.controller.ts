import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { customerAuthCookieName } from './customer-auth.constants.js';
import { customerAuthService } from './customer-auth.service.js';
import type { CustomerAuthenticatedRequest } from './customer-auth.types.js';
import { customerLoginSchema } from './customer-auth.validation.js';
import { customerTokenService } from './customer-token.service.js';

export class CustomerAuthController {
  async login(request: Request, response: Response) {
    const payload = customerLoginSchema.parse(request.body);
    const result = await customerAuthService.login(payload);

    response.cookie(customerAuthCookieName, result.token, customerTokenService.getCookieOptions());
    response.status(200).json({
      success: true,
      data: {
        user: result.user,
      },
    });
  }

  async me(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }

    response.status(200).json({
      success: true,
      data: {
        user: {
          id: request.customerUser.id,
          name: request.customerUser.name,
          email: request.customerUser.email,
          role: request.customerUser.role,
        },
        account: {
          id: request.customerUser.account.id,
          companyName: request.customerUser.account.companyName,
        },
      },
    });
  }

  async logout(_request: Request, response: Response) {
    response.clearCookie(customerAuthCookieName, {
      ...customerTokenService.getCookieOptions(),
      maxAge: undefined,
    });
    response.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  }
}

export const customerAuthController = new CustomerAuthController();
