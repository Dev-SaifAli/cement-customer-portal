import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { createCustomerOrderSchema } from '../customer-orders/customer-orders.validation.js';
import { customerOrdersService } from '../customer-orders/customer-orders.service.js';
import { operationalContractsService } from './operational-contracts.service.js';
import { listOperationalContractsSchema, operationalContractIdSchema } from './operational-contracts.validation.js';

export class OperationalContractsController {
  async access(request: SalesAuthenticatedRequest, response: Response) {
    response.json({ success: true, data: await operationalContractsService.access(user(request)) });
  }
  async list(request: SalesAuthenticatedRequest, response: Response) {
    response.json({ success: true, data: await operationalContractsService.list(user(request), listOperationalContractsSchema.parse(request.query)) });
  }
  async filters(request: SalesAuthenticatedRequest, response: Response) {
    response.json({ success: true, data: await operationalContractsService.filterOptions(user(request)) });
  }
  async show(request: SalesAuthenticatedRequest, response: Response) {
    response.json({ success: true, data: { contract: await operationalContractsService.getById(user(request), id(request)) } });
  }
  async createOrder(request: SalesAuthenticatedRequest, response: Response) {
    const order = await customerOrdersService.createFromContractForOperations(
      user(request), id(request), createCustomerOrderSchema.parse(request.body),
    );
    response.status(201).json({ success: true, data: { order } });
  }
}

function user(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) throw new AppError('Internal authentication is required.', 401, 'SALES_AUTH_REQUIRED');
  return request.salesUser;
}
function id(request: SalesAuthenticatedRequest) { return operationalContractIdSchema.parse(request.params.id); }
export const operationalContractsController = new OperationalContractsController();
