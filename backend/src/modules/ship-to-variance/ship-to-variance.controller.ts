import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { shipToVarianceService } from './ship-to-variance.service.js';
import {
  rejectShipToVarianceChargeSchema,
  shipToVarianceDecisionIdSchema,
  shipToVarianceListSchema,
  shipToVarianceShipmentIdSchema,
} from './ship-to-variance.validation.js';

export class ShipToVarianceController {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: await shipToVarianceService.list(shipToVarianceListSchema.parse(request.query)),
    });
  }

  async detail(request: SalesAuthenticatedRequest, response: Response) {
    const shipmentId = shipToVarianceShipmentIdSchema.parse(request.params.shipmentId);
    response.json({
      success: true,
      data: { variance: await shipToVarianceService.detail(shipmentId) },
    });
  }

  async dismiss(request: SalesAuthenticatedRequest, response: Response) {
    const shipmentId = shipToVarianceShipmentIdSchema.parse(request.params.shipmentId);
    response.json({
      success: true,
      data: { decision: await shipToVarianceService.dismiss(shipmentId, requireUser(request)) },
    });
  }

  async raiseCharge(request: SalesAuthenticatedRequest, response: Response) {
    const shipmentId = shipToVarianceShipmentIdSchema.parse(request.params.shipmentId);
    response.status(201).json({
      success: true,
      data: { decision: await shipToVarianceService.raiseCharge(shipmentId, requireUser(request)) },
    });
  }

  async pendingCharges(request: SalesAuthenticatedRequest, response: Response) {
    const page = shipToVarianceListSchema.pick({ page: true }).parse(request.query).page;
    response.json({ success: true, data: await shipToVarianceService.listPendingCharges(page) });
  }

  async chargeDetail(request: SalesAuthenticatedRequest, response: Response) {
    const decisionId = shipToVarianceDecisionIdSchema.parse(request.params.decisionId);
    response.json({
      success: true,
      data: { decision: await shipToVarianceService.getCharge(decisionId) },
    });
  }

  async approveCharge(request: SalesAuthenticatedRequest, response: Response) {
    const decisionId = shipToVarianceDecisionIdSchema.parse(request.params.decisionId);
    response.json({
      success: true,
      data: { decision: await shipToVarianceService.approveCharge(decisionId, requireUser(request)) },
    });
  }

  async rejectCharge(request: SalesAuthenticatedRequest, response: Response) {
    const decisionId = shipToVarianceDecisionIdSchema.parse(request.params.decisionId);
    const { reason } = rejectShipToVarianceChargeSchema.parse(request.body);
    response.json({
      success: true,
      data: { decision: await shipToVarianceService.rejectCharge(decisionId, reason, requireUser(request)) },
    });
  }
}

export const shipToVarianceController = new ShipToVarianceController();

function requireUser(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) {
    throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
  }
  return request.salesUser;
}
