import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesRole } from '../sales-auth/sales-auth.types.js';
import type {
  AdminUserListInput,
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from './admin-users.validation.js';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: SalesRole;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const pageSize = 10;
const passwordHashRounds = env.NODE_ENV === 'test' ? 4 : 12;

export class AdminUsersService {
  async list(input: AdminUserListInput) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (input.search) {
      values.push(`%${input.search}%`);
      conditions.push(`(name ilike $${values.length} or email ilike $${values.length})`);
    }
    if (input.role) {
      values.push(input.role);
      conditions.push(`role = $${values.length}`);
    }
    if (input.status) {
      values.push(input.status === 'ACTIVE');
      conditions.push(`is_active = $${values.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const countResult = await pool.query<{ total: string }>(
      `select count(*)::text as total from sales_users ${where}`,
      values,
    );
    values.push(pageSize, (input.page - 1) * pageSize);
    const result = await pool.query<AdminUserRow>(
      `select id, name, email, role, is_active, created_at, updated_at
       from sales_users
       ${where}
       order by created_at desc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    return {
      users: result.rows.map(mapAdminUser),
      pagination: { page: input.page, pageSize, total: Number(countResult.rows[0]?.total ?? 0) },
    };
  }

  async get(id: string) {
    return mapAdminUser(await this.find(id));
  }

  async create(input: CreateAdminUserInput) {
    const passwordHash = await bcrypt.hash(input.password, passwordHashRounds);
    try {
      const result = await pool.query<AdminUserRow>(
        `insert into sales_users (name, email, password_hash, role, is_active)
         values ($1, $2, $3, $4, $5)
         returning id, name, email, role, is_active, created_at, updated_at`,
        [input.name, input.email, passwordHash, input.role, input.status === 'ACTIVE'],
      );
      const row = result.rows[0];
      if (!row) throw new AppError('Internal user could not be created.', 503, 'ADMIN_USER_CREATE_FAILED');
      return mapAdminUser(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('A user with this email already exists.', 409, 'EMAIL_IN_USE');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateAdminUserInput, actorId: string) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`select pg_advisory_xact_lock(hashtext('active-pricing-admin'))`);
      const currentResult = await client.query<AdminUserRow>(
        `select id, name, email, role, is_active, created_at, updated_at
         from sales_users where id = $1 for update`,
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new AppError('Internal user was not found.', 404, 'ADMIN_USER_NOT_FOUND');
      }

      const isDeactivation = input.status === 'INACTIVE' && current.is_active;
      if (isDeactivation && id === actorId) {
        throw new AppError(
          'You cannot deactivate your own account.',
          409,
          'ADMIN_USER_SELF_DEACTIVATION_FORBIDDEN',
        );
      }
      if (isDeactivation && current.role === 'PRICING_ADMIN') {
        const activeAdminResult = await client.query<{ count: string }>(
          `select count(*)::text as count
           from sales_users
           where role = 'PRICING_ADMIN' and is_active = true`,
        );
        if (Number(activeAdminResult.rows[0]?.count ?? 0) <= 1) {
          throw new AppError(
            'At least one active Pricing Administrator is required.',
            409,
            'LAST_ACTIVE_PRICING_ADMIN_REQUIRED',
          );
        }
      }

      const result = await client.query<AdminUserRow>(
        `update sales_users
         set name = $2, email = $3, role = $4, is_active = $5, updated_at = now()
         where id = $1
         returning id, name, email, role, is_active, created_at, updated_at`,
        [
          id,
          input.name ?? current.name,
          input.email ?? current.email,
          input.role ?? current.role,
          input.status ? input.status === 'ACTIVE' : current.is_active,
        ],
      );
      await client.query('commit');
      return mapAdminUser(result.rows[0] ?? current);
    } catch (error) {
      await client.query('rollback');
      if (isUniqueViolation(error)) {
        throw new AppError('A user with this email already exists.', 409, 'EMAIL_IN_USE');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async find(id: string) {
    const result = await pool.query<AdminUserRow>(
      `select id, name, email, role, is_active, created_at, updated_at
       from sales_users where id = $1 limit 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('Internal user was not found.', 404, 'ADMIN_USER_NOT_FOUND');
    return row;
  }
}

export const adminUsersService = new AdminUsersService();

function mapAdminUser(row: AdminUserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.is_active ? ('ACTIVE' as const) : ('INACTIVE' as const),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
