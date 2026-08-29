import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { haderLoadingService } from './hader-loading.service.js';
import {
  arrivalSchema,
  loadingIdSchema,
  loadingListSchema,
  loadingPointSchema,
  notifyDriverSchema,
} from './hader-loading.validation.js';

export class HaderLoadingController {
  async list(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: await haderLoadingService.list(loadingListSchema.parse(req.query)),
    });
  }
  async detail(req: SalesAuthenticatedRequest, res: Response) {
    res.json({ success: true, data: { shipment: await haderLoadingService.detail(id(req)) } });
  }
  async notify(req: SalesAuthenticatedRequest, res: Response) {
    const input = notifyDriverSchema.parse(req.body);
    res.json({
      success: true,
      data: { shipment: await haderLoadingService.notify(id(req), input.remind, user(req)) },
    });
  }
  async arrival(req: SalesAuthenticatedRequest, res: Response) {
    const input = arrivalSchema.parse(req.body);
    res.json({
      success: true,
      data: { shipment: await haderLoadingService.arrival(id(req), input.stage, user(req)) },
    });
  }
  async point(req: SalesAuthenticatedRequest, res: Response) {
    const input = loadingPointSchema.parse(req.body);
    res.json({
      success: true,
      data: {
        shipment: await haderLoadingService.assignPoint(id(req), input.loadingPointId, user(req)),
      },
    });
  }
  async start(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: { shipment: await haderLoadingService.start(id(req), user(req)) },
    });
  }
  async complete(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: { shipment: await haderLoadingService.complete(id(req), user(req)) },
    });
  }
}
export const haderLoadingController = new HaderLoadingController();
function id(req: SalesAuthenticatedRequest) {
  return loadingIdSchema.parse(req.params.shipmentId ?? req.params.id);
}
function user(req: SalesAuthenticatedRequest) {
  if (!req.salesUser)
    throw new AppError('Internal authentication is required.', 401, 'HADER_AUTH_REQUIRED');
  return req.salesUser;
}
