import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { customerUsersController } from './customer-users.controller.js';

export const customerUsersRouter = Router();

customerUsersRouter.use(requireCustomerAuth);

customerUsersRouter.get(
  '/',
  asyncHandler(customerUsersController.index.bind(customerUsersController)),
);

customerUsersRouter.post(
  '/',
  asyncHandler(customerUsersController.create.bind(customerUsersController)),
);

customerUsersRouter.get(
  '/:id',
  asyncHandler(customerUsersController.show.bind(customerUsersController)),
);

customerUsersRouter.patch(
  '/:id',
  asyncHandler(customerUsersController.update.bind(customerUsersController)),
);
