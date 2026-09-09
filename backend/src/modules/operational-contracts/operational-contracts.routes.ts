import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { operationalContractsController } from './operational-contracts.controller.js';

export const operationalContractsRouter = Router();
operationalContractsRouter.use(requireSalesAuth, requireSalesRole('HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER'));
operationalContractsRouter.get('/access', asyncHandler(operationalContractsController.access.bind(operationalContractsController)));
operationalContractsRouter.get('/filters', asyncHandler(operationalContractsController.filters.bind(operationalContractsController)));
operationalContractsRouter.get('/', asyncHandler(operationalContractsController.list.bind(operationalContractsController)));
operationalContractsRouter.get('/:id', asyncHandler(operationalContractsController.show.bind(operationalContractsController)));
operationalContractsRouter.post('/:id/orders', asyncHandler(operationalContractsController.createOrder.bind(operationalContractsController)));
