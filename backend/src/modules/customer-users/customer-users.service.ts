import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import { customerRoleLabels } from '../customer-auth/customer-roles.js';
import type {
  CreateCustomerUserInput,
  UpdateCustomerUserInput,
} from './customer-users.validation.js';

interface CustomerUserRow {
  id: string;
  customer_account_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: CustomerUser['role'];
  is_active: boolean;
  password_must_change: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const customerUserNotFoundError = new AppError(
  'Customer user was not found.',
  404,
  'CUSTOMER_USER_NOT_FOUND',
);
const passwordHashRounds = env.NODE_ENV === 'test' ? 4 : 12;

export class CustomerUsersService {
  async list(customerUser: CustomerUser) {
    const result = await pool.query<CustomerUserRow>(
      `select
         id,
         customer_account_id,
         name,
         email,
         phone,
         role,
         is_active,
         password_must_change,
         created_at,
         updated_at
       from customer_users
       where customer_account_id = $1
         and id <> $2
       order by created_at asc`,
      [customerUser.account.id, customerUser.id],
    );

    return result.rows.map(mapCustomerUser);
  }

  async create(customerUser: CustomerUser, input: CreateCustomerUserInput) {
    const passwordHash = await bcrypt.hash(input.password, passwordHashRounds);

    try {
      const result = await pool.query<CustomerUserRow>(
        `insert into customer_users (
           customer_account_id,
           name,
           email,
           phone,
           password_hash,
           role,
           is_active,
           password_must_change
         )
         values ($1, $2, $3, $4, $5, $6, $7, false)
         returning
           id,
           customer_account_id,
           name,
           email,
           phone,
           role,
           is_active,
           password_must_change,
           created_at,
           updated_at`,
        [
          customerUser.account.id,
          input.name,
          input.email,
          input.phone,
          passwordHash,
          input.role ?? 'CUSTOMER_ADMIN',
          input.isActive ?? true,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          'Customer user could not be created.',
          503,
          'CUSTOMER_USER_CREATE_FAILED',
        );
      }

      return {
        user: mapCustomerUser(row),
      };
    } catch (error) {
      if (isUniqueEmailViolation(error)) {
        throw new AppError('A customer user with this email already exists.', 409, 'EMAIL_IN_USE');
      }

      throw error;
    }
  }

  async getById(customerUser: CustomerUser, userId: string) {
    const row = await this.findScopedUser(customerUser, userId);

    return mapCustomerUser(row);
  }

  async update(customerUser: CustomerUser, userId: string, input: UpdateCustomerUserInput) {
    const current = await this.findScopedUser(customerUser, userId);
    const nextRole = input.role ?? current.role;
    const nextIsActive = input.isActive ?? current.is_active;

    if (current.role === 'CUSTOMER_ADMIN' && current.is_active) {
      const remainsActiveAdmin = nextRole === 'CUSTOMER_ADMIN' && nextIsActive;
      if (!remainsActiveAdmin) {
        await this.ensureAnotherActiveCustomerAdmin(customerUser, userId);
      }
    }

    try {
      const result = await pool.query<CustomerUserRow>(
        `update customer_users
         set name = $3,
             phone = $4,
             role = $5,
             is_active = $6,
             updated_at = now()
         where id = $2
           and customer_account_id = $1
         returning
           id,
           customer_account_id,
           name,
           email,
           phone,
           role,
           is_active,
           password_must_change,
           created_at,
           updated_at`,
        [
          customerUser.account.id,
          userId,
          input.name ?? current.name,
          input.phone ?? current.phone,
          nextRole,
          nextIsActive,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw customerUserNotFoundError;
      }

      return mapCustomerUser(row);
    } catch (error) {
      if (isUniqueEmailViolation(error)) {
        throw new AppError('A customer user with this email already exists.', 409, 'EMAIL_IN_USE');
      }

      throw error;
    }
  }

  private async findScopedUser(customerUser: CustomerUser, userId: string) {
    const result = await pool.query<CustomerUserRow>(
      `select
         id,
         customer_account_id,
         name,
         email,
         phone,
         role,
         is_active,
         password_must_change,
         created_at,
         updated_at
       from customer_users
       where id = $2
         and customer_account_id = $1
         and id <> $3
       limit 1`,
      [customerUser.account.id, userId, customerUser.id],
    );

    const row = result.rows[0];
    if (!row) {
      throw customerUserNotFoundError;
    }

    return row;
  }

  private async ensureAnotherActiveCustomerAdmin(customerUser: CustomerUser, userId: string) {
    const result = await pool.query<{ active_admin_count: string }>(
      `select count(*)::text as active_admin_count
       from customer_users
       where customer_account_id = $1
         and id <> $2
         and role = 'CUSTOMER_ADMIN'
         and is_active = true`,
      [customerUser.account.id, userId],
    );

    const count = Number(result.rows[0]?.active_admin_count ?? 0);
    if (count < 1) {
      throw new AppError(
        'At least one active Customer Administrator is required.',
        409,
        'LAST_ACTIVE_CUSTOMER_ADMIN_REQUIRED',
      );
    }
  }
}

export const customerUsersService = new CustomerUsersService();

function mapCustomerUser(row: CustomerUserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    roleLabel: customerRoleLabels[row.role],
    isActive: row.is_active,
    passwordMustChange: row.password_must_change,
    createdAt: dateString(row.created_at),
    updatedAt: dateString(row.updated_at),
  };
}

function dateString(value: Date | string) {
  return new Date(String(value)).toISOString();
}

function isUniqueEmailViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
