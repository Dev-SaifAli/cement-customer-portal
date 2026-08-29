import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { loadingPointsController as controller } from './loading-points.controller.js';

const view = requireSalesRole(
  'PRICING_ADMIN',
  'HADER_MANAGER',
  'HADER_OPERATIONS',
  'DISPATCH_USER',
  'LOADING_USER',
);
const manage = requireSalesRole('PRICING_ADMIN', 'HADER_MANAGER', 'HADER_OPERATIONS');

export const adminLoadingPointsRouter = Router();
adminLoadingPointsRouter.use(requireSalesAuth, view);
adminLoadingPointsRouter.get('/', asyncHandler(controller.list.bind(controller)));
adminLoadingPointsRouter.post('/', manage, asyncHandler(controller.create.bind(controller)));
adminLoadingPointsRouter.patch('/:id', manage, asyncHandler(controller.update.bind(controller)));

export const haderAvailableLoadingPointsRouter = Router();
haderAvailableLoadingPointsRouter.use(requireSalesAuth, view);
haderAvailableLoadingPointsRouter.get(
  '/available',
  asyncHandler(controller.available.bind(controller)),
);
