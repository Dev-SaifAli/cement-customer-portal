import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type { UpdateCustomerProfileInput } from './customer-profile.validation.js';

interface CustomerProfileRow {
  account_id: string;
  company_name: string;
  account_status: string;
  activated_at: Date | string;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  admin_role: CustomerUser['role'];
  registration_id: string;
  registration_reference: string | null;
  registration_status: string;
  administrator: unknown;
}

export class CustomerProfileService {
  async getProfile(customerUser: CustomerUser) {
    const row = await this.findProfile(customerUser);

    return mapProfile(row);
  }

  async updateProfile(customerUser: CustomerUser, input: UpdateCustomerProfileInput) {
    const current = await this.findProfile(customerUser);
    const currentAdministrator = objectOrEmpty(current.administrator);

    const nextAdministratorName = input.administratorName ?? current.admin_name;
    const nextContactPhone =
      input.contactPhone ??
      stringOrNull(
        currentAdministrator.phone ?? currentAdministrator.phoneNumber ?? currentAdministrator.mobile,
      );

    const result = await pool.query<CustomerProfileRow>(
      `with updated_user as (
         update customer_users
         set name = $3,
             updated_at = now()
         where id = $2
           and customer_account_id = $1
         returning id
       ),
       updated_registration as (
         update registration_drafts
         set administrator = jsonb_set(
               jsonb_set(
                 coalesce(administrator, '{}'::jsonb),
                 '{fullName}',
                 to_jsonb($3::text),
                 true
               ),
               '{phone}',
               to_jsonb($4::text),
               true
             ),
             updated_at = now()
         where id = $5
           and exists (select 1 from updated_user)
         returning id
       )
       select
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
         registration_drafts.administrator
       from customer_accounts
       inner join customer_users
         on customer_users.customer_account_id = customer_accounts.id
        and customer_users.id = $2
       inner join registration_drafts
         on registration_drafts.id = customer_accounts.registration_id
       where customer_accounts.id = $1
         and exists (select 1 from updated_registration)
       limit 1`,
      [
        customerUser.account.id,
        customerUser.id,
        nextAdministratorName,
        nextContactPhone,
        customerUser.account.registrationId,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError('Customer profile could not be updated.', 404, 'CUSTOMER_PROFILE_NOT_FOUND');
    }

    return mapProfile(row);
  }

  private async findProfile(customerUser: CustomerUser) {
    const result = await pool.query<CustomerProfileRow>(
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
         registration_drafts.administrator
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
      throw new AppError('Customer profile was not found.', 404, 'CUSTOMER_PROFILE_NOT_FOUND');
    }

    return row;
  }
}

export const customerProfileService = new CustomerProfileService();

function mapProfile(row: CustomerProfileRow) {
  const administrator = objectOrEmpty(row.administrator);

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
      phone: stringOrNull(administrator.phone ?? administrator.phoneNumber ?? administrator.mobile),
      role: row.admin_role,
    },
    registration: {
      id: row.registration_id,
      reference: row.registration_reference,
      status: row.registration_status,
    },
  };
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function dateString(value: Date | string) {
  return new Date(String(value)).toISOString();
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
