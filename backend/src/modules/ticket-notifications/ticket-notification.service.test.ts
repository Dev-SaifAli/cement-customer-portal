import { describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import type { CustomerTicketLifecycleEvent } from '../customer-tickets/customer-ticket-events.dispatcher.js';
import { TicketNotificationService } from './ticket-notification.service.js';
import { PendingWhatsAppProvider } from './pending-whatsapp.provider.js';
import type { WhatsAppProvider, WhatsAppSendResult } from './whatsapp-provider.types.js';

const ticketId = '55555555-5555-4555-8555-555555555555';
const customerAccountId = '22222222-2222-4222-8222-222222222222';
const customerUserId = '11111111-1111-4111-8111-111111111111';

describe('customer ticket WhatsApp notification foundation', () => {
  it('receives TICKET_SUBMITTED events and skips Sales WhatsApp until a recipient is configured', async () => {
    const provider = createProvider({ ok: true, provider: 'test-whatsapp-provider' });
    const result = await new TicketNotificationService(provider).handleTicketEvent({
      ...baseLifecycleEvent(),
      type: 'TICKET_SUBMITTED',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED',
    });

    expect(result).toEqual([
      {
        channel: 'WHATSAPP',
        status: 'SKIPPED',
        eventType: 'TICKET_SUBMITTED',
        ticketId,
        reason: 'SALES_WHATSAPP_RECIPIENT_NOT_CONFIGURED',
      },
    ]);
    expect(provider.sendMessage).not.toHaveBeenCalled();
  });

  it('receives TICKET_CLOSED events and sends through the injected WhatsApp provider contract', async () => {
    const provider = createProvider({ ok: true, provider: 'test-whatsapp-provider' });
    const result = await new TicketNotificationService(provider).handleTicketEvent({
      ...baseLifecycleEvent(),
      type: 'TICKET_CLOSED',
      previousStatus: 'OPEN',
      newStatus: 'CLOSED',
      previousCrmHandoffStatus: 'SENT',
      newCrmHandoffStatus: 'SENT',
      metadata: {
        crmResponse: 'The issue has been resolved.',
      },
    });

    expect(provider.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '+966555000111',
        message: expect.stringContaining('TKT-2026-000001'),
        metadata: expect.objectContaining({
          ticketId,
          ticketNumber: 'TKT-2026-000001',
          eventType: 'TICKET_CLOSED',
        }),
      }),
    );
    expect(provider.sendMessage.mock.calls[0]?.[0].message).toContain(
      'The issue has been resolved.',
    );
    expect(result).toEqual([
      {
        channel: 'WHATSAPP',
        status: 'SENT',
        provider: 'test-whatsapp-provider',
        eventType: 'TICKET_CLOSED',
        ticketId,
      },
    ]);
  });

  it('does not send through the pending provider while WhatsApp is disabled', async () => {
    env.WHATSAPP_ENABLED = false;
    const result = await new PendingWhatsAppProvider().sendMessage({
      phoneNumber: '+966555000111',
      message: 'Service request update',
    });

    expect(result).toMatchObject({
      ok: false,
      provider: 'pending-whatsapp-provider',
      reason: 'DISABLED',
    });
  });

  it('does not break ticket workflow when the WhatsApp provider fails', async () => {
    const provider = createProvider({ ok: true, provider: 'test-whatsapp-provider' });
    provider.sendMessage.mockRejectedValueOnce(new Error('Provider unavailable'));

    await expect(
      new TicketNotificationService(provider).handleTicketEvent({
        ...baseLifecycleEvent(),
        type: 'TICKET_CLOSED',
        previousStatus: 'OPEN',
        newStatus: 'CLOSED',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        channel: 'WHATSAPP',
        status: 'FAILED',
        provider: 'test-whatsapp-provider',
        reason: 'PROVIDER_ERROR',
      }),
    ]);
  });

  it('keeps the future provider replaceable through the WhatsAppProvider interface', async () => {
    const provider = createProvider({ ok: false, provider: 'replacement-provider', reason: 'NOT_CONFIGURED', message: 'Provider pending.' });
    const result = await new TicketNotificationService(provider).handleTicketEvent({
      ...baseLifecycleEvent(),
      type: 'TICKET_CLOSED',
      previousStatus: 'OPEN',
      newStatus: 'CLOSED',
    });

    expect(provider.sendMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        channel: 'WHATSAPP',
        status: 'SKIPPED',
        provider: 'replacement-provider',
        eventType: 'TICKET_CLOSED',
        ticketId,
        reason: 'NOT_CONFIGURED',
      },
    ]);
  });
});

function createProvider(result: WhatsAppSendResult) {
  return {
    name: 'test-whatsapp-provider',
    isEnabled: vi.fn(() => true),
    sendMessage: vi.fn<WhatsAppProvider['sendMessage']>(async () => result),
  } satisfies WhatsAppProvider;
}

function baseLifecycleEvent(): CustomerTicketLifecycleEvent {
  return {
    type: 'TICKET_CREATED',
    ticketId,
    ticketNumber: 'TKT-2026-000001',
    customerAccountId,
    customerCompanyName: 'Activated Cement Customer',
    customerUserId,
    customerUserName: 'Customer Admin',
    customerUserEmail: 'admin@example.com',
    customerUserPhone: '+966555000111',
    customerUserRole: 'CUSTOMER_ADMIN',
    previousStatus: null,
    newStatus: 'DRAFT',
    previousCrmHandoffStatus: null,
    newCrmHandoffStatus: 'NOT_SENT',
    actor: {
      kind: 'CUSTOMER',
      id: customerUserId,
      name: 'Customer Admin',
      role: 'CUSTOMER_ADMIN',
    },
    occurredAt: '2026-09-01T09:00:00.000Z',
    metadata: {},
  };
}
