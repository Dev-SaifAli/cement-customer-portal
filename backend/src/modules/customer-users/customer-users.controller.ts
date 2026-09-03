import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { customerUsersService } from './customer-users.service.js';
import {
  createCustomerUserSchema,
  updateCustomerUserSchema,
} from './customer-users.validation.js';

export class CustomerUsersController {
  async index(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getAuthenticatedCustomerUser(request);
    requireCustomerAdmin(customerUser);
    const users = await customerUsersService.list(customerUser);

    response.status(200).json({ success: true, data: { users } });
  }

  async create(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getAuthenticatedCustomerUser(request);
    requireCustomerAdmin(customerUser);

    const input = createCustomerUserSchema.parse(request.body);
    const result = await customerUsersService.create(customerUser, input);

    response.status(201).json({ success: true, data: result });
  }

  async show(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getAuthenticatedCustomerUser(request);
    requireCustomerAdmin(customerUser);
    const user = await customerUsersService.getById(customerUser, getUserId(request));

    response.status(200).json({ success: true, data: { user } });
  }

  async update(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getAuthenticatedCustomerUser(request);
    requireCustomerAdmin(customerUser);

    const input = updateCustomerUserSchema.parse(request.body);
    const user = await customerUsersService.update(customerUser, getUserId(request), input);

    response.status(200).json({ success: true, data: { user } });
  }
}

export const customerUsersController = new CustomerUsersController();

function getAuthenticatedCustomerUser(request: CustomerAuthenticatedRequest) {
  if (!request.customerUser) {
    throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
  }

  return request.customerUser;
}

function getUserId(request: CustomerAuthenticatedRequest) {
  const id = request.params.id;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new AppError('Customer user id is required.', 400, 'CUSTOMER_USER_ID_REQUIRED');
  }

  return id;
}

function requireCustomerAdmin(customerUser: ReturnType<typeof getAuthenticatedCustomerUser>) {
  if (customerUser.role !== 'CUSTOMER_ADMIN') {
    throw new AppError(
      'Customer administrator access is required.',
      403,
      'CUSTOMER_ADMIN_REQUIRED',
    );
  }
}
