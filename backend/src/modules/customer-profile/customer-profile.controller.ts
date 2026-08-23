import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { customerProfileService } from './customer-profile.service.js';
import { updateCustomerProfileSchema } from './customer-profile.validation.js';

export class CustomerProfileController {
  async show(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }

    const profile = await customerProfileService.getProfile(request.customerUser);
    response.status(200).json({ success: true, data: profile });
  }

  async update(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }

    const input = updateCustomerProfileSchema.parse(request.body);
    const profile = await customerProfileService.updateProfile(request.customerUser, input);
    response.status(200).json({ success: true, data: profile });
  }
}

export const customerProfileController = new CustomerProfileController();
