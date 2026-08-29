import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { loadingPointsService } from './loading-points.service.js';
import {
  availableLoadingPointsSchema,
  loadingPointIdSchema,
  loadingPointListSchema,
  loadingPointSchema,
  updateLoadingPointSchema,
} from './loading-points.validation.js';

export class LoadingPointsController {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: await loadingPointsService.list(loadingPointListSchema.parse(request.query)),
    });
  }

  async create(request: SalesAuthenticatedRequest, response: Response) {
    response.status(201).json({
      success: true,
      data: {
        loadingPoint: await loadingPointsService.create(
          loadingPointSchema.parse(request.body),
          user(request),
        ),
      },
    });
  }

  async update(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: {
        loadingPoint: await loadingPointsService.update(
          loadingPointIdSchema.parse(request.params.id),
          defined(updateLoadingPointSchema.parse(request.body)),
          user(request),
        ),
      },
    });
  }

  async available(request: SalesAuthenticatedRequest, response: Response) {
    const { shipmentId } = availableLoadingPointsSchema.parse(request.query);
    response.json({
      success: true,
      data: { loadingPoints: await loadingPointsService.availableForShipment(shipmentId) },
    });
  }
}

function defined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

function user(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) {
    throw new AppError('Internal authentication is required.', 401, 'INTERNAL_AUTH_REQUIRED');
  }
  return request.salesUser;
}

export const loadingPointsController = new LoadingPointsController();
