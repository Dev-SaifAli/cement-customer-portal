import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { registrationController } from './registration.controller.js';

export const registrationRouter = Router();

registrationRouter.post(
  '/',
  asyncHandler((request, response) => registrationController.create(request, response)),
);

registrationRouter.get(
  '/:id',
  asyncHandler((request, response) => registrationController.get(request, response)),
);

registrationRouter.patch(
  '/:id',
  asyncHandler((request, response) => registrationController.update(request, response)),
);

registrationRouter.post(
  '/:id/submit',
  asyncHandler((request, response) => registrationController.submit(request, response)),
);
