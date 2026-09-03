import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { CrmHandoffStatus, CustomerTicketStatus } from './customer-tickets.service.js';

export type CustomerTicketLifecycleEventType =
  | 'TICKET_CREATED'
  | 'TICKET_SUBMITTED'
  | 'TICKET_SENT_TO_CRM'
  | 'TICKET_OPENED'
  | 'TICKET_CLOSED';

export type CustomerTicketEventActor =
  | {
      kind: 'CUSTOMER';
      id: string;
      name: string | null;
      role: CustomerUser['role'];
    }
  | {
      kind: 'SALES';
      id: string;
      name: string | null;
      role: SalesUser['role'];
    };

export interface CustomerTicketLifecycleEvent {
  type: CustomerTicketLifecycleEventType;
  ticketId: string;
  ticketNumber: string;
  customerAccountId: string;
  customerCompanyName: string | null;
  customerUserId: string;
  customerUserName: string | null;
  customerUserEmail: string | null;
  customerUserPhone: string | null;
  customerUserRole: CustomerUser['role'];
  previousStatus: CustomerTicketStatus | null;
  newStatus: CustomerTicketStatus | null;
  previousCrmHandoffStatus: CrmHandoffStatus | null;
  newCrmHandoffStatus: CrmHandoffStatus | null;
  actor: CustomerTicketEventActor | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

type CustomerTicketEventHandler = (event: CustomerTicketLifecycleEvent) => void | Promise<void>;

class CustomerTicketEventDispatcher {
  private readonly handlers = new Set<CustomerTicketEventHandler>();

  subscribe(handler: CustomerTicketEventHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async dispatch(event: CustomerTicketLifecycleEvent) {
    const handlers = Array.from(this.handlers);
    if (!handlers.length) return;

    await Promise.allSettled(handlers.map((handler) => handler(event)));
  }
}

export const customerTicketEventDispatcher = new CustomerTicketEventDispatcher();
