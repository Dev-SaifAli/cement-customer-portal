import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { salesApplicationService } from './sales-application.service.js';
import {
  listSalesApplicationsSchema,
  salesApplicationIdSchema,
  updateSalesApplicationStatusSchema,
} from './sales-application.validation.js';

export class SalesApplicationController {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    const query = listSalesApplicationsSchema.parse(request.query);
    const result = await salesApplicationService.listApplications(query);

    response.status(200).json({
      success: true,
      data: result,
    });
  }

  async get(request: SalesAuthenticatedRequest, response: Response) {
    const { id } = salesApplicationIdSchema.parse(request.params);
    const application = await salesApplicationService.getApplication(id);

    response.status(200).json({
      success: true,
      data: {
        application,
      },
    });
  }

  async updateStatus(request: SalesAuthenticatedRequest, response: Response) {
    const { id } = salesApplicationIdSchema.parse(request.params);
    const payload = updateSalesApplicationStatusSchema.parse(request.body ?? {});

    if (!request.salesUser) {
      throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
    }

    const result = await salesApplicationService.updateStatus(id, payload, request.salesUser.id);

    response.status(200).json({
      success: true,
      data: result,
    });
  }
}

export const salesApplicationController = new SalesApplicationController();
