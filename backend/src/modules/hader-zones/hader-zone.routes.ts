import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { haderZoneController } from './hader-zone.controller.js';

export const adminHaderCitiesRouter = Router();
adminHaderCitiesRouter.use(
  requireSalesAuth,
  requireSalesRole('PRICING_ADMIN', 'HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER'),
);
adminHaderCitiesRouter.get(
  '/',
  asyncHandler((request, response) => haderZoneController.list(request, response)),
);
adminHaderCitiesRouter.get(
  '/:cityId/boundary',
  asyncHandler((request, response) => haderZoneController.show(request, response)),
);
adminHaderCitiesRouter.put(
  '/:cityId/boundary',
  requireSalesRole('PRICING_ADMIN', 'HADER_MANAGER', 'HADER_OPERATIONS'),
  asyncHandler((request, response) => haderZoneController.save(request, response)),
);
adminHaderCitiesRouter.delete(
  '/:cityId/boundary',
  requireSalesRole('PRICING_ADMIN', 'HADER_MANAGER', 'HADER_OPERATIONS'),
  asyncHandler((request, response) => haderZoneController.clear(request, response)),
);

export const customerLocationValidationRouter = Router();
customerLocationValidationRouter.use(requireCustomerAuth);
customerLocationValidationRouter.post(
  '/validate-hader-zone',
  asyncHandler((request, response) => haderZoneController.validate(request, response)),
);
