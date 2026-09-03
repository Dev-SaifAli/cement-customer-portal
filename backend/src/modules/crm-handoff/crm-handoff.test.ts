import { describe, expect, it, vi } from 'vitest';
import { CrmHandoffService } from './crm-handoff.service.js';
import type { CrmHandoffAdapter, CrmHandoffTicket } from './crm-handoff.types.js';

const submittedTicket: CrmHandoffTicket = {
  id: '55555555-5555-4555-8555-555555555555',
  ticketNumber: 'TKT-2026-000001',
  customer: {
    accountId: '22222222-2222-4222-8222-222222222222',
    companyName: 'Activated Cement Customer',
  },
  customerUser: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Customer Admin',
    email: 'admin@example.com',
    phone: '+966555000111',
    role: 'CUSTOMER_ADMIN',
  },
  description: 'Need quotation assistance.',
  status: 'SUBMITTED',
  crmHandoffStatus: 'NOT_SENT',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T09:00:00.000Z',
};

describe('CRM handoff service', () => {
  it('receives a submitted ticket and calls the configured adapter contract', async () => {
    const adapter = createAdapter({ ok: true, externalReference: 'CRM-123' });
    const result = await new CrmHandoffService(adapter).sendTicket(submittedTicket);

    expect(adapter.preparePayload).toHaveBeenCalledWith(submittedTicket);
    expect(adapter.sendTicket).toHaveBeenCalledWith(submittedTicket);
    expect(result).toMatchObject({
      sent: true,
      adapter: 'test-crm-adapter',
      externalReference: 'CRM-123',
      payload: {
        ticketId: submittedTicket.id,
        ticketNumber: submittedTicket.ticketNumber,
        customerAccountId: submittedTicket.customer.accountId,
        customerCompanyName: submittedTicket.customer.companyName,
        customerUserId: submittedTicket.customerUser.id,
      },
    });
  });

  it('rejects tickets that are not eligible for CRM handoff', async () => {
    const adapter = createAdapter({ ok: true });
    const service = new CrmHandoffService(adapter);

    await expect(
      service.sendTicket({ ...submittedTicket, status: 'DRAFT' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CRM_HANDOFF_TICKET_STATUS_INVALID',
    });
    expect(adapter.sendTicket).not.toHaveBeenCalled();
  });

  it('rejects tickets that were already marked sent', async () => {
    const adapter = createAdapter({ ok: true });
    const service = new CrmHandoffService(adapter);

    await expect(
      service.sendTicket({ ...submittedTicket, crmHandoffStatus: 'SENT' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CRM_HANDOFF_ALREADY_SENT',
    });
    expect(adapter.sendTicket).not.toHaveBeenCalled();
  });

  it('does not silently mark tickets as sent when CRM is not configured', async () => {
    const adapter = createAdapter({
      ok: false,
      reason: 'NOT_CONFIGURED',
      message: 'CRM handoff adapter is not configured.',
    });
    const result = await new CrmHandoffService(adapter).sendTicket(submittedTicket);

    expect(result).toMatchObject({
      sent: false,
      reason: 'NOT_CONFIGURED',
      message: 'CRM handoff adapter is not configured.',
    });
    expect(submittedTicket.status).toBe('SUBMITTED');
    expect(submittedTicket.crmHandoffStatus).toBe('NOT_SENT');
  });
});

function createAdapter(result: Awaited<ReturnType<CrmHandoffAdapter['sendTicket']>>) {
  const preparePayload = vi.fn<CrmHandoffAdapter['preparePayload']>((ticket) => ({
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
  }));
  return {
    name: 'test-crm-adapter',
    isConfigured: vi.fn(() => true),
    preparePayload,
    sendTicket: vi.fn<CrmHandoffAdapter['sendTicket']>(async () => result),
  } satisfies CrmHandoffAdapter;
}
