import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { haderDeliveryService } from './hader-delivery.service.js';
import {
  createShipmentSchema,
  haderIdSchema,
  haderListQuerySchema,
  rejectDeliveryRequestSchema,
} from './hader-delivery.validation.js';

export class HaderDeliveryController {
  async listRequests(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: await haderDeliveryService.listRequests(haderListQuerySchema.parse(request.query)),
    });
  }
  async showRequest(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { request: await haderDeliveryService.getRequest(getId(request)) },
    });
  }
  async approve(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { request: await haderDeliveryService.approve(getId(request), getUser(request)) },
    });
  }
  async reject(request: SalesAuthenticatedRequest, response: Response) {
    const { reason } = rejectDeliveryRequestSchema.parse(request.body);
    response.json({
      success: true,
      data: {
        request: await haderDeliveryService.reject(getId(request), getUser(request), reason),
      },
    });
  }
  async createShipment(request: SalesAuthenticatedRequest, response: Response) {
    const shipment = await haderDeliveryService.createShipment(
      getId(request),
      getUser(request),
      createShipmentSchema.parse(request.body),
    );
    response.status(201).json({ success: true, data: { shipment } });
  }
  async listShipments(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: await haderDeliveryService.listShipments(haderListQuerySchema.parse(request.query)),
    });
  }
  async showShipment(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { shipment: await haderDeliveryService.getShipment(getId(request)) },
    });
  }
}
export const haderDeliveryController = new HaderDeliveryController();
function getId(request: SalesAuthenticatedRequest) {
  return haderIdSchema.parse(request.params.id);
}
function getUser(request: SalesAuthenticatedRequest) {
  if (!request.salesUser)
    throw new AppError('Internal authentication is required.', 401, 'HADER_AUTH_REQUIRED');
  return request.salesUser;
}
