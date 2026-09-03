import { AppError } from '../../errors/app-error.js';
import { pendingCrmAdapter } from './pending-crm.adapter.js';
import type {
  CrmHandoffAdapter,
  CrmHandoffResult,
  CrmHandoffTicket,
} from './crm-handoff.types.js';

export class CrmHandoffService {
  constructor(private readonly adapter: CrmHandoffAdapter = pendingCrmAdapter) {}

  async sendTicket(ticket: CrmHandoffTicket): Promise<CrmHandoffResult> {
    this.ensureEligible(ticket);

    const payload = this.adapter.preparePayload(ticket);
    const result = await this.adapter.sendTicket(ticket);

    if (!result.ok) {
      return {
        sent: false,
        adapter: this.adapter.name,
        payload,
        reason: result.reason,
        message: result.message,
        ...(result.metadata ? { metadata: result.metadata } : {}),
      };
    }

    return {
      sent: true,
      adapter: this.adapter.name,
      payload,
      ...(result.externalReference ? { externalReference: result.externalReference } : {}),
      ...(result.metadata ? { metadata: result.metadata } : {}),
    };
  }

  private ensureEligible(ticket: CrmHandoffTicket) {
    if (ticket.status !== 'SUBMITTED') {
      throw new AppError(
        'Only submitted tickets are eligible for CRM handoff.',
        409,
        'CRM_HANDOFF_TICKET_STATUS_INVALID',
      );
    }

    if (ticket.crmHandoffStatus !== 'NOT_SENT') {
      throw new AppError(
        'Ticket has already been marked for CRM handoff.',
        409,
        'CRM_HANDOFF_ALREADY_SENT',
      );
    }
  }
}

export const crmHandoffService = new CrmHandoffService();
