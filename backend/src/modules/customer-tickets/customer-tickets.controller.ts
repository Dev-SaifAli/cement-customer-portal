import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { customerTicketsService } from './customer-tickets.service.js';
import {
  createCustomerTicketSchema,
  listCustomerTicketsSchema,
  listSalesTicketsSchema,
  ticketIdSchema,
  updateCustomerTicketDraftSchema,
} from './customer-tickets.validation.js';

export class CustomerTicketsController {
  async listCustomer(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    const query = listCustomerTicketsSchema.parse(request.query);
    response.json({
      success: true,
      data: await customerTicketsService.listForCustomer(request.customerUser, query),
    });
  }

  async createCustomer(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    const payload = createCustomerTicketSchema.parse(request.body);
    const ticket = await customerTicketsService.createForCustomer(request.customerUser, payload);
    response.status(201).json({ success: true, data: { ticket } });
  }

  async showCustomer(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    const id = ticketIdSchema.parse(request.params.id);
    response.json({
      success: true,
      data: { ticket: await customerTicketsService.getForCustomer(request.customerUser, id) },
    });
  }

  async updateCustomerDraft(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    const id = ticketIdSchema.parse(request.params.id);
    const payload = updateCustomerTicketDraftSchema.parse(request.body);
    response.json({
      success: true,
      data: {
        ticket: await customerTicketsService.updateDraftForCustomer(
          request.customerUser,
          id,
          payload,
        ),
      },
    });
  }

  async submitCustomer(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    const id = ticketIdSchema.parse(request.params.id);
    response.json({
      success: true,
      data: { ticket: await customerTicketsService.submitForCustomer(request.customerUser, id) },
    });
  }

  async deleteCustomer(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    const id = ticketIdSchema.parse(request.params.id);
    await customerTicketsService.deleteForCustomer(request.customerUser, id);
    response.status(204).send();
  }

  async listSales(request: SalesAuthenticatedRequest, response: Response) {
    const query = listSalesTicketsSchema.parse(request.query);
    response.json({ success: true, data: await customerTicketsService.listForSales(query) });
  }

  async showSales(request: SalesAuthenticatedRequest, response: Response) {
    const id = ticketIdSchema.parse(request.params.id);
    response.json({
      success: true,
      data: { ticket: await customerTicketsService.getForSales(id) },
    });
  }

  async sendToCrm(request: SalesAuthenticatedRequest, response: Response) {
    if (!request.salesUser) {
      throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
    }
    const id = ticketIdSchema.parse(request.params.id);
    response.json({
      success: true,
      data: { ticket: await customerTicketsService.sendToCrm(id, request.salesUser) },
    });
  }
}

export const customerTicketsController = new CustomerTicketsController();
