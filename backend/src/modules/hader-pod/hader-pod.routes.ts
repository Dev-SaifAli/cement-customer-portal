import express, { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { maxRegistrationDocumentSizeBytes } from '../registration-documents/registration-document.constants.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { haderPodController as controller } from './hader-pod.controller.js';

const podAccess = requireSalesRole('HADER_MANAGER', 'HADER_OPERATIONS', 'DELIVERY_TEAM_USER');

export const haderPodRouter = Router();
haderPodRouter.use(requireSalesAuth, podAccess);
haderPodRouter.post(
  '/:shipmentId/pod',
  asyncHandler(controller.create.bind(controller)),
);
haderPodRouter.get(
  '/:shipmentId/pod',
  asyncHandler(controller.show.bind(controller)),
);
haderPodRouter.patch(
  '/:shipmentId/pod',
  asyncHandler(controller.update.bind(controller)),
);
haderPodRouter.put(
  '/:shipmentId/pod/documents/:documentType',
  express.raw({ limit: maxRegistrationDocumentSizeBytes, type: '*/*' }),
  asyncHandler(controller.uploadDocument.bind(controller)),
);
haderPodRouter.get(
  '/:shipmentId/pod/documents/:documentId',
  asyncHandler(controller.document.bind(controller)),
);
