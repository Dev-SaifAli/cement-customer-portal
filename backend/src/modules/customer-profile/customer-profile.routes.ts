import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  requireCustomerAuth,
  requireCustomerRole,
} from '../customer-auth/customer-auth.middleware.js';
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
  requireCustomerRole('CUSTOMER_ADMIN'),
  asyncHandler(customerProfileController.update.bind(customerProfileController)),
);
