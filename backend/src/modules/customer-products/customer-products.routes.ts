import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerProductsController } from './customer-products.controller.js';

export const customerProductsRouter = Router();

customerProductsRouter.use(requireCustomerAuth);

customerProductsRouter.get(
  '/',
  asyncHandler(customerProductsController.list.bind(customerProductsController)),
);
