import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { salesContractsController } from './sales-contracts.controller.js';

export const salesContractsRouter = Router();

salesContractsRouter.use(requireSalesAuth);

salesContractsRouter.get(
  '/',
  requireSalesRole('SALES_REP', 'COMMERCIAL_DIRECTOR'),
  asyncHandler((request, response) => salesContractsController.list(request, response)),
);

salesContractsRouter.post(
  '/',
  requireSalesRole('SALES_REP'),
  asyncHandler((request, response) => salesContractsController.create(request, response)),
);

salesContractsRouter.get(
  '/:id',
  requireSalesRole('SALES_REP', 'COMMERCIAL_DIRECTOR'),
  asyncHandler((request, response) => salesContractsController.show(request, response)),
);

salesContractsRouter.patch(
  '/:id',
  requireSalesRole('SALES_REP'),
  asyncHandler((request, response) => salesContractsController.update(request, response)),
);

salesContractsRouter.post(
  '/:id/submit',
  requireSalesRole('SALES_REP'),
  asyncHandler((request, response) => salesContractsController.submit(request, response)),
);

salesContractsRouter.post(
  '/:id/approve',
  requireSalesRole('COMMERCIAL_DIRECTOR'),
  asyncHandler((request, response) => salesContractsController.approve(request, response)),
);

salesContractsRouter.post(
  '/:id/reject',
  requireSalesRole('COMMERCIAL_DIRECTOR'),
  asyncHandler((request, response) => salesContractsController.reject(request, response)),
);

salesContractsRouter.post(
  '/:id/extend',
  requireSalesRole('SALES_REP'),
  asyncHandler((request, response) => salesContractsController.extend(request, response)),
);
