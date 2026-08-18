export type RegistrationStatus =
  | 'DRAFT'
  | 'PENDING_SALES_REVIEW'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'ACTIVATED';

export interface RegistrationDraft {
  id: string;
  reference: string | null;
  status: RegistrationStatus;
  currentStep: number;
  company: Record<string, unknown>;
  contact: Record<string, unknown>;
  documents: Record<string, unknown>;
  deliveryLocations: unknown[];
  administrator: Record<string, unknown>;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
