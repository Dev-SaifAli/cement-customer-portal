import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import { emailService } from '../email/email.service.js';
import { captchaService } from './captcha.service.js';
import type {
  ForgotPasswordRequestBody,
  LoginRequestBody,
  ResetPasswordRequestBody,
} from './auth.types.js';

const genericForgotPasswordMessage =
  'If an account exists, a password reset link has been sent.';
const resetTokenLifetimeHours = 4;
type ResetIdentityType = 'CUSTOMER' | 'SALES';

interface ResetIdentity {
  userType: ResetIdentityType;
  userId: string;
  name: string;
  email: string;
}

interface ResetTokenRow {
  id: string;
  user_type: ResetIdentityType;
  customer_user_id: string | null;
  sales_user_id: string | null;
  expires_at: Date;
  customer_eligible: boolean | null;
  sales_eligible: boolean | null;
  sales_role: string | null;
}

export class AuthService {
  async createCaptchaChallenge() {
    return {
      success: true,
      captcha: captchaService.createChallenge(),
    };
  }

  async login(payload: LoginRequestBody) {
    await captchaService.verifyChallenge({
      challengeId: payload.captchaChallengeId,
      answer: payload.captchaAnswer,
    });

    throw new AppError('Authentication service is not connected yet.', 501, 'AUTH_NOT_CONFIGURED');
  }

  async forgotPassword(payload: ForgotPasswordRequestBody) {
    await captchaService.verifyChallenge({
      challengeId: payload.captchaChallengeId,
      answer: payload.captchaAnswer,
    });
    const identifier = normalizeIdentifier(payload.identifier);
    const isEmail = identifier.includes('@');

    try {
      const identity = await findUniqueEligibleIdentity(identifier, isEmail);
      if (identity && isEmail && emailService.isConfigured()) await issueEmailReset(identity);
    } catch (error) {
      logger.error({ err: error }, 'Password reset request processing failed.');
    }

    return {
      success: true,
      message: genericForgotPasswordMessage,
    };
  }

  async resetPassword(payload: ResetPasswordRequestBody) {
    const tokenHash = hashToken(payload.token);
    const client = await pool.connect();

    try {
      await client.query('begin');
      const result = await client.query<ResetTokenRow>(
        `select
           reset_tokens.id,
           reset_tokens.user_type,
           reset_tokens.customer_user_id,
           reset_tokens.sales_user_id,
           reset_tokens.expires_at,
           case when customer_users.id is null then null else (
             customer_users.is_active = true
             and customer_accounts.status = 'ACTIVE'
             and registration_drafts.status = 'ACTIVATED'
           ) end as customer_eligible,
           case when sales_users.id is null then null else sales_users.is_active end as sales_eligible,
           sales_users.role as sales_role
         from password_reset_tokens reset_tokens
         left join customer_users on customer_users.id = reset_tokens.customer_user_id
         left join customer_accounts on customer_accounts.id = customer_users.customer_account_id
         left join registration_drafts on registration_drafts.id = customer_accounts.registration_id
         left join sales_users on sales_users.id = reset_tokens.sales_user_id
         where reset_tokens.token_hash = $1
           and reset_tokens.used_at is null
         for update of reset_tokens`,
        [tokenHash],
      );
      const token = result.rows[0];

      if (!token) {
        throw new AppError(
          'This password reset link is invalid or has already been used. Request a new one.',
          400,
          'PASSWORD_RESET_INVALID',
        );
      }
      if (token.expires_at.getTime() <= Date.now()) {
        throw new AppError(
          'This password reset link has expired. Request a new one.',
          400,
          'PASSWORD_RESET_EXPIRED',
        );
      }

      const eligible =
        token.user_type === 'CUSTOMER' ? token.customer_eligible : token.sales_eligible;
      const userId = token.customer_user_id ?? token.sales_user_id;
      if (!eligible || !userId) {
        throw new AppError(
          'This password reset link is invalid or has already been used. Request a new one.',
          400,
          'PASSWORD_RESET_INVALID',
        );
      }

      const passwordHash = await bcrypt.hash(payload.newPassword, 12);
      if (token.user_type === 'CUSTOMER') {
        await client.query(
          `update customer_users
           set password_hash = $1, password_must_change = false, updated_at = now()
           where id = $2`,
          [passwordHash, userId],
        );
      } else {
        await client.query(
          `update sales_users set password_hash = $1, updated_at = now() where id = $2`,
          [passwordHash, userId],
        );
      }

      await client.query(
        `update password_reset_tokens
         set used_at = now()
         where used_at is null
           and (
             ($1 = 'CUSTOMER' and customer_user_id = $2)
             or ($1 = 'SALES' and sales_user_id = $2)
           )`,
        [token.user_type, userId],
      );
      await client.query('commit');

      logger.info(
        { event: 'PASSWORD_RESET_COMPLETED', userType: token.user_type, userId },
        'Password reset completed.',
      );

      return {
        success: true,
        message: 'Password updated successfully. You can now sign in.',
        loginPath:
          token.user_type === 'CUSTOMER'
            ? '/login'
            : token.sales_role === 'PORTAL_ADMINISTRATOR'
              ? '/admin/login'
              : '/sales/login',
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const authService = new AuthService();

function normalizeIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
}

async function findUniqueEligibleIdentity(
  identifier: string,
  isEmail: boolean,
): Promise<ResetIdentity | null> {
  const result = await pool.query<{
    user_type: ResetIdentityType;
    user_id: string;
    name: string;
    email: string;
  }>(
    isEmail
      ? `select 'CUSTOMER' as user_type, customer_users.id as user_id,
            customer_users.name, customer_users.email
         from customer_users
         inner join customer_accounts on customer_accounts.id = customer_users.customer_account_id
         inner join registration_drafts on registration_drafts.id = customer_accounts.registration_id
         where lower(customer_users.email) = $1
           and customer_users.is_active = true
           and customer_accounts.status = 'ACTIVE'
           and registration_drafts.status = 'ACTIVATED'
         union all
         select 'SALES' as user_type, sales_users.id as user_id,
            sales_users.name, sales_users.email
         from sales_users
         where lower(sales_users.email) = $1
           and sales_users.is_active = true
         limit 2`
      : `select 'CUSTOMER' as user_type, customer_users.id as user_id,
                customer_users.name, customer_users.email
         from customer_users
         inner join customer_accounts on customer_accounts.id = customer_users.customer_account_id
         inner join registration_drafts on registration_drafts.id = customer_accounts.registration_id
         where customer_users.phone = $1
           and customer_users.is_active = true
           and customer_accounts.status = 'ACTIVE'
           and registration_drafts.status = 'ACTIVATED'
         limit 2`,
    [identifier],
  );

  if (result.rows.length !== 1) return null;
  const row = result.rows[0];
  return row
    ? { userType: row.user_type, userId: row.user_id, name: row.name, email: row.email }
    : null;
}

async function issueEmailReset(identity: ResetIdentity) {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const client = await pool.connect();

  try {
    await client.query('begin');
    await lockIdentity(client, identity);
    await invalidateActiveTokens(client, identity);
    await client.query(
      `insert into password_reset_tokens (
         user_type, customer_user_id, sales_user_id, token_hash, expires_at
       ) values ($1, $2, $3, $4, now() + interval '4 hours')`,
      [
        identity.userType,
        identity.userType === 'CUSTOMER' ? identity.userId : null,
        identity.userType === 'SALES' ? identity.userId : null,
        tokenHash,
      ],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  const resetUrl = `${env.APP_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
  try {
    await emailService.sendEmail({
      to: identity.email,
      subject: 'Reset your AlSafwa Portal password',
      text: [
        `Hello ${identity.name},`,
        '',
        'Use the link below to reset your portal password:',
        resetUrl,
        '',
        `This link expires in ${resetTokenLifetimeHours} hours and can be used once.`,
        'If you did not request this reset, you can ignore this message.',
      ].join('\n'),
    });
    logger.info(
      { event: 'PASSWORD_RESET_REQUESTED', userType: identity.userType, userId: identity.userId },
      'Password reset requested.',
    );
  } catch (error) {
    await pool.query(
      'update password_reset_tokens set used_at = now() where token_hash = $1 and used_at is null',
      [tokenHash],
    );
    logger.error(
      { err: error, userType: identity.userType, userId: identity.userId },
      'Password reset email delivery failed.',
    );
  }
}

async function lockIdentity(client: PoolClient, identity: ResetIdentity) {
  const table = identity.userType === 'CUSTOMER' ? 'customer_users' : 'sales_users';
  await client.query(`select id from ${table} where id = $1 for update`, [identity.userId]);
}

async function invalidateActiveTokens(client: PoolClient, identity: ResetIdentity) {
  await client.query(
    `update password_reset_tokens
     set used_at = now()
     where used_at is null
       and (
         ($1 = 'CUSTOMER' and customer_user_id = $2)
         or ($1 = 'SALES' and sales_user_id = $2)
       )`,
    [identity.userType, identity.userId],
  );
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
