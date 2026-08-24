import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerDashboardController } from './customer-dashboard.controller.js';

export const customerDashboardRouter = Router();

customerDashboardRouter.get(
  '/',
  requireCustomerAuth,
  asyncHandler(customerDashboardController.show.bind(customerDashboardController)),
);
