import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { applicationController } from './application.controller.js';

export const applicationRouter = Router();

applicationRouter.post(
  '/status',
  asyncHandler((request, response) => applicationController.lookupStatus(request, response)),
);

applicationRouter.get(
  '/:reference/status',
  asyncHandler((request, response) => applicationController.getStatus(request, response)),
);
