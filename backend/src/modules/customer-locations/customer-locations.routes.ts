import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerLocationsController } from './customer-locations.controller.js';

export const customerLocationsRouter = Router();

customerLocationsRouter.use(requireCustomerAuth);

customerLocationsRouter.get(
  '/',
  asyncHandler(customerLocationsController.list.bind(customerLocationsController)),
);
customerLocationsRouter.get(
  '/cities',
  asyncHandler(customerLocationsController.listCities.bind(customerLocationsController)),
);
customerLocationsRouter.post(
  '/',
  asyncHandler(customerLocationsController.create.bind(customerLocationsController)),
);
customerLocationsRouter.patch(
  '/:id',
  asyncHandler(customerLocationsController.update.bind(customerLocationsController)),
);
customerLocationsRouter.delete(
  '/:id',
  asyncHandler(customerLocationsController.delete.bind(customerLocationsController)),
);
customerLocationsRouter.patch(
  '/:id/primary',
  asyncHandler(customerLocationsController.setPrimary.bind(customerLocationsController)),
);
