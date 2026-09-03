import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { emailService } from '../email/email.service.js';
import {
  customerTicketEventDispatcher,
  type CustomerTicketLifecycleEvent,
} from './customer-ticket-events.dispatcher.js';
import {
  ticketClosedCustomerEmail,
  ticketSubmittedSalesEmail,
} from './templates/customer-ticket-email.templates.js';

let registered = false;

export function registerCustomerTicketEmailNotifications() {
  if (registered) return;
  registered = true;
  customerTicketEventDispatcher.subscribe((event) => handleCustomerTicketEmailEvent(event));
}

export async function handleCustomerTicketEmailEvent(event: CustomerTicketLifecycleEvent) {
  try {
    if (event.type === 'TICKET_SUBMITTED') {
      await sendTicketSubmittedEmail(event);
      return;
    }

    if (event.type === 'TICKET_CLOSED') {
      await sendTicketClosedEmail(event);
    }
  } catch (error) {
    logger.error(
      {
        err: error,
        eventType: event.type,
        ticketId: event.ticketId,
        ticketNumber: event.ticketNumber,
      },
      'Customer ticket email notification failed.',
    );
  }
}

async function sendTicketSubmittedEmail(event: CustomerTicketLifecycleEvent) {
  if (!env.SALES_TEAM_EMAIL) {
    logger.warn(
      {
        ticketId: event.ticketId,
        eventType: event.type,
      },
      'Sales team ticket notification skipped because SALES_TEAM_EMAIL is not configured.',
    );
    return;
  }

  const message = ticketSubmittedSalesEmail(event);
  await emailService.sendEmail({
    to: env.SALES_TEAM_EMAIL,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

async function sendTicketClosedEmail(event: CustomerTicketLifecycleEvent) {
  if (!event.customerUserEmail) {
    logger.warn(
      {
        ticketId: event.ticketId,
        eventType: event.type,
      },
      'Customer ticket resolution email skipped because customer email is missing.',
    );
    return;
  }

  const message = ticketClosedCustomerEmail(event);
  await emailService.sendEmail({
    to: event.customerUserEmail,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
