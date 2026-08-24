import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerProfileController } from './customer-profile.controller.js';

export const customerProfileRouter = Router();

customerProfileRouter.get(
  '/',
  requireCustomerAuth,
  asyncHandler(customerProfileController.show.bind(customerProfileController)),
);

customerProfileRouter.patch(
  '/',
  requireCustomerAuth,
  asyncHandler(customerProfileController.update.bind(customerProfileController)),
);
