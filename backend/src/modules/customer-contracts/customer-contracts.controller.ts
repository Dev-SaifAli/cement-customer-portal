import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { customerContractsService } from './customer-contracts.service.js';
import {
  customerContractIdSchema,
  listCustomerContractsSchema,
} from './customer-contracts.validation.js';

export class CustomerContractsController {
  async list(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const query = listCustomerContractsSchema.parse(request.query);
    const contracts = await customerContractsService.list(customerUser, query);

    response.status(200).json({ success: true, data: contracts });
  }

  async show(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const id = customerContractIdSchema.parse(request.params.id);
    const contract = await customerContractsService.getById(customerUser, id);

    response.status(200).json({ success: true, data: { contract } });
  }
}

export const customerContractsController = new CustomerContractsController();

function getCustomerUser(request: CustomerAuthenticatedRequest) {
  if (!request.customerUser) {
    throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
  }

  return request.customerUser;
}
