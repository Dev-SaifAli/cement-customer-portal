import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth } from '../sales-auth/sales-auth.middleware.js';
import { adminPricingController } from './admin-pricing.controller.js';

export const adminPricingRouter = Router();
adminPricingRouter.use(requireSalesAuth);
adminPricingRouter.get(
  '/',
  asyncHandler((req, res) => adminPricingController.index(req, res)),
);
adminPricingRouter.get(
  '/approval-settings',
  asyncHandler((req, res) => adminPricingController.getApprovalSettings(req, res)),
);
adminPricingRouter.put(
  '/approval-settings/list-price-direct-order',
  asyncHandler((req, res) => adminPricingController.updateListPriceDirectOrderApproval(req, res)),
);
adminPricingRouter.put(
  '/approval-settings/contract-order-creation/:actor',
  asyncHandler((req, res) => adminPricingController.updateContractOrderCreation(req, res)),
);
adminPricingRouter.put(
  '/products/:productId',
  asyncHandler((req, res) => adminPricingController.upsertProductPrice(req, res)),
);
adminPricingRouter.put(
  '/delivery',
  asyncHandler((req, res) => adminPricingController.upsertDeliveryPrice(req, res)),
);
adminPricingRouter.put(
  '/cities/:cityId/hader',
  asyncHandler((req, res) => adminPricingController.setHaderEnabled(req, res)),
);
