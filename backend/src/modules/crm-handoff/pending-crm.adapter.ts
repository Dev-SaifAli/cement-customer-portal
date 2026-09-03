import { env } from '../../config/env.js';
import type {
  CrmHandoffAdapter,
  CrmHandoffAdapterResult,
  CrmHandoffPayload,
  CrmHandoffTicket,
} from './crm-handoff.types.js';

export class PendingCrmAdapter implements CrmHandoffAdapter {
  readonly name = 'pending-crm-adapter';

  isConfigured() {
    return env.CRM_ENABLED;
  }

  preparePayload(ticket: CrmHandoffTicket): CrmHandoffPayload {
    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      customerAccountId: ticket.customer.accountId,
      customerCompanyName: ticket.customer.companyName,
      customerUserId: ticket.customerUser.id,
      customerUserName: ticket.customerUser.name,
      customerUserEmail: ticket.customerUser.email,
      customerUserPhone: ticket.customerUser.phone,
      customerUserRole: ticket.customerUser.role,
      description: ticket.description,
      submittedAt: ticket.updatedAt,
    };
  }

  async sendTicket(ticket: CrmHandoffTicket): Promise<CrmHandoffAdapterResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        reason: 'NOT_CONFIGURED',
        message: 'CRM handoff adapter is not configured.',
      };
    }

    return {
      ok: false,
      reason: 'NOT_CONFIGURED',
      message: 'CRM API implementation is pending.',
    };
  }
}

export const pendingCrmAdapter = new PendingCrmAdapter();
