import bcrypt from 'bcryptjs';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesLoginRequestBody, SalesUser, SalesUserRecord } from './sales-auth.types.js';
import { salesTokenService } from './sales-token.service.js';

const genericAuthenticationError = 'Invalid email or password.';

export class SalesAuthService {
  async login(payload: SalesLoginRequestBody) {
    const email = payload.email.toLowerCase();
    const user = await this.findSalesUserByEmail(email);

    if (!user || !user.isActive) {
      throw new AppError(genericAuthenticationError, 401, 'SALES_AUTH_INVALID_CREDENTIALS');
    }

    const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError(genericAuthenticationError, 401, 'SALES_AUTH_INVALID_CREDENTIALS');
    }

    return {
      token: salesTokenService.createToken({ sub: user.id, type: 'sales' }),
      user: toSafeSalesUser(user),
    };
  }

  async getAuthenticatedUser(userId: string) {
    const user = await this.findSalesUserById(userId);

    if (!user || !user.isActive) {
      throw new AppError('Sales authentication is required.', 401, 'SALES_AUTH_REQUIRED');
    }

    return toSafeSalesUser(user);
  }

  private async findSalesUserByEmail(email: string): Promise<SalesUserRecord | null> {
    const result = await pool.query(
      `select id, name, email, password_hash, is_active, role
       from sales_users
       where email = $1
       limit 1`,
      [email],
    );

    return result.rows[0] ? mapSalesUserRecord(result.rows[0] as SalesUserRow) : null;
  }

  private async findSalesUserById(id: string): Promise<SalesUserRecord | null> {
    const result = await pool.query(
      `select id, name, email, password_hash, is_active, role
       from sales_users
       where id = $1
       limit 1`,
      [id],
    );

    return result.rows[0] ? mapSalesUserRecord(result.rows[0] as SalesUserRow) : null;
  }
}

export const salesAuthService = new SalesAuthService();

interface SalesUserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  role?: SalesUser['role'];
}

function mapSalesUserRecord(row: SalesUserRow): SalesUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    role: row.role ?? 'SALES_REP',
  };
}

function toSafeSalesUser(user: SalesUserRecord): SalesUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    role: user.role,
  };
}
