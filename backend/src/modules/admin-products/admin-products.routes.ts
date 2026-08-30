import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth } from '../sales-auth/sales-auth.middleware.js';
import { adminProductsController } from './admin-products.controller.js';

export const adminProductsRouter = Router();
adminProductsRouter.use(requireSalesAuth);
adminProductsRouter.get('/', asyncHandler((req, res) => adminProductsController.list(req, res)));
adminProductsRouter.post('/', asyncHandler((req, res) => adminProductsController.create(req, res)));
adminProductsRouter.post('/bulk-action', asyncHandler((req, res) => adminProductsController.bulk(req, res)));
adminProductsRouter.get('/:id', asyncHandler((req, res) => adminProductsController.get(req, res)));
adminProductsRouter.patch('/:id', asyncHandler((req, res) => adminProductsController.update(req, res)));

export const adminProductOptionsRouter = Router();
adminProductOptionsRouter.use(requireSalesAuth);
adminProductOptionsRouter.get('/bag-sizes', asyncHandler((req, res) => adminProductsController.listBagSizes(req, res)));
adminProductOptionsRouter.post('/bag-sizes', asyncHandler((req, res) => adminProductsController.createBagSize(req, res)));
