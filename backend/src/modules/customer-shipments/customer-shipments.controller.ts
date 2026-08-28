import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { customerShipmentsService } from './customer-shipments.service.js';
import {
  customerShipmentIdSchema,
  listCustomerShipmentsSchema,
} from './customer-shipments.validation.js';

export class CustomerShipmentsController {
  async list(request: CustomerAuthenticatedRequest, response: Response) {
    const user = getCustomerUser(request);
    response.json({
      success: true,
      data: await customerShipmentsService.list(
        user,
        listCustomerShipmentsSchema.parse(request.query),
      ),
    });
  }

  async show(request: CustomerAuthenticatedRequest, response: Response) {
    const user = getCustomerUser(request);
    response.json({
      success: true,
      data: {
        shipment: await customerShipmentsService.getById(
          user,
          customerShipmentIdSchema.parse(request.params.id),
        ),
      },
    });
  }
}

export const customerShipmentsController = new CustomerShipmentsController();

function getCustomerUser(request: CustomerAuthenticatedRequest) {
  if (!request.customerUser) {
    throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
  }
  return request.customerUser;
}
