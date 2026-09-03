import { Router } from 'express';
import { applicationRouter } from '../modules/applications/application.routes.js';
import { adminPricingRouter } from '../modules/admin-pricing/admin-pricing.routes.js';
import { adminProductOptionsRouter, adminProductsRouter } from '../modules/admin-products/admin-products.routes.js';
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
import { customerShipmentsRouter } from '../modules/customer-shipments/customer-shipments.routes.js';
import {
  customerTicketsRouter,
  salesTicketsRouter,
} from '../modules/customer-tickets/customer-tickets.routes.js';
import { customerUsersRouter } from '../modules/customer-users/customer-users.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import {
  haderFleetReferenceRouter,
  internalLogisticsRouter,
} from '../modules/internal-logistics/internal-logistics.routes.js';
import {
  haderDeliveryRequestsRouter,
  haderShipmentsRouter,
  salesShipmentsRouter,
} from '../modules/hader-delivery/hader-delivery.routes.js';
import {
  haderDispatchActionsRouter,
  haderDispatchRouter,
} from '../modules/hader-dispatch/hader-dispatch.routes.js';
import {
  haderLoadingActionsRouter,
  haderLoadingRouter,
} from '../modules/hader-loading/hader-loading.routes.js';
import {
  haderDeliveryTeamActionsRouter,
  haderDeliveryTeamRouter,
} from '../modules/hader-delivery-team/hader-delivery-team.routes.js';
import { haderPodRouter } from '../modules/hader-pod/hader-pod.routes.js';
import { registrationRouter } from '../modules/registrations/registration.routes.js';
import { salesApplicationRouter } from '../modules/sales-applications/sales-application.routes.js';
import { salesAuthRouter } from '../modules/sales-auth/sales-auth.routes.js';
import { salesContractsRouter } from '../modules/sales-contracts/sales-contracts.routes.js';
import { salesOrdersRouter } from '../modules/sales-orders/sales-orders.routes.js';
import { salesQuotationsRouter } from '../modules/sales-quotations/sales-quotations.routes.js';
import { notificationsRouter } from '../modules/notifications/notifications.routes.js';
import {
  adminHaderCitiesRouter,
  customerLocationValidationRouter,
} from '../modules/hader-zones/hader-zone.routes.js';
import {
  adminLoadingPointsRouter,
  haderAvailableLoadingPointsRouter,
} from '../modules/loading-points/loading-points.routes.js';
import { adminPickupLocationsRouter, customerPickupLocationsRouter } from '../modules/pickup-locations/pickup-locations.routes.js';
import { adminTaxConfigurationsRouter } from '../modules/tax-configurations/tax-configurations.routes.js';
import { adminUsersRouter } from '../modules/admin-users/admin-users.routes.js';
import { adminNotificationsRouter } from '../modules/admin-notifications/admin-notifications.routes.js';
import {
  commercialDirectorVarianceRouter,
  shipToVarianceRouter,
} from '../modules/ship-to-variance/ship-to-variance.routes.js';

export const v1Router = Router();
v1Router.use('/admin/product-prices', adminPricingRouter);
v1Router.use('/admin/products', adminProductsRouter);
v1Router.use('/admin/product-options', adminProductOptionsRouter);
v1Router.use('/admin/hader-cities', adminHaderCitiesRouter);
v1Router.use('/admin/loading-points', adminLoadingPointsRouter);
v1Router.use('/admin/pickup-locations', adminPickupLocationsRouter);
v1Router.use('/admin/tax-configurations', adminTaxConfigurationsRouter);
v1Router.use('/admin/users', adminUsersRouter);
v1Router.use('/portal-admin/notifications', adminNotificationsRouter);
v1Router.use('/admin', internalLogisticsRouter);
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
v1Router.use('/customer/pickup-locations', customerPickupLocationsRouter);
v1Router.use('/customer/profile', customerProfileRouter);
v1Router.use('/customer/quotations', customerQuotationsRouter);
v1Router.use('/customer/shipments', customerShipmentsRouter);
v1Router.use('/customer/tickets', customerTicketsRouter);
v1Router.use('/customer/users', customerUsersRouter);
v1Router.use('/health', healthRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/location', customerLocationValidationRouter);
v1Router.use('/hader/delivery-requests', haderDeliveryRequestsRouter);
v1Router.use('/hader/dispatch', haderDispatchRouter);
v1Router.use('/hader/loading-control', haderLoadingRouter);
v1Router.use('/hader/delivery-team', haderDeliveryTeamRouter);
v1Router.use('/hader/loading-points', haderAvailableLoadingPointsRouter);
v1Router.use('/hader/shipments', haderLoadingActionsRouter);
v1Router.use('/hader/shipments', haderDispatchActionsRouter);
v1Router.use('/hader/shipments', haderDeliveryTeamActionsRouter);
v1Router.use('/hader/shipments', haderPodRouter);
v1Router.use('/hader/shipments', haderShipmentsRouter);
v1Router.use('/hader', haderFleetReferenceRouter);
v1Router.use('/registrations', registrationRouter);
v1Router.use('/sales/applications', salesApplicationRouter);
v1Router.use('/sales/auth', salesAuthRouter);
v1Router.use('/sales/contracts', salesContractsRouter);
v1Router.use('/sales/orders', salesOrdersRouter);
v1Router.use('/sales/shipments', salesShipmentsRouter);
v1Router.use('/sales/tickets', salesTicketsRouter);
v1Router.use('/sales/quotations', salesQuotationsRouter);
v1Router.use('/price-manager/ship-to-variances', shipToVarianceRouter);
v1Router.use('/commercial-director/ship-to-variance-charges', commercialDirectorVarianceRouter);
