import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { haderDispatchController as controller } from './hader-dispatch.controller.js';

const access = requireSalesRole(
  'HADER_MANAGER',
  'HADER_OPERATIONS',
  'DISPATCH_USER',
  'DELIVERY_TEAM_USER',
);

export const haderDispatchRouter = Router();
haderDispatchRouter.use(requireSalesAuth, access);
haderDispatchRouter.get('/', asyncHandler(controller.list.bind(controller)));
haderDispatchRouter.get('/filters', asyncHandler(controller.filters.bind(controller)));
haderDispatchRouter.get('/:id', asyncHandler(controller.detail.bind(controller)));

export const haderDispatchActionsRouter = Router();
haderDispatchActionsRouter.post(
  '/:shipmentId/assign',
  requireSalesAuth,
  access,
  asyncHandler(controller.assign.bind(controller)),
);
haderDispatchActionsRouter.post(
  '/:shipmentId/schedule',
  requireSalesAuth,
  access,
  asyncHandler(controller.schedule.bind(controller)),
);
haderDispatchActionsRouter.post(
  '/:shipmentId/dispatch',
  requireSalesAuth,
  access,
  asyncHandler(controller.dispatch.bind(controller)),
);
