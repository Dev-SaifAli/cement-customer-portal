import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { requireSalesAuth } from '../sales-auth/sales-auth.middleware.js';
import { salesOrdersController } from './sales-orders.controller.js';

export const salesOrdersRouter = Router();

salesOrdersRouter.use(requireSalesAuth);
salesOrdersRouter.use(requireSalesRole('SALES_REP'));
salesOrdersRouter.get(
  '/',
  asyncHandler((request, response) => salesOrdersController.list(request, response)),
);
salesOrdersRouter.get(
  '/:id',
  asyncHandler((request, response) => salesOrdersController.show(request, response)),
);
