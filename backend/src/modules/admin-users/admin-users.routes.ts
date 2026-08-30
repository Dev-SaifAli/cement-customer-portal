import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { adminUsersController } from './admin-users.controller.js';

export const adminUsersRouter = Router();
adminUsersRouter.use(
  requireSalesAuth,
  requireSalesRole('PORTAL_ADMINISTRATOR'),
);
adminUsersRouter.get('/', asyncHandler((req, res) => adminUsersController.list(req, res)));
adminUsersRouter.post('/', asyncHandler((req, res) => adminUsersController.create(req, res)));
adminUsersRouter.get('/:id', asyncHandler((req, res) => adminUsersController.get(req, res)));
adminUsersRouter.patch('/:id', asyncHandler((req, res) => adminUsersController.update(req, res)));
