import { logger } from '../../config/logger.js';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { NotificationAudience, PublishNotificationInput } from './notifications.types.js';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export class NotificationsService {
  async publish(input: PublishNotificationInput) {
    const eventKey = input.eventKey ?? `${input.type}:${input.entityType}:${input.entityId}`;
    if (input.recipients.kind === 'SALES_ROLES') {
      await pool.query(
        `insert into notifications (
           recipient_kind, recipient_user_id, type, title, message,
           entity_type, entity_id, action_url, event_key
         )
         select 'SALES', users.id, $2, $3, $4, $5, $6, $7, $8
         from sales_users users
         where users.is_active = true and users.role = any($1::text[])
         on conflict (recipient_kind, recipient_user_id, event_key) do nothing`,
        [
          input.recipients.roles,
          input.type,
          input.title,
          input.message,
          input.entityType,
          input.entityId,
          input.actionUrl,
          eventKey,
        ],
      );
      return;
    }

    const roles = input.recipients.roles ?? [
      'CUSTOMER_ADMIN',
      'PURCHASER',
      'FINANCE_USER',
      'VIEWER',
    ];
    await pool.query(
      `insert into notifications (
         recipient_kind, recipient_user_id, type, title, message,
         entity_type, entity_id, action_url, event_key
       )
       select 'CUSTOMER', users.id, $3, $4, $5, $6, $7, $8, $9
       from customer_users users
       where users.customer_account_id = $1
         and users.is_active = true
         and users.role = any($2::text[])
       on conflict (recipient_kind, recipient_user_id, event_key) do nothing`,
      [
        input.recipients.customerAccountId,
        roles,
        input.type,
        input.title,
        input.message,
        input.entityType,
        input.entityId,
        input.actionUrl,
        eventKey,
      ],
    );
  }

  async publishSafely(input: PublishNotificationInput) {
    try {
      await this.publish(input);
    } catch (error) {
      logger.warn(
        { err: error, notificationType: input.type, entityId: input.entityId },
        'Notification delivery failed after business transaction completed',
      );
    }
  }

  async list(audience: NotificationAudience, userId: string) {
    const result = await pool.query<NotificationRow>(
      `select id, type, title, message, entity_type, entity_id, action_url, read_at, created_at
       from notifications
       where recipient_kind = $1 and recipient_user_id = $2
       order by created_at desc
       limit 30`,
      [audience, userId],
    );
    return result.rows.map(mapNotification);
  }

  async unreadCount(audience: NotificationAudience, userId: string) {
    const result = await pool.query<{ total: string }>(
      `select count(*)::text as total from notifications
       where recipient_kind = $1 and recipient_user_id = $2 and read_at is null`,
      [audience, userId],
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async markRead(audience: NotificationAudience, userId: string, id: string) {
    const result = await pool.query<NotificationRow>(
      `update notifications set read_at = coalesce(read_at, now())
       where id = $1 and recipient_kind = $2 and recipient_user_id = $3
       returning id, type, title, message, entity_type, entity_id, action_url, read_at, created_at`,
      [id, audience, userId],
    );
    if (!result.rows[0]) {
      throw new AppError('Notification was not found.', 404, 'NOTIFICATION_NOT_FOUND');
    }
    return mapNotification(result.rows[0]);
  }

  async markAllRead(audience: NotificationAudience, userId: string) {
    await pool.query(
      `update notifications set read_at = now()
       where recipient_kind = $1 and recipient_user_id = $2 and read_at is null`,
      [audience, userId],
    );
  }
}

function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionUrl: row.action_url,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export const notificationsService = new NotificationsService();
