import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerQuotationsController } from './customer-quotations.controller.js';

export const customerQuotationsRouter = Router();

customerQuotationsRouter.use(requireCustomerAuth);

customerQuotationsRouter.get(
  '/pickup-locations',
  asyncHandler(customerQuotationsController.pickupLocations.bind(customerQuotationsController)),
);

customerQuotationsRouter.get(
  '/',
  asyncHandler(customerQuotationsController.list.bind(customerQuotationsController)),
);

customerQuotationsRouter.post(
  '/',
  asyncHandler(customerQuotationsController.create.bind(customerQuotationsController)),
);

customerQuotationsRouter.get(
  '/:id',
  asyncHandler(customerQuotationsController.show.bind(customerQuotationsController)),
);

customerQuotationsRouter.patch(
  '/:id',
  asyncHandler(customerQuotationsController.update.bind(customerQuotationsController)),
);

customerQuotationsRouter.post(
  '/:id/submit',
  asyncHandler(customerQuotationsController.submit.bind(customerQuotationsController)),
);
