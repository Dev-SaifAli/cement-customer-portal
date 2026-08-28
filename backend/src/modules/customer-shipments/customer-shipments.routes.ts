import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerShipmentsController } from './customer-shipments.controller.js';

export const customerShipmentsRouter = Router();

customerShipmentsRouter.use(requireCustomerAuth);
customerShipmentsRouter.get(
  '/',
  asyncHandler((request, response) => customerShipmentsController.list(request, response)),
);
customerShipmentsRouter.get(
  '/:id',
  asyncHandler((request, response) => customerShipmentsController.show(request, response)),
);
