import { logger } from '../../config/logger.js';
import type { CustomerTicketLifecycleEvent } from '../customer-tickets/customer-ticket-events.dispatcher.js';
import { pendingWhatsAppProvider } from './pending-whatsapp.provider.js';
import type { WhatsAppProvider, WhatsAppSendResult } from './whatsapp-provider.types.js';

export type TicketNotificationResult =
  | {
      channel: 'WHATSAPP';
      status: 'SENT';
      provider: string;
      eventType: CustomerTicketLifecycleEvent['type'];
      ticketId: string;
    }
  | {
      channel: 'WHATSAPP';
      status: 'SKIPPED' | 'FAILED';
      provider?: string;
      eventType: CustomerTicketLifecycleEvent['type'];
      ticketId: string;
      reason: string;
    };

export class TicketNotificationService {
  constructor(private readonly whatsappProvider: WhatsAppProvider = pendingWhatsAppProvider) {}

  async handleTicketEvent(event: CustomerTicketLifecycleEvent): Promise<TicketNotificationResult[]> {
    if (event.type === 'TICKET_SUBMITTED') {
      return [await this.handleSubmittedTicket(event)];
    }

    if (event.type === 'TICKET_CLOSED') {
      return [await this.handleClosedTicket(event)];
    }

    return [];
  }

  private async handleSubmittedTicket(
    event: CustomerTicketLifecycleEvent,
  ): Promise<TicketNotificationResult> {
    logger.info(
      {
        ticketId: event.ticketId,
        ticketNumber: event.ticketNumber,
        eventType: event.type,
      },
      'WhatsApp Sales notification skipped because no Sales WhatsApp recipient is configured.',
    );
    return {
      channel: 'WHATSAPP',
      status: 'SKIPPED',
      eventType: event.type,
      ticketId: event.ticketId,
      reason: 'SALES_WHATSAPP_RECIPIENT_NOT_CONFIGURED',
    };
  }

  private async handleClosedTicket(
    event: CustomerTicketLifecycleEvent,
  ): Promise<TicketNotificationResult> {
    if (!event.customerUserPhone) {
      logger.warn(
        {
          ticketId: event.ticketId,
          ticketNumber: event.ticketNumber,
          eventType: event.type,
        },
        'WhatsApp customer notification skipped because customer phone is missing.',
      );
      return {
        channel: 'WHATSAPP',
        status: 'SKIPPED',
        eventType: event.type,
        ticketId: event.ticketId,
        reason: 'CUSTOMER_PHONE_MISSING',
      };
    }

    try {
      const result = await this.whatsappProvider.sendMessage({
        phoneNumber: event.customerUserPhone,
        message: buildTicketClosedMessage(event),
        metadata: {
          ticketId: event.ticketId,
          ticketNumber: event.ticketNumber,
          eventType: event.type,
        },
      });
      return this.toNotificationResult(event, result);
    } catch (error) {
      logger.error(
        {
          err: error,
          ticketId: event.ticketId,
          ticketNumber: event.ticketNumber,
          eventType: event.type,
          provider: this.whatsappProvider.name,
        },
        'Customer ticket WhatsApp notification failed.',
      );
      return {
        channel: 'WHATSAPP',
        status: 'FAILED',
        provider: this.whatsappProvider.name,
        eventType: event.type,
        ticketId: event.ticketId,
        reason: 'PROVIDER_ERROR',
      };
    }
  }

  private toNotificationResult(
    event: CustomerTicketLifecycleEvent,
    result: WhatsAppSendResult,
  ): TicketNotificationResult {
    if (result.ok) {
      return {
        channel: 'WHATSAPP',
        status: 'SENT',
        provider: result.provider,
        eventType: event.type,
        ticketId: event.ticketId,
      };
    }

    return {
      channel: 'WHATSAPP',
      status: result.reason === 'FAILED' ? 'FAILED' : 'SKIPPED',
      provider: result.provider,
      eventType: event.type,
      ticketId: event.ticketId,
      reason: result.reason,
    };
  }
}

export const ticketNotificationService = new TicketNotificationService();

function buildTicketClosedMessage(event: CustomerTicketLifecycleEvent) {
  const customerName = event.customerUserName ?? 'Customer';
  const crmResponse = typeof event.metadata.crmResponse === 'string' ? event.metadata.crmResponse : null;
  const resolution = crmResponse ? `\nResolution: ${crmResponse}` : '';

  return [
    `Dear ${customerName},`,
    '',
    `Your service request ${event.ticketNumber} has been resolved.${resolution}`,
  ].join('\n');
}
