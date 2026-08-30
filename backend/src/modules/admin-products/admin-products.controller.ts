import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { adminProductsService } from './admin-products.service.js';
import { bagSizeCreateSchema, bagSizeListSchema, bulkProductActionSchema, productInputSchema, productListSchema, productParamsSchema, productUpdateSchema } from './admin-products.validation.js';

export class AdminProductsController {
  async listBagSizes(req: SalesAuthenticatedRequest, res: Response) { requireAdmin(req); const input = bagSizeListSchema.parse(req.query); res.json({ success: true, data: await adminProductsService.listBagSizes(input.search) }); }
  async createBagSize(req: SalesAuthenticatedRequest, res: Response) { const user = requireAdmin(req); const input = bagSizeCreateSchema.parse(req.body); res.status(201).json({ success: true, data: { bagSize: await adminProductsService.createBagSize(input.unitWeightKg, user) } }); }
  async list(req: SalesAuthenticatedRequest, res: Response) { requireAdmin(req); const input = productListSchema.parse(req.query); res.json({ success: true, data: await adminProductsService.list(input) }); }
  async get(req: SalesAuthenticatedRequest, res: Response) { requireAdmin(req); const { id } = productParamsSchema.parse(req.params); res.json({ success: true, data: await adminProductsService.get(id) }); }
  async create(req: SalesAuthenticatedRequest, res: Response) { const user = requireAdmin(req); const input = productInputSchema.parse(req.body); res.status(201).json({ success: true, data: { product: await adminProductsService.create(input, user) } }); }
  async update(req: SalesAuthenticatedRequest, res: Response) { const user = requireAdmin(req); const { id } = productParamsSchema.parse(req.params); const input = productUpdateSchema.parse(req.body); res.json({ success: true, data: { product: await adminProductsService.update(id, input, user) } }); }
  async bulk(req: SalesAuthenticatedRequest, res: Response) { const user = requireAdmin(req); const input = bulkProductActionSchema.parse(req.body); res.json({ success: true, data: await adminProductsService.bulk(input.ids, input.action, user) }); }
}
export const adminProductsController = new AdminProductsController();
function requireAdmin(req: SalesAuthenticatedRequest) {
  if (!req.salesUser) throw new AppError('Authentication is required.', 401, 'SALES_AUTH_REQUIRED');
  if (req.salesUser.role !== 'PRICING_ADMIN') throw new AppError('You are not authorized to manage products.', 403, 'PRODUCT_ADMIN_FORBIDDEN');
  return req.salesUser;
}
