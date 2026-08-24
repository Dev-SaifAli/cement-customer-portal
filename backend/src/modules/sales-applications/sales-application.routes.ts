import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { registrationDocumentController } from '../registration-documents/registration-document.controller.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { salesApplicationController } from './sales-application.controller.js';

export const salesApplicationRouter = Router();

salesApplicationRouter.use(requireSalesAuth);
salesApplicationRouter.use(requireSalesRole('SALES_REP'));

salesApplicationRouter.get(
  '/',
  asyncHandler((request, response) => salesApplicationController.list(request, response)),
);

salesApplicationRouter.get(
  '/filter-options',
  asyncHandler((request, response) => salesApplicationController.filterOptions(request, response)),
);

salesApplicationRouter.get(
  '/:id',
  asyncHandler((request, response) => salesApplicationController.get(request, response)),
);

salesApplicationRouter.get(
  '/:id/documents/:documentId',
  asyncHandler((request, response) =>
    registrationDocumentController.streamForSales(request, response),
  ),
);

salesApplicationRouter.post(
  '/:id/activate',
  asyncHandler((request, response) => salesApplicationController.activate(request, response)),
);

salesApplicationRouter.patch(
  '/:id/status',
  asyncHandler((request, response) => salesApplicationController.updateStatus(request, response)),
);
