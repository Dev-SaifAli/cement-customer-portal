import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { taxConfigurationsService } from './tax-configurations.service.js';
import {
  taxConfigurationIdSchema,
  taxConfigurationInputSchema,
} from './tax-configurations.validation.js';

class TaxConfigurationsController {
  async list(_request: SalesAuthenticatedRequest, response: Response) {
    response.json({ success: true, data: await taxConfigurationsService.list() });
  }

  async show(request: SalesAuthenticatedRequest, response: Response) {
    const id = taxConfigurationIdSchema.parse(request.params.id);
    response.json({ success: true, data: { configuration: await taxConfigurationsService.get(id) } });
  }

  async create(request: SalesAuthenticatedRequest, response: Response) {
    const configuration = await taxConfigurationsService.create(
      taxConfigurationInputSchema.parse(request.body),
      authenticatedUser(request),
    );
    response.status(201).json({ success: true, data: { configuration } });
  }

  async update(request: SalesAuthenticatedRequest, response: Response) {
    const configuration = await taxConfigurationsService.update(
      taxConfigurationIdSchema.parse(request.params.id),
      taxConfigurationInputSchema.parse(request.body),
      authenticatedUser(request),
    );
    response.json({ success: true, data: { configuration } });
  }
}

function authenticatedUser(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) {
    throw new AppError('Internal authentication is required.', 401, 'INTERNAL_AUTH_REQUIRED');
  }
  return request.salesUser;
}

export const taxConfigurationsController = new TaxConfigurationsController();
