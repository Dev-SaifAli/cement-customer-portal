import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  requireCustomerAuth,
  requireCustomerRole,
} from '../customer-auth/customer-auth.middleware.js';
import { customerLocationsController } from './customer-locations.controller.js';

export const customerLocationsRouter = Router();

customerLocationsRouter.use(
  requireCustomerAuth,
  requireCustomerRole('CUSTOMER_ADMIN', 'PURCHASER'),
);

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
  requireCustomerRole('CUSTOMER_ADMIN'),
  asyncHandler(customerLocationsController.create.bind(customerLocationsController)),
);
customerLocationsRouter.patch(
  '/:id',
  requireCustomerRole('CUSTOMER_ADMIN'),
  asyncHandler(customerLocationsController.update.bind(customerLocationsController)),
);
customerLocationsRouter.delete(
  '/:id',
  requireCustomerRole('CUSTOMER_ADMIN'),
  asyncHandler(customerLocationsController.delete.bind(customerLocationsController)),
);
customerLocationsRouter.patch(
  '/:id/primary',
  requireCustomerRole('CUSTOMER_ADMIN'),
  asyncHandler(customerLocationsController.setPrimary.bind(customerLocationsController)),
);
