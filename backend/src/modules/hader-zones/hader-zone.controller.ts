import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { haderZoneService } from './hader-zone.service.js';
import {
  haderCityIdSchema,
  saveHaderBoundarySchema,
  validateHaderZoneSchema,
} from './hader-zone.validation.js';

export class HaderZoneController {
  async list(_request: SalesAuthenticatedRequest, response: Response) {
    response.json({ success: true, data: { cities: await haderZoneService.listCities() } });
  }

  async show(request: SalesAuthenticatedRequest, response: Response) {
    const cityId = haderCityIdSchema.parse(request.params.cityId);
    response.json({ success: true, data: { city: await haderZoneService.getCity(cityId) } });
  }

  async save(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireInternalUser(request);
    const cityId = haderCityIdSchema.parse(request.params.cityId);
    const { boundary } = saveHaderBoundarySchema.parse(request.body);
    response.json({
      success: true,
      data: { city: await haderZoneService.saveBoundary(cityId, boundary, user) },
    });
  }

  async clear(request: SalesAuthenticatedRequest, response: Response) {
    const user = requireInternalUser(request);
    const cityId = haderCityIdSchema.parse(request.params.cityId);
    response.json({
      success: true,
      data: { city: await haderZoneService.clearBoundary(cityId, user) },
    });
  }

  async validate(request: CustomerAuthenticatedRequest, response: Response) {
    if (!request.customerUser) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    const input = validateHaderZoneSchema.parse(request.body);
    response.json({
      success: true,
      data: await haderZoneService.validatePoint(input.cityId, input),
    });
  }
}

function requireInternalUser(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) {
    throw new AppError('Internal authentication is required.', 401, 'SALES_AUTH_REQUIRED');
  }
  return request.salesUser;
}

export const haderZoneController = new HaderZoneController();
