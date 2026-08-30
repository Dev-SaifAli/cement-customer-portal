import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { haderDeliveryTeamController as controller } from './hader-delivery-team.controller.js';

const access = requireSalesRole('HADER_MANAGER', 'HADER_OPERATIONS', 'DELIVERY_TEAM_USER');

export const haderDeliveryTeamRouter = Router();
haderDeliveryTeamRouter.use(requireSalesAuth, access);
haderDeliveryTeamRouter.get('/', asyncHandler(controller.list.bind(controller)));
haderDeliveryTeamRouter.get('/:id', asyncHandler(controller.detail.bind(controller)));

export const haderDeliveryTeamActionsRouter = Router();
haderDeliveryTeamActionsRouter.post(
  '/:shipmentId/start-delivery',
  requireSalesAuth,
  access,
  asyncHandler(controller.startDelivery.bind(controller)),
);
haderDeliveryTeamActionsRouter.post(
  '/:shipmentId/deliver',
  requireSalesAuth,
  access,
  asyncHandler(controller.deliver.bind(controller)),
);
haderDeliveryTeamActionsRouter.post(
  '/:shipmentId/close',
  requireSalesAuth,
  access,
  asyncHandler(controller.close.bind(controller)),
);
