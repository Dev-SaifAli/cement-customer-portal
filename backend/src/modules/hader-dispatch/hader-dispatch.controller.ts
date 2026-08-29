import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { haderDispatchService } from './hader-dispatch.service.js';
import {
  assignShipmentSchema,
  dispatchIdSchema,
  dispatchListQuerySchema,
  scheduleShipmentSchema,
} from './hader-dispatch.validation.js';

export class HaderDispatchController {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: await haderDispatchService.list(dispatchListQuerySchema.parse(request.query)),
    });
  }
  async detail(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { shipment: await haderDispatchService.detail(id(request)) },
    });
  }
  async filters(_request: SalesAuthenticatedRequest, response: Response) {
    response.json({ success: true, data: await haderDispatchService.filters() });
  }
  async assign(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: {
        shipment: await haderDispatchService.assign(
          id(request),
          assignShipmentSchema.parse(request.body),
          user(request),
        ),
      },
    });
  }
  async schedule(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: {
        shipment: await haderDispatchService.schedule(
          id(request),
          scheduleShipmentSchema.parse(request.body),
          user(request),
        ),
      },
    });
  }
  async dispatch(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { shipment: await haderDispatchService.dispatch(id(request), user(request)) },
    });
  }
}

export const haderDispatchController = new HaderDispatchController();
function id(request: SalesAuthenticatedRequest) {
  return dispatchIdSchema.parse(request.params.shipmentId ?? request.params.id);
}
function user(request: SalesAuthenticatedRequest) {
  if (!request.salesUser)
    throw new AppError('Internal authentication is required.', 401, 'HADER_AUTH_REQUIRED');
  return request.salesUser;
}
