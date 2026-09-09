import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { salesOrdersService } from './sales-orders.service.js';
import {
  listSalesOrdersSchema,
  rejectDirectOrderSchema,
  salesOrderIdSchema,
} from './sales-orders.validation.js';

export class SalesOrdersController {
  async list(request: Request, response: Response) {
    const query = listSalesOrdersSchema.parse(request.query);
    response.json({ success: true, data: await salesOrdersService.list(query) });
  }

  async show(request: Request, response: Response) {
    const id = salesOrderIdSchema.parse(request.params.id);
    response.json({ success: true, data: { order: await salesOrdersService.getById(id) } });
  }

  async approveDirectOrder(request: SalesAuthenticatedRequest, response: Response) {
    if (!request.salesUser) {
      throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
    }
    const id = salesOrderIdSchema.parse(request.params.id);
    response.json({
      success: true,
      data: { order: await salesOrdersService.approveDirectOrder(id, request.salesUser) },
    });
  }

  async rejectDirectOrder(request: SalesAuthenticatedRequest, response: Response) {
    if (!request.salesUser) {
      throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
    }
    const id = salesOrderIdSchema.parse(request.params.id);
    const payload = rejectDirectOrderSchema.parse(request.body);
    response.json({
      success: true,
      data: { order: await salesOrdersService.rejectDirectOrder(id, request.salesUser, payload) },
    });
  }
}

export const salesOrdersController = new SalesOrdersController();
