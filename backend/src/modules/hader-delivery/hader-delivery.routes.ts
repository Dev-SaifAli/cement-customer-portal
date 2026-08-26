import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { haderDeliveryController } from './hader-delivery.controller.js';

const haderRoles = requireSalesRole('HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER');
export const haderDeliveryRequestsRouter = Router();
export const haderShipmentsRouter = Router();
for (const router of [haderDeliveryRequestsRouter, haderShipmentsRouter]) {
  router.use(requireSalesAuth);
  router.use(haderRoles);
}
haderDeliveryRequestsRouter.get(
  '/',
  asyncHandler(haderDeliveryController.listRequests.bind(haderDeliveryController)),
);
haderDeliveryRequestsRouter.get(
  '/:id',
  asyncHandler(haderDeliveryController.showRequest.bind(haderDeliveryController)),
);
haderDeliveryRequestsRouter.post(
  '/:id/approve',
  asyncHandler(haderDeliveryController.approve.bind(haderDeliveryController)),
);
haderDeliveryRequestsRouter.post(
  '/:id/reject',
  asyncHandler(haderDeliveryController.reject.bind(haderDeliveryController)),
);
haderDeliveryRequestsRouter.post(
  '/:id/create-shipment',
  asyncHandler(haderDeliveryController.createShipment.bind(haderDeliveryController)),
);
haderShipmentsRouter.get(
  '/',
  asyncHandler(haderDeliveryController.listShipments.bind(haderDeliveryController)),
);
haderShipmentsRouter.get(
  '/:id',
  asyncHandler(haderDeliveryController.showShipment.bind(haderDeliveryController)),
);

export const salesShipmentsRouter = Router();
salesShipmentsRouter.use(requireSalesAuth, requireSalesRole('SALES_REP'));
salesShipmentsRouter.get(
  '/',
  asyncHandler(haderDeliveryController.listShipments.bind(haderDeliveryController)),
);
salesShipmentsRouter.get(
  '/:id',
  asyncHandler(haderDeliveryController.showShipment.bind(haderDeliveryController)),
);
