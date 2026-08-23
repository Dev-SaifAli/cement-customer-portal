import bcrypt from 'bcryptjs';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type {
  CreateCustomerUserInput,
  UpdateCustomerUserInput,
} from './customer-users.validation.js';

interface CustomerUserRow {
  id: string;
  customer_account_id: string;
  name: string;
  email: string;
  role: CustomerUser['role'];
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const customerUserNotFoundError = new AppError(
  'Customer user was not found.',
  404,
  'CUSTOMER_USER_NOT_FOUND',
);

export class CustomerUsersService {
  async list(customerUser: CustomerUser) {
    const result = await pool.query<CustomerUserRow>(
      `select
         id,
         customer_account_id,
         name,
         email,
         role,
         is_active,
         created_at,
         updated_at
       from customer_users
       where customer_account_id = $1
       order by created_at asc`,
      [customerUser.account.id],
    );

    return result.rows.map(mapCustomerUser);
  }

  async create(customerUser: CustomerUser, input: CreateCustomerUserInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);

    try {
      const result = await pool.query<CustomerUserRow>(
        `insert into customer_users (
           customer_account_id,
           name,
           email,
           password_hash,
           role,
           is_active
         )
         values ($1, $2, $3, $4, $5, $6)
         returning
           id,
           customer_account_id,
           name,
           email,
           role,
           is_active,
           created_at,
           updated_at`,
        [
          customerUser.account.id,
          input.name,
          input.email,
          passwordHash,
          input.role ?? 'CUSTOMER_ADMIN',
          input.isActive ?? true,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError('Customer user could not be created.', 503, 'CUSTOMER_USER_CREATE_FAILED');
      }

      return mapCustomerUser(row);
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

    try {
      const result = await pool.query<CustomerUserRow>(
        `update customer_users
         set name = $3,
             email = $4,
             is_active = $5,
             updated_at = now()
         where id = $2
           and customer_account_id = $1
         returning
           id,
           customer_account_id,
           name,
           email,
           role,
           is_active,
           created_at,
           updated_at`,
        [
          customerUser.account.id,
          userId,
          input.name ?? current.name,
          input.email ?? current.email,
          input.isActive ?? current.is_active,
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
         role,
         is_active,
         created_at,
         updated_at
       from customer_users
       where id = $2
         and customer_account_id = $1
       limit 1`,
      [customerUser.account.id, userId],
    );

    const row = result.rows[0];
    if (!row) {
      throw customerUserNotFoundError;
    }

    return row;
  }
}

export const customerUsersService = new CustomerUsersService();

function mapCustomerUser(row: CustomerUserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
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
