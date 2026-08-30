import type { Request } from 'express';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type { CustomerRole } from '../customer-auth/customer-roles.js';
import type { SalesRole, SalesUser } from '../sales-auth/sales-auth.types.js';

export type NotificationAudience = 'CUSTOMER' | 'SALES';

export type NotificationType =
  | 'QUOTATION_SUBMITTED'
  | 'QUOTATION_READY_FOR_CUSTOMER'
  | 'QUOTATION_ACCEPTED'
  | 'QUOTATION_REJECTED'
  | 'CLARIFICATION_REQUESTED'
  | 'CONTRACT_CREATED'
  | 'CONTRACT_ACTIVATED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_PROCESSING_STARTED'
  | 'DELIVERY_REQUEST_CREATED'
  | 'SHIPMENT_CREATED'
  | 'SHIPMENT_DELIVERED'
  | 'DRIVER_NOTIFIED'
  | 'PRICE_APPROVAL_REQUIRED'
  | 'HADER_APPROVAL_REQUIRED'
  | 'GLOBAL_ANNOUNCEMENT';

export type NotificationRecipients =
  | { kind: 'SALES_ROLES'; roles: SalesRole[] }
  | { kind: 'CUSTOMER_ACCOUNT'; customerAccountId: string; roles?: CustomerRole[] };

export interface PublishNotificationInput {
  recipients: NotificationRecipients;
  type: NotificationType;
  title: string;
  message: string;
  entityType: 'QUOTATION' | 'CONTRACT' | 'ORDER' | 'DELIVERY_REQUEST' | 'SHIPMENT';
  entityId: string;
  actionUrl: string;
  eventKey?: string;
}

export interface NotificationAuthenticatedRequest extends Request {
  notificationActor?:
    { audience: 'CUSTOMER'; user: CustomerUser } | { audience: 'SALES'; user: SalesUser };
}
