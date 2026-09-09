import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { operationalOrdersController } from './operational-orders.controller.js';

export const operationalOrdersRouter = Router();
operationalOrdersRouter.use(
  requireSalesAuth,
  requireSalesRole('HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER'),
);
operationalOrdersRouter.get(
  '/',
  asyncHandler(operationalOrdersController.list.bind(operationalOrdersController)),
);
operationalOrdersRouter.post(
  '/:id/start-processing',
  requireSalesRole('HADER_MANAGER', 'HADER_OPERATIONS'),
  asyncHandler(operationalOrdersController.startProcessing.bind(operationalOrdersController)),
);
operationalOrdersRouter.get(
  '/:id',
  asyncHandler(operationalOrdersController.show.bind(operationalOrdersController)),
);
