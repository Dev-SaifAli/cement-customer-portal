import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { taxConfigurationsController as controller } from './tax-configurations.controller.js';

export const adminTaxConfigurationsRouter = Router();

adminTaxConfigurationsRouter.use(requireSalesAuth, requireSalesRole('PRICING_ADMIN'));
adminTaxConfigurationsRouter.get('/', asyncHandler(controller.list.bind(controller)));
adminTaxConfigurationsRouter.get('/:id', asyncHandler(controller.show.bind(controller)));
adminTaxConfigurationsRouter.post('/', asyncHandler(controller.create.bind(controller)));
adminTaxConfigurationsRouter.patch('/:id', asyncHandler(controller.update.bind(controller)));
