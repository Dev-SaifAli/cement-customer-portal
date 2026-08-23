import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthTokenPayload } from './customer-auth.types.js';

const algorithm = 'HS256';

interface JwtPayload extends CustomerAuthTokenPayload {
  iat: number;
  exp: number;
}

export class CustomerTokenService {
  createToken(payload: CustomerAuthTokenPayload) {
    const secret = this.getSecret();
    const now = Math.floor(Date.now() / 1000);
    const body: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + this.getExpirationSeconds(),
    };
    const header = { alg: algorithm, typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(body));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`, secret);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): CustomerAuthTokenPayload {
    const secret = this.getSecret();
    const [encodedHeader, encodedPayload, signature, ...extraParts] = token.split('.');

    if (!encodedHeader || !encodedPayload || !signature || extraParts.length > 0) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }

    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`, secret);
    if (!safeEqual(signature, expectedSignature)) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }

    const payload = parsePayload(encodedPayload);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now || payload.type !== 'customer' || !payload.sub) {
      throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
    }

    return {
      sub: payload.sub,
      type: payload.type,
    };
  }

  getCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: env.NODE_ENV === 'production',
      maxAge: this.getExpirationSeconds() * 1000,
      path: '/',
    };
  }

  private sign(value: string, secret: string) {
    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  private getSecret() {
    if (!env.JWT_SECRET) {
      throw new AppError(
        'Customer authentication is not configured.',
        500,
        'CUSTOMER_AUTH_NOT_CONFIGURED',
      );
    }

    return env.JWT_SECRET;
  }

  private getExpirationSeconds() {
    return parseDurationSeconds(env.JWT_EXPIRES_IN);
  }
}

export const customerTokenService = new CustomerTokenService();

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function parsePayload(encodedPayload: string): JwtPayload {
  try {
    const value = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<JwtPayload>;

    if (
      typeof value.sub !== 'string' ||
      value.type !== 'customer' ||
      typeof value.iat !== 'number' ||
      typeof value.exp !== 'number'
    ) {
      throw new Error('Invalid token payload');
    }

    return value as JwtPayload;
  } catch {
    throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseDurationSeconds(value: string) {
  const match = /^(?<amount>\d+)(?<unit>[smhd])?$/.exec(value);
  if (!match?.groups) return 60 * 60;

  const amount = Number(match.groups.amount);
  const unit = (match.groups.unit ?? 's') as 's' | 'm' | 'h' | 'd';
  const multipliers: Record<'s' | 'm' | 'h' | 'd', number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return amount * multipliers[unit];
}
