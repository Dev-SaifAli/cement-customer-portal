import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { customerOrderIdSchema, listCustomerOrdersSchema } from '../customer-orders/customer-orders.validation.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { operationalOrdersService } from './operational-orders.service.js';

export class OperationalOrdersController {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: await operationalOrdersService.list(user(request), listCustomerOrdersSchema.parse(request.query)),
    });
  }

  async show(request: SalesAuthenticatedRequest, response: Response) {
    const id = customerOrderIdSchema.parse(request.params.id);
    response.json({
      success: true,
      data: { order: await operationalOrdersService.getById(user(request), id) },
    });
  }

  async startProcessing(request: SalesAuthenticatedRequest, response: Response) {
    const id = customerOrderIdSchema.parse(request.params.id);
    response.json({
      success: true,
      data: { order: await operationalOrdersService.startProcessing(user(request), id) },
    });
  }
}

function user(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) {
    throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
  }
  return request.salesUser;
}

export const operationalOrdersController = new OperationalOrdersController();
