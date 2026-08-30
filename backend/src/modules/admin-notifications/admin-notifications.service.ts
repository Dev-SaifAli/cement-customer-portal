import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type {
  AdminNotificationListInput,
  CreateAdminNotificationInput,
  UpdateAdminNotificationInput,
} from './admin-notifications.validation.js';

interface GlobalNotificationRow {
  id: string;
  title: string;
  message: string;
  audience: 'CUSTOMER' | 'SALES';
  target_roles: string[];
  is_active: boolean;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  created_by_name: string | null;
  delivered_count: string;
}

const pageSize = 10;

export class AdminNotificationsService {
  async list(input: AdminNotificationListInput) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (input.audience) {
      values.push(input.audience);
      conditions.push(`global.audience = $${values.length}`);
    }
    if (input.status) {
      values.push(input.status === 'ACTIVE');
      conditions.push(`global.is_active = $${values.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const count = await pool.query<{ total: string }>(
      `select count(*)::text total from global_notifications global ${where}`,
      values,
    );
    values.push(pageSize, (input.page - 1) * pageSize);
    const result = await pool.query<GlobalNotificationRow>(
      `select global.*, creator.name created_by_name,
         (select count(*)::text from notifications delivered
          where delivered.event_key = 'GLOBAL_NOTIFICATION:' || global.id::text) delivered_count
       from global_notifications global
       join sales_users creator on creator.id = global.created_by_sales_user_id
       ${where}
       order by global.created_at desc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    return {
      notifications: result.rows.map(mapGlobalNotification),
      pagination: { page: input.page, pageSize, total: Number(count.rows[0]?.total ?? 0) },
    };
  }

  async create(input: CreateAdminNotificationInput, actorId: string) {
    const result = await pool.query<GlobalNotificationRow>(
      `insert into global_notifications
        (title,message,audience,target_roles,is_active,created_by_sales_user_id)
       values($1,$2,$3,$4,$5,$6)
       returning *, null::text created_by_name, '0'::text delivered_count`,
      [input.title, input.message, input.audience, input.targetRoles, input.status === 'ACTIVE', actorId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('Global notification could not be created.', 503, 'GLOBAL_NOTIFICATION_CREATE_FAILED');
    await recordAudit(pool, row.id, 'GLOBAL_NOTIFICATION_CREATED', actorId, null, row);
    return mapGlobalNotification(row);
  }

  async update(id: string, input: UpdateAdminNotificationInput, actorId: string) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await findForUpdate(client, id);
      if (current.published_at) {
        throw new AppError('A published notification cannot be edited.', 409, 'GLOBAL_NOTIFICATION_ALREADY_PUBLISHED');
      }
      const audience = input.audience ?? current.audience;
      const targetRoles = input.targetRoles ?? current.target_roles;
      validateRoles(audience, targetRoles);
      const result = await client.query<GlobalNotificationRow>(
        `update global_notifications set
           title=$2,message=$3,audience=$4,target_roles=$5,is_active=$6,updated_at=now()
         where id=$1
         returning *, null::text created_by_name, '0'::text delivered_count`,
        [id, input.title ?? current.title, input.message ?? current.message, audience, targetRoles,
          input.status ? input.status === 'ACTIVE' : current.is_active],
      );
      const updated = result.rows[0];
      if (!updated) throw new AppError('Global notification was not found.', 404, 'GLOBAL_NOTIFICATION_NOT_FOUND');
      await recordAudit(client, id, 'GLOBAL_NOTIFICATION_UPDATED', actorId, current, updated);
      await client.query('commit');
      return mapGlobalNotification(updated);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async publish(id: string, actorId: string) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await findForUpdate(client, id);
      if (!current.is_active) throw new AppError('Activate the notification before publishing it.', 409, 'GLOBAL_NOTIFICATION_INACTIVE');
      if (current.published_at) throw new AppError('This notification has already been published.', 409, 'GLOBAL_NOTIFICATION_ALREADY_PUBLISHED');

      if (current.audience === 'CUSTOMER') {
        const roles = current.target_roles.length ? current.target_roles : ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'];
        await client.query(
          `insert into notifications
            (recipient_kind,recipient_user_id,type,title,message,entity_type,entity_id,event_key)
           select 'CUSTOMER',users.id,'GLOBAL_ANNOUNCEMENT',$2,$3,'GLOBAL_NOTIFICATION',$1,$4
           from customer_users users
           join customer_accounts accounts on accounts.id=users.customer_account_id
           where users.is_active=true and accounts.status='ACTIVE' and users.role=any($5::text[])
           on conflict(recipient_kind,recipient_user_id,event_key) do nothing`,
          [id, current.title, current.message, `GLOBAL_NOTIFICATION:${id}`, roles],
        );
      } else {
        const roles = current.target_roles.length ? current.target_roles : null;
        await client.query(
          `insert into notifications
            (recipient_kind,recipient_user_id,type,title,message,entity_type,entity_id,event_key)
           select 'SALES',users.id,'GLOBAL_ANNOUNCEMENT',$2,$3,'GLOBAL_NOTIFICATION',$1,$4
           from sales_users users
           where users.is_active=true and ($5::text[] is null or users.role=any($5::text[]))
           on conflict(recipient_kind,recipient_user_id,event_key) do nothing`,
          [id, current.title, current.message, `GLOBAL_NOTIFICATION:${id}`, roles],
        );
      }

      const result = await client.query<GlobalNotificationRow>(
        `update global_notifications set published_at=now(),updated_at=now() where id=$1
         returning *, null::text created_by_name,
          (select count(*)::text from notifications where event_key=$2) delivered_count`,
        [id, `GLOBAL_NOTIFICATION:${id}`],
      );
      const published = result.rows[0];
      if (!published) throw new AppError('Global notification was not found.', 404, 'GLOBAL_NOTIFICATION_NOT_FOUND');
      await recordAudit(client, id, 'GLOBAL_NOTIFICATION_PUBLISHED', actorId, current, published);
      await client.query('commit');
      return mapGlobalNotification(published);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function findForUpdate(client: PoolClient, id: string) {
  const result = await client.query<GlobalNotificationRow>(
    `select *,null::text created_by_name,'0'::text delivered_count
     from global_notifications where id=$1 for update`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new AppError('Global notification was not found.', 404, 'GLOBAL_NOTIFICATION_NOT_FOUND');
  return row;
}

function validateRoles(audience: 'CUSTOMER' | 'SALES', roles: string[]) {
  const customerRoles = ['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'];
  const salesRoles = ['SALES_REP','HADER_MANAGER','HADER_OPERATIONS','DISPATCH_USER','LOADING_USER','DELIVERY_TEAM_USER','PRICE_MANAGER','PRICING_ADMIN','COMMERCIAL_DIRECTOR','PORTAL_ADMINISTRATOR'];
  const allowed = audience === 'CUSTOMER' ? customerRoles : salesRoles;
  if (roles.some((role) => !allowed.includes(role))) {
    throw new AppError('A target role is not valid for the selected audience.', 400, 'GLOBAL_NOTIFICATION_ROLE_INVALID');
  }
}

async function recordAudit(client: Pool | PoolClient, id: string, eventType: string, actorId: string, oldValue: unknown, newValue: unknown) {
  await client.query(
    `insert into internal_logistics_events
      (entity_type,entity_id,event_type,changed_by_sales_user_id,old_value,new_value)
     values('GLOBAL_NOTIFICATION',$1,$2,$3,$4::jsonb,$5::jsonb)`,
    [id, eventType, actorId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null],
  );
}

function mapGlobalNotification(row: GlobalNotificationRow) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    audience: row.audience,
    targetRoles: row.target_roles,
    status: row.is_active ? 'ACTIVE' : 'INACTIVE',
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: row.created_by_name,
    deliveredCount: Number(row.delivered_count ?? 0),
  };
}

export const adminNotificationsService = new AdminNotificationsService();
