import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type { RegistrationStatus } from '../registrations/registration.types.js';

export interface CustomerDashboardRow {
  account_id: string;
  company_name: string;
  account_status: string;
  activated_at: Date | string;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  admin_role: CustomerUser['role'];
  registration_id: string;
  registration_reference: string | null;
  registration_status: RegistrationStatus;
  contact: unknown;
  administrator: unknown;
  delivery_locations: unknown;
  submitted_at: Date | string | null;
}

export interface CustomerDeliveryLocationSummary {
  id: string | null;
  name: string | null;
  siteId: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  isPrimary: boolean;
  hasMapLocation: boolean;
}
