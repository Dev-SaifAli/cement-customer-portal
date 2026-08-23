import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type {
  CustomerDashboardRow,
  CustomerDeliveryLocationSummary,
} from './customer-dashboard.types.js';

export class CustomerDashboardService {
  async getDashboard(customerUser: CustomerUser) {
    const result = await pool.query<CustomerDashboardRow>(
      `select
         customer_accounts.id as account_id,
         customer_accounts.company_name,
         customer_accounts.status as account_status,
         customer_accounts.activated_at,
         customer_users.id as admin_id,
         customer_users.name as admin_name,
         customer_users.email as admin_email,
         customer_users.role as admin_role,
         registration_drafts.id as registration_id,
         registration_drafts.reference as registration_reference,
         registration_drafts.status as registration_status,
         registration_drafts.contact,
         registration_drafts.administrator,
         registration_drafts.delivery_locations,
         registration_drafts.submitted_at
       from customer_accounts
       inner join customer_users
         on customer_users.customer_account_id = customer_accounts.id
        and customer_users.id = $2
       inner join registration_drafts
         on registration_drafts.id = customer_accounts.registration_id
       where customer_accounts.id = $1
       limit 1`,
      [customerUser.account.id, customerUser.id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(
        'Customer dashboard data was not found.',
        404,
        'CUSTOMER_DASHBOARD_NOT_FOUND',
      );
    }

    return mapDashboard(row);
  }
}

export const customerDashboardService = new CustomerDashboardService();

function mapDashboard(row: CustomerDashboardRow) {
  const contact = objectOrEmpty(row.contact);
  const registrationAdministrator = objectOrEmpty(row.administrator);
  const locations = arrayOrEmpty(row.delivery_locations).map(mapDeliveryLocationSummary);

  return {
    account: {
      id: row.account_id,
      companyName: row.company_name,
      status: row.account_status,
      activatedAt: dateString(row.activated_at),
    },
    administrator: {
      id: row.admin_id,
      name: row.admin_name,
      email: row.admin_email,
      phone: stringOrNull(
        registrationAdministrator.phone ??
          registrationAdministrator.phoneNumber ??
          registrationAdministrator.mobile,
      ),
      role: row.admin_role,
    },
    registration: {
      id: row.registration_id,
      reference: row.registration_reference,
      status: row.registration_status,
      submittedAt: dateOrNull(row.submitted_at),
    },
    contact: {
      phone: stringOrNull(contact.phone ?? contact.phoneNumber ?? contact.mobile),
    },
    deliveryLocations: {
      count: locations.length,
      items: locations,
    },
  };
}

function mapDeliveryLocationSummary(value: unknown): CustomerDeliveryLocationSummary {
  const location = objectOrEmpty(value);

  return {
    id: stringOrNull(location.id),
    name: stringOrNull(location.name ?? location.locationName ?? location.siteName),
    siteId: stringOrNull(location.siteId),
    city: stringOrNull(location.city),
    region: stringOrNull(location.region ?? location.province),
    country: stringOrNull(location.country),
    isPrimary: location.isPrimary === true,
    hasMapLocation: typeof location.latitude === 'number' && typeof location.longitude === 'number',
  };
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return objectOrEmpty(parsed);
    } catch {
      return {};
    }
  }

  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayOrEmpty(value: unknown): unknown[] {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return arrayOrEmpty(parsed);
    } catch {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

function dateString(value: Date | string) {
  return new Date(String(value)).toISOString();
}

function dateOrNull(value: Date | string | null) {
  return value ? dateString(value) : null;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
