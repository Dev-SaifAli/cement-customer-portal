import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { salesQuotationsController } from './sales-quotations.controller.js';

export const salesQuotationsRouter = Router();
salesQuotationsRouter.use(requireSalesAuth);
salesQuotationsRouter.use(requireSalesRole('SALES_REP', 'HADER_MANAGER', 'PRICE_MANAGER'));

salesQuotationsRouter.get(
  '/',
  asyncHandler((req, res) => salesQuotationsController.list(req, res)),
);
salesQuotationsRouter.get(
  '/:id',
  asyncHandler((req, res) => salesQuotationsController.show(req, res)),
);
salesQuotationsRouter.post(
  '/:id/contract',
  asyncHandler((req, res) => salesQuotationsController.createContract(req, res)),
);
salesQuotationsRouter.post(
  '/:id/start-review',
  asyncHandler((req, res) => salesQuotationsController.startReview(req, res)),
);
salesQuotationsRouter.patch(
  '/:id/pricing',
  asyncHandler((req, res) => salesQuotationsController.updatePricing(req, res)),
);
salesQuotationsRouter.post(
  '/:id/submit-approval',
  asyncHandler((req, res) => salesQuotationsController.submitApproval(req, res)),
);
salesQuotationsRouter.post(
  '/:id/approve',
  asyncHandler((req, res) => salesQuotationsController.approve(req, res)),
);
salesQuotationsRouter.post(
  '/:id/reject',
  asyncHandler((req, res) => salesQuotationsController.reject(req, res)),
);
salesQuotationsRouter.post(
  '/:id/send-to-customer',
  asyncHandler((req, res) => salesQuotationsController.sendToCustomer(req, res)),
);
