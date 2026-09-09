import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { salesContractsService } from './sales-contracts.service.js';
import {
  listSalesContractsSchema,
  rejectSalesContractSchema,
  salesContractExtensionSchema,
  salesContractIdSchema,
  salesContractPayloadSchema,
} from './sales-contracts.validation.js';

export class SalesContractsController {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    const query = listSalesContractsSchema.parse(request.query);
    const contracts = await salesContractsService.list(query);

    response.status(200).json({ success: true, data: contracts });
  }

  async create(request: SalesAuthenticatedRequest, response: Response) {
    const salesUser = getSalesUser(request);
    const payload = salesContractPayloadSchema.parse(request.body);
    const contract = await salesContractsService.create(payload, salesUser);

    response.status(201).json({ success: true, data: { contract } });
  }

  async show(request: SalesAuthenticatedRequest, response: Response) {
    const { id } = salesContractIdSchema.parse(request.params);
    const contract = await salesContractsService.getById(id);

    response.status(200).json({ success: true, data: { contract } });
  }

  async update(request: SalesAuthenticatedRequest, response: Response) {
    const salesUser = getSalesUser(request);
    const { id } = salesContractIdSchema.parse(request.params);
    const payload = salesContractPayloadSchema.parse(request.body);
    const contract = await salesContractsService.update(id, payload, salesUser);

    response.status(200).json({ success: true, data: { contract } });
  }

  async submit(request: SalesAuthenticatedRequest, response: Response) {
    const salesUser = getSalesUser(request);
    const { id } = salesContractIdSchema.parse(request.params);
    const contract = await salesContractsService.submit(id, salesUser);

    response.status(200).json({ success: true, data: { contract } });
  }

  async approve(request: SalesAuthenticatedRequest, response: Response) {
    const salesUser = getSalesUser(request);
    const { id } = salesContractIdSchema.parse(request.params);
    const contract = await salesContractsService.approve(id, salesUser);

    response.status(200).json({ success: true, data: { contract } });
  }

  async reject(request: SalesAuthenticatedRequest, response: Response) {
    const salesUser = getSalesUser(request);
    const { id } = salesContractIdSchema.parse(request.params);
    const payload = rejectSalesContractSchema.parse(request.body);
    const contract = await salesContractsService.reject(id, payload, salesUser);

    response.status(200).json({ success: true, data: { contract } });
  }

  async extend(request: SalesAuthenticatedRequest, response: Response) {
    const salesUser = getSalesUser(request);
    const { id } = salesContractIdSchema.parse(request.params);
    const payload = salesContractExtensionSchema.parse(request.body);
    const contract = await salesContractsService.extend(id, payload, salesUser);

    response.status(200).json({ success: true, data: { contract } });
  }
}

export const salesContractsController = new SalesContractsController();

function getSalesUser(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) {
    throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
  }

  return request.salesUser;
}
