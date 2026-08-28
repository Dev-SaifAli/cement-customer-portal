import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, warn } = vi.hoisted(() => ({ query: vi.fn(), warn: vi.fn() }));

vi.mock('../../database/pool.js', () => ({ pool: { query } }));
vi.mock('../../config/logger.js', () => ({ logger: { warn } }));

import { NotificationsService } from './notifications.service.js';

const service = new NotificationsService();
const entityId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  query.mockReset();
  warn.mockReset();
});

describe('NotificationsService', () => {
  it('targets only active Sales users with the requested role and deduplicates the event', async () => {
    query.mockResolvedValue({ rows: [] });

    await service.publish({
      recipients: { kind: 'SALES_ROLES', roles: ['PRICE_MANAGER'] },
      type: 'PRICE_APPROVAL_REQUIRED',
      title: 'Approval required',
      message: 'QT-1 requires approval.',
      entityType: 'QUOTATION',
      entityId,
      actionUrl: `/sales/quotations/${entityId}`,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('users.is_active = true and users.role = any'),
      expect.arrayContaining([['PRICE_MANAGER'], 'PRICE_APPROVAL_REQUIRED']),
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      'on conflict (recipient_kind, recipient_user_id, event_key) do nothing',
    );
  });

  it('scopes customer recipients to the related account and permitted roles', async () => {
    query.mockResolvedValue({ rows: [] });

    await service.publish({
      recipients: {
        kind: 'CUSTOMER_ACCOUNT',
        customerAccountId: '22222222-2222-4222-8222-222222222222',
        roles: ['CUSTOMER_ADMIN', 'PURCHASER'],
      },
      type: 'QUOTATION_READY_FOR_CUSTOMER',
      title: 'Quotation ready',
      message: 'Review quotation.',
      entityType: 'QUOTATION',
      entityId,
      actionUrl: `/customer/quotations/${entityId}`,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('users.customer_account_id = $1'),
      expect.arrayContaining([
        '22222222-2222-4222-8222-222222222222',
        ['CUSTOMER_ADMIN', 'PURCHASER'],
      ]),
    );
  });

  it('counts unread notifications only for the authenticated audience and user', async () => {
    query.mockResolvedValue({ rows: [{ total: '3' }] });

    await expect(service.unreadCount('CUSTOMER', 'user-1')).resolves.toBe(3);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('read_at is null'), [
      'CUSTOMER',
      'user-1',
    ]);
  });

  it('cannot mark another recipient notification as read', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(service.markRead('SALES', 'sales-1', entityId)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTIFICATION_NOT_FOUND',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('recipient_user_id = $3'), [
      entityId,
      'SALES',
      'sales-1',
    ]);
  });

  it('marks all unread records only for the authenticated recipient', async () => {
    query.mockResolvedValue({ rows: [] });

    await service.markAllRead('CUSTOMER', 'customer-1');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('read_at is null'), [
      'CUSTOMER',
      'customer-1',
    ]);
  });

  it('does not fail a business operation when notification persistence fails', async () => {
    query.mockRejectedValue(new Error('notification database unavailable'));

    await expect(
      service.publishSafely({
        recipients: { kind: 'SALES_ROLES', roles: ['SALES_REP'] },
        type: 'ORDER_SUBMITTED',
        title: 'Order submitted',
        message: 'Order ready.',
        entityType: 'ORDER',
        entityId,
        actionUrl: `/sales/orders/${entityId}`,
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});
