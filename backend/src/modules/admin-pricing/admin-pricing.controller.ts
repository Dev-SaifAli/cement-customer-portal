import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { adminPricingService } from './admin-pricing.service.js';
import {
  cityParamsSchema,
  productPriceParamsSchema,
  updateHaderCitySchema,
  upsertDeliveryPriceSchema,
  upsertProductPriceSchema,
} from './admin-pricing.validation.js';

export class AdminPricingController {
  async index(request: SalesAuthenticatedRequest, response: Response) {
    requirePricingAdmin(request);
    response
      .status(200)
      .json({ success: true, data: await adminPricingService.getConfiguration() });
  }

  async upsertProductPrice(request: SalesAuthenticatedRequest, response: Response) {
    const user = requirePricingAdmin(request);
    const { productId } = productPriceParamsSchema.parse(request.params);
    const input = upsertProductPriceSchema.parse(request.body);
    response.status(200).json({
      success: true,
      data: { price: await adminPricingService.upsertProductPrice(productId, input, user) },
    });
  }

  async upsertDeliveryPrice(request: SalesAuthenticatedRequest, response: Response) {
    const user = requirePricingAdmin(request);
    const input = upsertDeliveryPriceSchema.parse(request.body);
    response.status(200).json({
      success: true,
      data: { price: await adminPricingService.upsertDeliveryPrice(input, user) },
    });
  }

  async setHaderEnabled(request: SalesAuthenticatedRequest, response: Response) {
    requirePricingAdmin(request);
    const { cityId } = cityParamsSchema.parse(request.params);
    const { isHaderEnabled } = updateHaderCitySchema.parse(request.body);
    response.status(200).json({
      success: true,
      data: { city: await adminPricingService.setHaderEnabled(cityId, isHaderEnabled) },
    });
  }
}

export const adminPricingController = new AdminPricingController();

function requirePricingAdmin(request: SalesAuthenticatedRequest) {
  const user = request.salesUser;
  if (!user) throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
  if (user.role !== 'PRICING_ADMIN') {
    throw new AppError(
      'You are not authorized to configure this pricing master.',
      403,
      'PRICING_CONFIGURATION_FORBIDDEN',
    );
  }
  return user;
}
