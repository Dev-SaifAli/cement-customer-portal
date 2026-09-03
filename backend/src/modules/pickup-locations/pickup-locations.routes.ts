import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  requireCustomerAuth,
  requireCustomerRole,
} from '../customer-auth/customer-auth.middleware.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { pickupLocationsController as c } from './pickup-locations.controller.js';
import { pickupLocationsService } from './pickup-locations.service.js';

export const adminPickupLocationsRouter = Router();
adminPickupLocationsRouter.use(requireSalesAuth, requireSalesRole('PRICING_ADMIN'));
adminPickupLocationsRouter.get('/', asyncHandler(c.list.bind(c)));
adminPickupLocationsRouter.post('/', asyncHandler(c.create.bind(c)));
adminPickupLocationsRouter.get('/:id', asyncHandler(c.show.bind(c)));
adminPickupLocationsRouter.patch('/:id', asyncHandler(c.update.bind(c)));

export const customerPickupLocationsRouter = Router();
customerPickupLocationsRouter.use(
  requireCustomerAuth,
  requireCustomerRole('CUSTOMER_ADMIN', 'PURCHASER'),
);
customerPickupLocationsRouter.get('/', asyncHandler(async (_request, response) => {
  response.json({ success: true, data: { locations: await pickupLocationsService.listActive() } });
}));
