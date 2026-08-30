import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { adminUsersService } from './admin-users.service.js';
import {
  adminUserIdSchema,
  adminUserListSchema,
  createAdminUserSchema,
  updateAdminUserSchema,
} from './admin-users.validation.js';

export class AdminUsersController {
  async list(request: SalesAuthenticatedRequest, response: Response) {
    const input = adminUserListSchema.parse(request.query);
    response.json({ success: true, data: await adminUsersService.list(input) });
  }

  async get(request: SalesAuthenticatedRequest, response: Response) {
    const { id } = adminUserIdSchema.parse(request.params);
    response.json({ success: true, data: { user: await adminUsersService.get(id) } });
  }

  async create(request: SalesAuthenticatedRequest, response: Response) {
    const input = createAdminUserSchema.parse(request.body);
    response.status(201).json({ success: true, data: { user: await adminUsersService.create(input) } });
  }

  async update(request: SalesAuthenticatedRequest, response: Response) {
    const { id } = adminUserIdSchema.parse(request.params);
    const input = updateAdminUserSchema.parse(request.body);
    const actor = request.salesUser;
    if (!actor) {
      throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
    }
    response.json({
      success: true,
      data: { user: await adminUsersService.update(id, input, actor.id) },
    });
  }
}

export const adminUsersController = new AdminUsersController();
