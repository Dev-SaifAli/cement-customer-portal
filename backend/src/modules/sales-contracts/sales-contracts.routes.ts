import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { salesContractsController } from './sales-contracts.controller.js';

export const salesContractsRouter = Router();

salesContractsRouter.use(requireSalesAuth);
salesContractsRouter.use(requireSalesRole('SALES_REP'));

salesContractsRouter.get(
  '/',
  asyncHandler((request, response) => salesContractsController.list(request, response)),
);

salesContractsRouter.post(
  '/',
  asyncHandler((request, response) => salesContractsController.create(request, response)),
);

salesContractsRouter.get(
  '/:id',
  asyncHandler((request, response) => salesContractsController.show(request, response)),
);

salesContractsRouter.patch(
  '/:id',
  asyncHandler((request, response) => salesContractsController.update(request, response)),
);

salesContractsRouter.post(
  '/:id/submit',
  asyncHandler((request, response) => salesContractsController.submit(request, response)),
);

salesContractsRouter.post(
  '/:id/activate',
  asyncHandler((request, response) => salesContractsController.activate(request, response)),
);

salesContractsRouter.post(
  '/:id/extend',
  asyncHandler((request, response) => salesContractsController.extend(request, response)),
);
