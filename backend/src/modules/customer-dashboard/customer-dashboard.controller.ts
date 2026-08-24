import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { customerDashboardService } from './customer-dashboard.service.js';

export class CustomerDashboardController {
  async show(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }

    const dashboard = await customerDashboardService.getDashboard(request.customerUser);

    response.status(200).json({
      success: true,
      data: dashboard,
    });
  }
}

export const customerDashboardController = new CustomerDashboardController();
