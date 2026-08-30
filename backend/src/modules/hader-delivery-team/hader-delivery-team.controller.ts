import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { haderDeliveryTeamService } from './hader-delivery-team.service.js';
import {
  deliveryTeamListSchema,
  deliveryTeamShipmentIdSchema,
} from './hader-delivery-team.validation.js';

export class HaderDeliveryTeamController {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: await haderDeliveryTeamService.list(deliveryTeamListSchema.parse(request.query)),
    });
  }

  async detail(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { shipment: await haderDeliveryTeamService.detail(id(request)) },
    });
  }

  async startDelivery(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { shipment: await haderDeliveryTeamService.startDelivery(id(request), user(request)) },
    });
  }

  async deliver(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { shipment: await haderDeliveryTeamService.deliver(id(request), user(request)) },
    });
  }

  async close(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { shipment: await haderDeliveryTeamService.close(id(request), user(request)) },
    });
  }
}

export const haderDeliveryTeamController = new HaderDeliveryTeamController();

function id(request: SalesAuthenticatedRequest) {
  return deliveryTeamShipmentIdSchema.parse(request.params.shipmentId ?? request.params.id);
}

function user(request: SalesAuthenticatedRequest) {
  if (!request.salesUser)
    throw new AppError('Internal authentication is required.', 401, 'HADER_AUTH_REQUIRED');
  return request.salesUser;
}
