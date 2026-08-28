import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerOrdersController } from './customer-orders.controller.js';

export const customerOrdersRouter = Router();

customerOrdersRouter.use(requireCustomerAuth);
customerOrdersRouter.post(
  '/price',
  asyncHandler((request, response) => customerOrdersController.priceDirect(request, response)),
);
customerOrdersRouter.post(
  '/',
  asyncHandler((request, response) => customerOrdersController.createDirect(request, response)),
);
customerOrdersRouter.get(
  '/',
  asyncHandler((request, response) => customerOrdersController.list(request, response)),
);
customerOrdersRouter.get(
  '/:id',
  asyncHandler((request, response) => customerOrdersController.show(request, response)),
);
