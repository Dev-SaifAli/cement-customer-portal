import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { customerQuotationsService } from './customer-quotations.service.js';
import {
  customerQuotationIdSchema,
  customerQuotationDecisionMessageSchema,
  customerQuotationPayloadSchema,
  listCustomerQuotationsSchema,
} from './customer-quotations.validation.js';

export class CustomerQuotationsController {
  async pickupLocations(_request: CustomerAuthenticatedRequest, response: Response) {
    response.status(200).json({
      success: true,
      data: {
        locations: customerQuotationsService.getPickupLocations(),
      },
    });
  }

  async create(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const payload = customerQuotationPayloadSchema.parse(request.body);
    const quotation = await customerQuotationsService.create(customerUser, payload);

    response.status(201).json({ success: true, data: { quotation } });
  }

  async list(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const query = listCustomerQuotationsSchema.parse(request.query);
    const quotations = await customerQuotationsService.list(customerUser, query);

    response.status(200).json({ success: true, data: quotations });
  }

  async show(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const quotationId = customerQuotationIdSchema.parse(request.params.id);
    const quotation = await customerQuotationsService.getById(customerUser, quotationId);

    response.status(200).json({ success: true, data: { quotation } });
  }

  async update(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const quotationId = customerQuotationIdSchema.parse(request.params.id);
    const payload = customerQuotationPayloadSchema.parse(request.body);
    const quotation = await customerQuotationsService.update(customerUser, quotationId, payload);

    response.status(200).json({ success: true, data: { quotation } });
  }

  async submit(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const quotationId = customerQuotationIdSchema.parse(request.params.id);
    const quotation = await customerQuotationsService.submit(customerUser, quotationId);

    response.status(200).json({ success: true, data: { quotation } });
  }

  async accept(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const quotationId = customerQuotationIdSchema.parse(request.params.id);
    const quotation = await customerQuotationsService.accept(customerUser, quotationId);

    response.status(200).json({ success: true, data: { quotation } });
  }

  async reject(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const quotationId = customerQuotationIdSchema.parse(request.params.id);
    const { reason } = customerQuotationDecisionMessageSchema.parse(request.body);
    const quotation = await customerQuotationsService.reject(customerUser, quotationId, reason);

    response.status(200).json({ success: true, data: { quotation } });
  }

  async requestClarification(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const quotationId = customerQuotationIdSchema.parse(request.params.id);
    const { reason } = customerQuotationDecisionMessageSchema.parse(request.body);
    const quotation = await customerQuotationsService.requestClarification(
      customerUser,
      quotationId,
      reason,
    );

    response.status(200).json({ success: true, data: { quotation } });
  }
}

export const customerQuotationsController = new CustomerQuotationsController();

function getCustomerUser(request: CustomerAuthenticatedRequest) {
  if (!request.customerUser) {
    throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
  }

  return request.customerUser;
}
