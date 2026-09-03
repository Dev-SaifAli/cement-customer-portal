import express, { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  requireCustomerAuth,
  requireCustomerRole,
} from '../customer-auth/customer-auth.middleware.js';
import { maxRegistrationDocumentSizeBytes } from '../registration-documents/registration-document.constants.js';
import { customerFleetController } from './customer-fleet.controller.js';

export const customerTrucksRouter = Router();
export const customerDriversRouter = Router();
customerTrucksRouter.use(requireCustomerAuth, requireCustomerRole('CUSTOMER_ADMIN'));
customerDriversRouter.use(requireCustomerAuth, requireCustomerRole('CUSTOMER_ADMIN'));

customerTrucksRouter.get(
  '/',
  asyncHandler(customerFleetController.listTrucks.bind(customerFleetController)),
);
customerTrucksRouter.post(
  '/',
  asyncHandler(customerFleetController.createTruck.bind(customerFleetController)),
);
customerTrucksRouter.patch(
  '/:id',
  asyncHandler(customerFleetController.updateTruck.bind(customerFleetController)),
);
customerTrucksRouter.put(
  '/:id/documents/:documentType',
  express.raw({ limit: maxRegistrationDocumentSizeBytes, type: '*/*' }),
  asyncHandler(customerFleetController.uploadTruckDocument.bind(customerFleetController)),
);
customerTrucksRouter.get(
  '/:id/documents/:documentId',
  asyncHandler(customerFleetController.streamTruckDocument.bind(customerFleetController)),
);

customerDriversRouter.get(
  '/',
  asyncHandler(customerFleetController.listDrivers.bind(customerFleetController)),
);
customerDriversRouter.post(
  '/',
  asyncHandler(customerFleetController.createDriver.bind(customerFleetController)),
);
customerDriversRouter.patch(
  '/:id',
  asyncHandler(customerFleetController.updateDriver.bind(customerFleetController)),
);
customerDriversRouter.put(
  '/:id/documents/:documentType',
  express.raw({ limit: maxRegistrationDocumentSizeBytes, type: '*/*' }),
  asyncHandler(customerFleetController.uploadDriverDocument.bind(customerFleetController)),
);
customerDriversRouter.get(
  '/:id/documents/:documentId',
  asyncHandler(customerFleetController.streamDriverDocument.bind(customerFleetController)),
);
