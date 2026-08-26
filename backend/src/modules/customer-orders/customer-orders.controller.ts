import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { customerOrdersService } from './customer-orders.service.js';
import {
  createCustomerOrderSchema,
  customerOrderContractIdSchema,
  customerOrderIdSchema,
  listCustomerOrdersSchema,
} from './customer-orders.validation.js';

export class CustomerOrdersController {
  async list(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    const query = listCustomerOrdersSchema.parse(request.query);
    response.json({
      success: true,
      data: await customerOrdersService.list(request.customerUser, query),
    });
  }

  async show(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    const id = customerOrderIdSchema.parse(request.params.id);
    response.json({
      success: true,
      data: { order: await customerOrdersService.getById(request.customerUser, id) },
    });
  }

  async create(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }

    const contractId = customerOrderContractIdSchema.parse(request.params.contractId);
    const payload = createCustomerOrderSchema.parse(request.body);
    const order = await customerOrdersService.createFromContract(
      request.customerUser,
      contractId,
      payload,
    );

    response.status(201).json({ success: true, data: { order } });
  }
}

export const customerOrdersController = new CustomerOrdersController();
