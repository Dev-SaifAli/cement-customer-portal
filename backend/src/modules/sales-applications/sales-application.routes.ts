import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth } from '../sales-auth/sales-auth.middleware.js';
import { salesApplicationController } from './sales-application.controller.js';

export const salesApplicationRouter = Router();

salesApplicationRouter.use(requireSalesAuth);

salesApplicationRouter.get(
  '/',
  asyncHandler((request, response) => salesApplicationController.list(request, response)),
);

salesApplicationRouter.get(
  '/:id',
  asyncHandler((request, response) => salesApplicationController.get(request, response)),
);

salesApplicationRouter.patch(
  '/:id/status',
  asyncHandler((request, response) => salesApplicationController.updateStatus(request, response)),
);
