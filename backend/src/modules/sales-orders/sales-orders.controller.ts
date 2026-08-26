import type { Request, Response } from 'express';
import { salesOrdersService } from './sales-orders.service.js';
import { listSalesOrdersSchema, salesOrderIdSchema } from './sales-orders.validation.js';

export class SalesOrdersController {
  async list(request: Request, response: Response) {
    const query = listSalesOrdersSchema.parse(request.query);
    response.json({ success: true, data: await salesOrdersService.list(query) });
  }

  async show(request: Request, response: Response) {
    const id = salesOrderIdSchema.parse(request.params.id);
    response.json({ success: true, data: { order: await salesOrdersService.getById(id) } });
  }
}

export const salesOrdersController = new SalesOrdersController();
