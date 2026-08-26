import type { Request } from 'express';

export interface SalesUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: SalesRole;
}

export type SalesRole =
  | 'SALES_REP'
  | 'HADER_MANAGER'
  | 'HADER_OPERATIONS'
  | 'DISPATCH_USER'
  | 'PRICE_MANAGER'
  | 'PRICING_ADMIN';

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
