import type {
  CrmHandoffStatus,
  CustomerTicketStatus,
} from '../customer-tickets/customer-tickets.service.js';

export interface CrmHandoffTicket {
  id: string;
  ticketNumber: string;
  customer: {
    accountId: string;
    companyName: string | null;
  };
  customerUser: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
  };
  description: string;
  status: CustomerTicketStatus;
  crmHandoffStatus: CrmHandoffStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CrmHandoffPayload {
  ticketId: string;
  ticketNumber: string;
  customerAccountId: string;
  customerCompanyName: string | null;
  customerUserId: string;
  customerUserName: string | null;
  customerUserEmail: string | null;
  customerUserPhone: string | null;
  customerUserRole: string;
  description: string;
  submittedAt: string;
}

export type CrmHandoffAdapterResult =
  | {
      ok: true;
      externalReference?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: 'NOT_CONFIGURED' | 'TEMPORARY_FAILURE' | 'REJECTED';
      message: string;
      metadata?: Record<string, unknown>;
    };

export interface CrmHandoffAdapter {
  readonly name: string;
  isConfigured(): boolean;
  preparePayload(ticket: CrmHandoffTicket): CrmHandoffPayload;
  sendTicket(ticket: CrmHandoffTicket): Promise<CrmHandoffAdapterResult>;
}

export interface CrmHandoffResult {
  sent: boolean;
  adapter: string;
  payload: CrmHandoffPayload;
  externalReference?: string;
  reason?: CrmHandoffAdapterResult extends infer Result
    ? Result extends { ok: false; reason: infer Reason }
      ? Reason
      : never
    : never;
  message?: string;
  metadata?: Record<string, unknown>;
}
