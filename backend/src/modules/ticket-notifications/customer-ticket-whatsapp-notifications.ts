import { logger } from '../../config/logger.js';
import {
  customerTicketEventDispatcher,
  type CustomerTicketLifecycleEvent,
} from '../customer-tickets/customer-ticket-events.dispatcher.js';
import { ticketNotificationService } from './ticket-notification.service.js';

let registered = false;

export function registerCustomerTicketWhatsAppNotifications() {
  if (registered) return;
  registered = true;
  customerTicketEventDispatcher.subscribe((event) => handleCustomerTicketWhatsAppEvent(event));
}

export async function handleCustomerTicketWhatsAppEvent(event: CustomerTicketLifecycleEvent) {
  try {
    await ticketNotificationService.handleTicketEvent(event);
  } catch (error) {
    logger.error(
      {
        err: error,
        eventType: event.type,
        ticketId: event.ticketId,
        ticketNumber: event.ticketNumber,
      },
      'Customer ticket WhatsApp notification handler failed.',
    );
  }
}
