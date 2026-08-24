import type { Request } from 'express';

export interface SalesUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: SalesRole;
}

export type SalesRole = 'SALES_REP' | 'HADER_MANAGER' | 'PRICE_MANAGER';

export interface SalesUserRecord extends SalesUser {
  passwordHash: string;
}

export interface SalesLoginRequestBody {
  email: string;
  password: string;
}

export interface SalesAuthTokenPayload {
  sub: string;
  type: 'sales';
}

export interface SalesAuthenticatedRequest extends Request {
  salesUser?: SalesUser;
}
