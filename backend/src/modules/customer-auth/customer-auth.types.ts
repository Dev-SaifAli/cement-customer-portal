import type { Request } from 'express';
import type { CustomerRole } from './customer-roles.js';

export interface CustomerAccount {
  id: string;
  registrationId: string;
  companyName: string;
  status: string;
}

export interface CustomerUser {
  id: string;
  customerAccountId: string;
  name: string;
  email: string;
  phone: string | null;
  role: CustomerRole;
  isActive: boolean;
  passwordMustChange: boolean;
  account: CustomerAccount;
}

export interface CustomerUserRecord extends CustomerUser {
  passwordHash: string;
  accountIsActive: boolean;
  applicationStatus: string;
}

export interface CustomerLoginRequestBody {
  email: string;
  password: string;
}

export interface CustomerAuthTokenPayload {
  sub: string;
  type: 'customer';
}

export interface CustomerAuthenticatedRequest extends Request {
  customerUser?: CustomerUser;
}
