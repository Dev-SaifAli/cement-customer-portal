import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { pickupLocationsService } from './pickup-locations.service.js';
import { pickupLocationIdSchema, pickupLocationInputSchema, pickupLocationListSchema } from './pickup-locations.validation.js';

class PickupLocationsController {
  async list(request: SalesAuthenticatedRequest, response: Response) { response.json({ success: true, data: await pickupLocationsService.list(pickupLocationListSchema.parse(request.query)) }); }
  async show(request: SalesAuthenticatedRequest, response: Response) { response.json({ success: true, data: { location: await pickupLocationsService.get(pickupLocationIdSchema.parse(request.params.id)) } }); }
  async create(request: SalesAuthenticatedRequest, response: Response) { response.status(201).json({ success: true, data: { location: await pickupLocationsService.create(pickupLocationInputSchema.parse(request.body), user(request)) } }); }
  async update(request: SalesAuthenticatedRequest, response: Response) { response.json({ success: true, data: { location: await pickupLocationsService.update(pickupLocationIdSchema.parse(request.params.id), pickupLocationInputSchema.parse(request.body), user(request)) } }); }
}
function user(request: SalesAuthenticatedRequest) { if (!request.salesUser) throw new AppError('Internal authentication is required.',401,'INTERNAL_AUTH_REQUIRED'); return request.salesUser; }
export const pickupLocationsController = new PickupLocationsController();
