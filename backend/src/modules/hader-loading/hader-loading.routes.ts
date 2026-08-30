import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { haderLoadingController as c } from './hader-loading.controller.js';
const access = requireSalesRole(
  'HADER_MANAGER',
  'HADER_OPERATIONS',
  'DISPATCH_USER',
  'LOADING_USER',
);
export const haderLoadingRouter = Router();
haderLoadingRouter.use(requireSalesAuth, access);
haderLoadingRouter.get('/', asyncHandler(c.list.bind(c)));
haderLoadingRouter.get('/:id', asyncHandler(c.detail.bind(c)));
export const haderLoadingActionsRouter = Router();
haderLoadingActionsRouter.post(
  '/:shipmentId/notify',
  requireSalesAuth,
  access,
  asyncHandler(c.notify.bind(c)),
);
haderLoadingActionsRouter.post(
  '/:shipmentId/arrival',
  requireSalesAuth,
  access,
  asyncHandler(c.arrival.bind(c)),
);
haderLoadingActionsRouter.post(
  '/:shipmentId/loading-point',
  requireSalesAuth,
  access,
  asyncHandler(c.point.bind(c)),
);
haderLoadingActionsRouter.post(
  '/:shipmentId/start-loading',
  requireSalesAuth,
  access,
  asyncHandler(c.start.bind(c)),
);
haderLoadingActionsRouter.post(
  '/:shipmentId/complete-loading',
  requireSalesAuth,
  access,
  asyncHandler(c.complete.bind(c)),
);
