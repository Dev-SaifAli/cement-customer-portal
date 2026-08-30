import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { customerLocationsService } from './customer-locations.service.js';
import { customerLocationSchema } from './customer-locations.validation.js';

export class CustomerLocationsController {
  async list(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const locations = await customerLocationsService.listLocations(customerUser);
    response.status(200).json({ success: true, data: { locations } });
  }

  async listCities(request: CustomerAuthenticatedRequest, response: Response) {
    getCustomerUser(request);
    const cities = await customerLocationsService.listCities();
    response.status(200).json({ success: true, data: { cities } });
  }

  async create(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const input = customerLocationSchema.parse(request.body);
    const locations = await customerLocationsService.addLocation(customerUser, input);
    response.status(201).json({ success: true, data: { locations } });
  }

  async update(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const input = customerLocationSchema.parse(request.body);
    const locations = await customerLocationsService.updateLocation(
      customerUser,
      getLocationId(request),
      input,
    );
    response.status(200).json({ success: true, data: { locations } });
  }

  async delete(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const locations = await customerLocationsService.deleteLocation(
      customerUser,
      getLocationId(request),
    );
    response.status(200).json({ success: true, data: { locations } });
  }

  async setPrimary(request: CustomerAuthenticatedRequest, response: Response) {
    const customerUser = getCustomerUser(request);
    const locations = await customerLocationsService.setPrimaryLocation(
      customerUser,
      getLocationId(request),
    );
    response.status(200).json({ success: true, data: { locations } });
  }
}

export const customerLocationsController = new CustomerLocationsController();

function getCustomerUser(request: CustomerAuthenticatedRequest) {
  if (!request.customerUser) {
    throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
  }

  return request.customerUser;
}

function getLocationId(request: Request): string {
  const rawId = request.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) {
    throw new AppError('Delivery location id is required.', 400, 'CUSTOMER_LOCATION_ID_REQUIRED');
  }

  return id;
}
