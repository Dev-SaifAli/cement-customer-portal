import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { salesContractsService } from '../sales-contracts/sales-contracts.service.js';
import { createContractFromAcceptedQuotationSchema } from '../sales-contracts/sales-contracts.validation.js';
import { salesQuotationsService } from './sales-quotations.service.js';
import {
  listSalesQuotationsSchema,
  rejectSalesQuotationApprovalSchema,
  salesQuotationIdSchema,
  updateSalesQuotationPricingSchema,
} from './sales-quotations.validation.js';

export class SalesQuotationsController {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireSalesUser(request);
    const query = listSalesQuotationsSchema.parse(request.query);
    response
      .status(200)
      .json({ success: true, data: await salesQuotationsService.list(query, user) });
  }

  async show(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireSalesUser(request);
    const { id } = salesQuotationIdSchema.parse(request.params);
    response.status(200).json({
      success: true,
      data: { quotation: await salesQuotationsService.getById(id, user) },
    });
  }

  async startReview(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireSalesUser(request);
    const { id } = salesQuotationIdSchema.parse(request.params);
    response.status(200).json({
      success: true,
      data: { quotation: await salesQuotationsService.startReview(id, user) },
    });
  }

  async updatePricing(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireSalesUser(request);
    const { id } = salesQuotationIdSchema.parse(request.params);
    const payload = updateSalesQuotationPricingSchema.parse(request.body);
    response.status(200).json({
      success: true,
      data: { quotation: await salesQuotationsService.updatePricing(id, payload, user) },
    });
  }

  async submitApproval(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireSalesUser(request);
    const { id } = salesQuotationIdSchema.parse(request.params);
    response.status(200).json({
      success: true,
      data: { quotation: await salesQuotationsService.submitForApproval(id, user) },
    });
  }

  async approve(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireSalesUser(request);
    const { id } = salesQuotationIdSchema.parse(request.params);
    response.status(200).json({
      success: true,
      data: { quotation: await salesQuotationsService.approve(id, user) },
    });
  }

  async reject(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireSalesUser(request);
    const { id } = salesQuotationIdSchema.parse(request.params);
    const { reason } = rejectSalesQuotationApprovalSchema.parse(request.body);
    response.status(200).json({
      success: true,
      data: { quotation: await salesQuotationsService.reject(id, reason, user) },
    });
  }

  async sendToCustomer(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireSalesUser(request);
    const { id } = salesQuotationIdSchema.parse(request.params);
    response.status(200).json({
      success: true,
      data: { quotation: await salesQuotationsService.sendToCustomer(id, user) },
    });
  }

  async createContract(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireSalesUser(request);
    const { id } = salesQuotationIdSchema.parse(request.params);
    const payload = createContractFromAcceptedQuotationSchema.parse(request.body);
    response.status(201).json({
      success: true,
      data: { contract: await salesContractsService.createFromAcceptedQuotation(id, payload, user) },
    });
  }
}

export const salesQuotationsController = new SalesQuotationsController();

function requireSalesUser(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) {
    throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
  }
  return request.salesUser;
}
