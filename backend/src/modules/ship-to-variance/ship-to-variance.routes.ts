import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { shipToVarianceController as controller } from './ship-to-variance.controller.js';

export const shipToVarianceRouter = Router();
export const commercialDirectorVarianceRouter = Router();

shipToVarianceRouter.use(requireSalesAuth);
shipToVarianceRouter.get('/', requireSalesRole('PRICE_MANAGER'), asyncHandler(controller.list.bind(controller)));
shipToVarianceRouter.get(
  '/:shipmentId',
  requireSalesRole('PRICE_MANAGER'),
  asyncHandler(controller.detail.bind(controller)),
);
shipToVarianceRouter.post(
  '/:shipmentId/dismiss',
  requireSalesRole('PRICE_MANAGER'),
  asyncHandler(controller.dismiss.bind(controller)),
);
shipToVarianceRouter.post(
  '/:shipmentId/raise-charge',
  requireSalesRole('PRICE_MANAGER'),
  asyncHandler(controller.raiseCharge.bind(controller)),
);

commercialDirectorVarianceRouter.use(requireSalesAuth, requireSalesRole('COMMERCIAL_DIRECTOR'));
commercialDirectorVarianceRouter.get('/', asyncHandler(controller.pendingCharges.bind(controller)));
commercialDirectorVarianceRouter.get('/:decisionId', asyncHandler(controller.chargeDetail.bind(controller)));
commercialDirectorVarianceRouter.post('/:decisionId/approve', asyncHandler(controller.approveCharge.bind(controller)));
commercialDirectorVarianceRouter.post('/:decisionId/reject', asyncHandler(controller.rejectCharge.bind(controller)));
