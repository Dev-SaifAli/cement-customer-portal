import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerContractsController } from './customer-contracts.controller.js';

export const customerContractsRouter = Router();

customerContractsRouter.use(requireCustomerAuth);

customerContractsRouter.get(
  '/',
  asyncHandler((request, response) => customerContractsController.list(request, response)),
);

customerContractsRouter.get(
  '/:id',
  asyncHandler((request, response) => customerContractsController.show(request, response)),
);
