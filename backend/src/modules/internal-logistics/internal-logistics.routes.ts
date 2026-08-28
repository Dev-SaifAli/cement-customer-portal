import express, { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { maxRegistrationDocumentSizeBytes } from '../registration-documents/registration-document.constants.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { internalLogisticsController as c } from './internal-logistics.controller.js';

export const internalLogisticsRouter = Router();
const manage = requireSalesRole('PRICING_ADMIN');
const viewFleet = requireSalesRole('PRICING_ADMIN');
internalLogisticsRouter.use(requireSalesAuth);

internalLogisticsRouter.get('/transporters', manage, asyncHandler(c.transporters.bind(c)));
internalLogisticsRouter.post('/transporters', manage, asyncHandler(c.createTransporter.bind(c)));
internalLogisticsRouter.patch(
  '/transporters/:id',
  manage,
  asyncHandler(c.updateTransporter.bind(c)),
);
internalLogisticsRouter.get('/transporter-costs', manage, asyncHandler(c.costs.bind(c)));
internalLogisticsRouter.post('/transporter-costs', manage, asyncHandler(c.createCost.bind(c)));
internalLogisticsRouter.patch('/transporter-costs/:id', manage, asyncHandler(c.updateCost.bind(c)));
internalLogisticsRouter.get('/fleet', viewFleet, asyncHandler(c.trucks.bind(c)));
internalLogisticsRouter.post('/fleet', manage, asyncHandler(c.createTruck.bind(c)));
internalLogisticsRouter.patch('/fleet/:id', manage, asyncHandler(c.updateTruck.bind(c)));
internalLogisticsRouter.get('/drivers', viewFleet, asyncHandler(c.drivers.bind(c)));
internalLogisticsRouter.post('/drivers', manage, asyncHandler(c.createDriver.bind(c)));
internalLogisticsRouter.patch('/drivers/:id', manage, asyncHandler(c.updateDriver.bind(c)));
internalLogisticsRouter.get('/logistics-reference', viewFleet, asyncHandler(c.reference.bind(c)));
internalLogisticsRouter.put(
  '/:entityType/:id/documents/:documentType',
  manage,
  express.raw({ limit: maxRegistrationDocumentSizeBytes, type: '*/*' }),
  asyncHandler(c.upload.bind(c)),
);
internalLogisticsRouter.get(
  '/:entityType/:id/documents/:documentId',
  viewFleet,
  asyncHandler(c.document.bind(c)),
);
