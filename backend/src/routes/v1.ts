import { Router } from 'express';
import { applicationRouter } from '../modules/applications/application.routes.js';
import { adminPricingRouter } from '../modules/admin-pricing/admin-pricing.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { customerAuthRouter } from '../modules/customer-auth/customer-auth.routes.js';
import { customerContractsRouter } from '../modules/customer-contracts/customer-contracts.routes.js';
import { customerDashboardRouter } from '../modules/customer-dashboard/customer-dashboard.routes.js';
import {
  customerDriversRouter,
  customerTrucksRouter,
} from '../modules/customer-fleet/customer-fleet.routes.js';
import { customerLocationsRouter } from '../modules/customer-locations/customer-locations.routes.js';
import { customerContractOrdersRouter } from '../modules/customer-orders/customer-orders.routes.js';
import { customerOrdersRouter } from '../modules/customer-orders/customer-orders.collection.routes.js';
import { customerProductsRouter } from '../modules/customer-products/customer-products.routes.js';
import { customerProfileRouter } from '../modules/customer-profile/customer-profile.routes.js';
import { customerQuotationsRouter } from '../modules/customer-quotations/customer-quotations.routes.js';
import { customerUsersRouter } from '../modules/customer-users/customer-users.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { registrationRouter } from '../modules/registrations/registration.routes.js';
import { salesApplicationRouter } from '../modules/sales-applications/sales-application.routes.js';
import { salesAuthRouter } from '../modules/sales-auth/sales-auth.routes.js';
import { salesContractsRouter } from '../modules/sales-contracts/sales-contracts.routes.js';
import { salesOrdersRouter } from '../modules/sales-orders/sales-orders.routes.js';
import { salesQuotationsRouter } from '../modules/sales-quotations/sales-quotations.routes.js';

export const v1Router = Router();
v1Router.use('/admin/product-prices', adminPricingRouter);
v1Router.use('/applications', applicationRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/customer/auth', customerAuthRouter);
v1Router.use('/customer/contracts/:contractId/orders', customerContractOrdersRouter);
v1Router.use('/customer/contracts', customerContractsRouter);
v1Router.use('/customer/dashboard', customerDashboardRouter);
v1Router.use('/customer/trucks', customerTrucksRouter);
v1Router.use('/customer/drivers', customerDriversRouter);
v1Router.use('/customer/locations', customerLocationsRouter);
v1Router.use('/customer/orders', customerOrdersRouter);
v1Router.use('/customer/products', customerProductsRouter);
v1Router.use('/customer/profile', customerProfileRouter);
v1Router.use('/customer/quotations', customerQuotationsRouter);
v1Router.use('/customer/users', customerUsersRouter);
v1Router.use('/health', healthRouter);
v1Router.use('/registrations', registrationRouter);
v1Router.use('/sales/applications', salesApplicationRouter);
v1Router.use('/sales/auth', salesAuthRouter);
v1Router.use('/sales/contracts', salesContractsRouter);
v1Router.use('/sales/orders', salesOrdersRouter);
v1Router.use('/sales/quotations', salesQuotationsRouter);
