import { notificationsService } from './notifications.service.js';

const customerCommercialRoles = ['CUSTOMER_ADMIN', 'PURCHASER'] as const;

export const notificationEvents = {
  quotationSubmitted(quotationId: string, reference: string) {
    return notificationsService.publishSafely({
      recipients: { kind: 'SALES_ROLES', roles: ['SALES_REP'] },
      type: 'QUOTATION_SUBMITTED',
      title: 'New quotation submitted',
      message: `${reference} is ready for Sales review.`,
      entityType: 'QUOTATION',
      entityId: quotationId,
      actionUrl: `/sales/quotations/${quotationId}`,
    });
  },

  quotationReadyForCustomer(customerAccountId: string, quotationId: string, reference: string) {
    return notificationsService.publishSafely({
      recipients: {
        kind: 'CUSTOMER_ACCOUNT',
        customerAccountId,
        roles: [...customerCommercialRoles],
      },
      type: 'QUOTATION_READY_FOR_CUSTOMER',
      title: 'Quotation ready for review',
      message: `${reference} is ready for your decision.`,
      entityType: 'QUOTATION',
      entityId: quotationId,
      actionUrl: `/customer/quotations/${quotationId}`,
    });
  },

  customerQuotationDecision(
    type: 'QUOTATION_ACCEPTED' | 'QUOTATION_REJECTED' | 'CLARIFICATION_REQUESTED',
    quotationId: string,
    reference: string,
  ) {
    const titles = {
      QUOTATION_ACCEPTED: 'Quotation accepted',
      QUOTATION_REJECTED: 'Quotation rejected',
      CLARIFICATION_REQUESTED: 'Customer clarification requested',
    } as const;
    return notificationsService.publishSafely({
      recipients: { kind: 'SALES_ROLES', roles: ['SALES_REP'] },
      type,
      title: titles[type],
      message: `${reference} has a new customer decision.`,
      entityType: 'QUOTATION',
      entityId: quotationId,
      actionUrl: `/sales/quotations/${quotationId}`,
    });
  },

  quotationApprovalRequired(
    type: 'PRICE_APPROVAL_REQUIRED' | 'HADER_APPROVAL_REQUIRED',
    quotationId: string,
    reference: string,
  ) {
    const hader = type === 'HADER_APPROVAL_REQUIRED';
    return notificationsService.publishSafely({
      recipients: { kind: 'SALES_ROLES', roles: [hader ? 'HADER_MANAGER' : 'PRICE_MANAGER'] },
      type,
      title: hader ? 'Delivery-price approval required' : 'Product-price approval required',
      message: `${reference} requires your commercial approval.`,
      entityType: 'QUOTATION',
      entityId: quotationId,
      actionUrl: `/sales/quotations/${quotationId}`,
    });
  },

  orderSubmitted(orderId: string, orderNumber: string) {
    return notificationsService.publishSafely({
      recipients: { kind: 'SALES_ROLES', roles: ['SALES_REP'] },
      type: 'ORDER_SUBMITTED',
      title: 'New order submitted',
      message: `${orderNumber} is ready for processing.`,
      entityType: 'ORDER',
      entityId: orderId,
      actionUrl: `/sales/orders/${orderId}`,
    });
  },

  orderProcessingStarted(customerAccountId: string, orderId: string, orderNumber: string) {
    return notificationsService.publishSafely({
      recipients: {
        kind: 'CUSTOMER_ACCOUNT',
        customerAccountId,
        roles: [...customerCommercialRoles],
      },
      type: 'ORDER_PROCESSING_STARTED',
      title: 'Order processing started',
      message: `${orderNumber} is now being processed.`,
      entityType: 'ORDER',
      entityId: orderId,
      actionUrl: `/customer/orders/${orderId}`,
    });
  },

  deliveryRequestCreated(deliveryRequestId: string, orderNumber: string) {
    return notificationsService.publishSafely({
      recipients: { kind: 'SALES_ROLES', roles: ['HADER_OPERATIONS', 'DISPATCH_USER'] },
      type: 'DELIVERY_REQUEST_CREATED',
      title: 'New delivery request',
      message: `A delivery request for ${orderNumber} is ready for Hader review.`,
      entityType: 'DELIVERY_REQUEST',
      entityId: deliveryRequestId,
      actionUrl: `/hader/delivery-requests/${deliveryRequestId}`,
    });
  },
};
