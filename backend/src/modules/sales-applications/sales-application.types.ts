import type { RegistrationStatus } from '../registrations/registration.types.js';

export type SalesApplicationStatus = RegistrationStatus;

export interface SalesApplicationListQuery {
  search?: string | undefined;
  reference?: string | undefined;
  company?: string | undefined;
  contact?: string | undefined;
  submittedFrom?: string | undefined;
  submittedTo?: string | undefined;
  status?: SalesApplicationStatus | undefined;
  page: number;
  pageSize: number;
}

export interface SalesApplicationStatusUpdateInput {
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  reason?: string | undefined;
}

export interface SalesApplicationRow {
  id: string;
  reference: string | null;
  status: SalesApplicationStatus;
  current_step: number;
  company: Record<string, unknown>;
  contact: Record<string, unknown>;
  documents: Record<string, unknown>;
  delivery_locations: unknown[];
  administrator: Record<string, unknown>;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  admin_password_hash?: string | null;
  activated_at?: Date | string | null;
}

export interface SalesApplicationStatusEventRow {
  id: string;
  previous_status: SalesApplicationStatus | null;
  new_status: SalesApplicationStatus;
  reason: string | null;
  changed_by: string;
  changed_by_name: string | null;
  changed_by_email: string | null;
  created_at: Date | string;
}
