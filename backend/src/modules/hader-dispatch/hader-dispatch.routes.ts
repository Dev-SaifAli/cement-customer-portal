import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { haderDispatchController as controller } from './hader-dispatch.controller.js';

const access = requireSalesRole('HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER');

export const haderDispatchRouter = Router();
haderDispatchRouter.use(requireSalesAuth, access);
haderDispatchRouter.get('/', asyncHandler(controller.list.bind(controller)));
haderDispatchRouter.get('/filters', asyncHandler(controller.filters.bind(controller)));
haderDispatchRouter.get('/:id', asyncHandler(controller.detail.bind(controller)));

export const haderDispatchActionsRouter = Router();
haderDispatchActionsRouter.use(requireSalesAuth, access);
haderDispatchActionsRouter.post(
  '/:shipmentId/assign',
  asyncHandler(controller.assign.bind(controller)),
);
haderDispatchActionsRouter.post(
  '/:shipmentId/schedule',
  asyncHandler(controller.schedule.bind(controller)),
);
haderDispatchActionsRouter.post(
  '/:shipmentId/dispatch',
  asyncHandler(controller.dispatch.bind(controller)),
);
