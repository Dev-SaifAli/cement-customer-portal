import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireCustomerAuth } from '../customer-auth/customer-auth.middleware.js';
import { requireSalesAuth, requireSalesRole } from '../sales-auth/sales-auth.middleware.js';
import { customerTicketsController } from './customer-tickets.controller.js';

export const customerTicketsRouter = Router();
export const salesTicketsRouter = Router();

customerTicketsRouter.use(requireCustomerAuth);
customerTicketsRouter.get(
  '/',
  asyncHandler((request, response) =>
    customerTicketsController.listCustomer(request, response),
  ),
);
customerTicketsRouter.post(
  '/',
  asyncHandler((request, response) =>
    customerTicketsController.createCustomer(request, response),
  ),
);
customerTicketsRouter.get(
  '/:id',
  asyncHandler((request, response) =>
    customerTicketsController.showCustomer(request, response),
  ),
);
customerTicketsRouter.patch(
  '/:id',
  asyncHandler((request, response) =>
    customerTicketsController.updateCustomerDraft(request, response),
  ),
);
customerTicketsRouter.post(
  '/:id/submit',
  asyncHandler((request, response) =>
    customerTicketsController.submitCustomer(request, response),
  ),
);
customerTicketsRouter.delete(
  '/:id',
  asyncHandler((request, response) =>
    customerTicketsController.deleteCustomer(request, response),
  ),
);

salesTicketsRouter.use(requireSalesAuth, requireSalesRole('SALES_REP'));
salesTicketsRouter.get(
  '/',
  asyncHandler((request, response) => customerTicketsController.listSales(request, response)),
);
salesTicketsRouter.get(
  '/:id',
  asyncHandler((request, response) => customerTicketsController.showSales(request, response)),
);
salesTicketsRouter.post(
  '/:id/send-to-crm',
  asyncHandler((request, response) => customerTicketsController.sendToCrm(request, response)),
);
