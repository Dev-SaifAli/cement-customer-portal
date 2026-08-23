import bcrypt from 'bcryptjs';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type {
  CustomerLoginRequestBody,
  CustomerUser,
  CustomerUserRecord,
} from './customer-auth.types.js';
import { customerTokenService } from './customer-token.service.js';

const genericAuthenticationError = 'Invalid email or password.';

export class CustomerAuthService {
  async login(payload: CustomerLoginRequestBody) {
    const email = payload.email.toLowerCase();
    const user = await this.findCustomerUserByEmail(email);

    if (!user || !isCustomerUserAllowedToLogin(user)) {
      throw new AppError(genericAuthenticationError, 401, 'CUSTOMER_AUTH_INVALID_CREDENTIALS');
    }

    const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError(genericAuthenticationError, 401, 'CUSTOMER_AUTH_INVALID_CREDENTIALS');
    }

    return {
      token: customerTokenService.createToken({ sub: user.id, type: 'customer' }),
      user: toSafeCustomerUser(user),
    };
  }

  async getAuthenticatedUser(userId: string) {
    const user = await this.findCustomerUserById(userId);

    if (!user || !isCustomerUserAllowedToLogin(user)) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }

    return toSafeCustomerUser(user);
  }

  private async findCustomerUserByEmail(email: string): Promise<CustomerUserRecord | null> {
    const result = await pool.query(
      `select
         customer_users.id,
         customer_users.customer_account_id,
         customer_users.name,
         customer_users.email,
         customer_users.password_hash,
         customer_users.role,
         customer_users.is_active,
         customer_accounts.registration_id,
         customer_accounts.company_name,
         customer_accounts.status as account_status,
         registration_drafts.status as application_status
       from customer_users
       inner join customer_accounts on customer_accounts.id = customer_users.customer_account_id
       inner join registration_drafts on registration_drafts.id = customer_accounts.registration_id
       where lower(customer_users.email) = lower($1)
       limit 1`,
      [email],
    );

    return result.rows[0] ? mapCustomerUserRecord(result.rows[0] as CustomerUserRow) : null;
  }

  private async findCustomerUserById(id: string): Promise<CustomerUserRecord | null> {
    const result = await pool.query(
      `select
         customer_users.id,
         customer_users.customer_account_id,
         customer_users.name,
         customer_users.email,
         customer_users.password_hash,
         customer_users.role,
         customer_users.is_active,
         customer_accounts.registration_id,
         customer_accounts.company_name,
         customer_accounts.status as account_status,
         registration_drafts.status as application_status
       from customer_users
       inner join customer_accounts on customer_accounts.id = customer_users.customer_account_id
       inner join registration_drafts on registration_drafts.id = customer_accounts.registration_id
       where customer_users.id = $1
       limit 1`,
      [id],
    );

    return result.rows[0] ? mapCustomerUserRecord(result.rows[0] as CustomerUserRow) : null;
  }
}

export const customerAuthService = new CustomerAuthService();

interface CustomerUserRow {
  id: string;
  customer_account_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'CUSTOMER_ADMIN';
  is_active: boolean;
  registration_id: string;
  company_name: string;
  account_status: string;
  application_status: string;
}

function mapCustomerUserRecord(row: CustomerUserRow): CustomerUserRecord {
  return {
    id: row.id,
    customerAccountId: row.customer_account_id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    isActive: row.is_active,
    accountIsActive: row.account_status === 'ACTIVE',
    applicationStatus: row.application_status,
    account: {
      id: row.customer_account_id,
      registrationId: row.registration_id,
      companyName: row.company_name,
      status: row.account_status,
    },
  };
}

function isCustomerUserAllowedToLogin(user: CustomerUserRecord) {
  return user.isActive && user.accountIsActive && user.applicationStatus === 'ACTIVATED';
}

function toSafeCustomerUser(user: CustomerUserRecord): CustomerUser {
  return {
    id: user.id,
    customerAccountId: user.customerAccountId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    account: user.account,
  };
}
