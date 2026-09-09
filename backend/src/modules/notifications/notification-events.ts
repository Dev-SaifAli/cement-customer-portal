import { notificationsService } from './notifications.service.js';

const customerCommercialRoles = ['CUSTOMER_ADMIN', 'PURCHASER'] as const;

export const notificationEvents = {
  registrationSubmitted(applicationId: string, reference: string) {
    return notificationsService.publishSafely({
      recipients: { kind: 'SALES_ROLES', roles: ['SALES_REP'] },
      type: 'REGISTRATION_SUBMITTED',
      title: 'New customer registration',
      message: `${reference} is ready for Sales review.`,
      entityType: 'APPLICATION',
      entityId: applicationId,
      actionUrl: `/sales/applications/${applicationId}`,
      eventKey: `registration-submitted:${applicationId}`,
    });
  },

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

  contractApprovalRequired(contractId: string, reference: string, submissionVersion: string) {
    return notificationsService.publishSafely({
      recipients: { kind: 'SALES_ROLES', roles: ['COMMERCIAL_DIRECTOR'] },
      type: 'CONTRACT_APPROVAL_REQUIRED',
      title: 'Contract approval required',
      message: `${reference} is ready for Contract approval.`,
      entityType: 'CONTRACT',
      entityId: contractId,
      actionUrl: `/sales/contracts/${contractId}`,
      eventKey: `contract-approval-required:${contractId}:${submissionVersion}`,
    });
  },

  contractChangesRequested(
    salesUserId: string,
    contractId: string,
    reference: string,
    reason: string,
  ) {
    return notificationsService.publishSafely({
      recipients: { kind: 'SALES_USERS', userIds: [salesUserId] },
      type: 'CONTRACT_CHANGES_REQUESTED',
      title: 'Contract changes requested',
      message: `${reference} requires changes: ${reason}`,
      entityType: 'CONTRACT',
      entityId: contractId,
      actionUrl: `/sales/contracts/${contractId}`,
      eventKey: `contract-changes-requested:${contractId}:${Date.now()}`,
    });
  },

  async contractActivated(
    salesUserId: string,
    customerAccountId: string,
    contractId: string,
    reference: string,
  ) {
    await Promise.all([
      notificationsService.publishSafely({
        recipients: { kind: 'SALES_USERS', userIds: [salesUserId] },
        type: 'CONTRACT_ACTIVATED',
        title: 'Contract approved and activated',
        message: `${reference} is fully approved and ACTIVE.`,
        entityType: 'CONTRACT',
        entityId: contractId,
        actionUrl: `/sales/contracts/${contractId}`,
        eventKey: `contract-activated:sales:${contractId}`,
      }),
      notificationsService.publishSafely({
        recipients: {
          kind: 'CUSTOMER_ACCOUNT',
          customerAccountId,
          roles: [...customerCommercialRoles],
        },
        type: 'CONTRACT_ACTIVATED',
        title: 'Contract activated',
        message: `${reference} is now ACTIVE and available in your Contracts.`,
        entityType: 'CONTRACT',
        entityId: contractId,
        actionUrl: `/customer/contracts/${contractId}`,
        eventKey: `contract-activated:customer:${contractId}`,
      }),
    ]);
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
      recipients: {
        kind: 'SALES_ROLES',
        roles: ['HADER_MANAGER', 'HADER_OPERATIONS'],
      },
      type: 'DELIVERY_REQUEST_CREATED',
      title: 'New delivery request',
      message: `A delivery request for ${orderNumber} is ready for Hader review.`,
      entityType: 'DELIVERY_REQUEST',
      entityId: deliveryRequestId,
      actionUrl: `/hader/delivery-requests/${deliveryRequestId}`,
    });
  },
};
