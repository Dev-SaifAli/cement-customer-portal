import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerOrdersController } from './customer-orders.controller.js';

export const customerContractOrdersRouter = Router({ mergeParams: true });

customerContractOrdersRouter.use(requireCustomerAuth);
customerContractOrdersRouter.post(
  '/',
  asyncHandler((request, response) => customerOrdersController.create(request, response)),
);
