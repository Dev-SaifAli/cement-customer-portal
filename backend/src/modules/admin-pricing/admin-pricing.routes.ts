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
