export type ApplicationStatus =
  'SUBMITTED' | 'UNDER_REVIEW' | 'CHANGES_REQUIRED' | 'APPROVED' | 'REJECTED' | 'ACTIVATED';

export type ApplicationTimelineStatus = 'completed' | 'current' | 'pending';

export interface ApplicationTimelineItem {
  key: 'submitted' | 'review' | 'activation';
  label: string;
  status: ApplicationTimelineStatus;
}

export interface ApplicationStatusResponse {
  id?: string;
  reference: string;
  status: ApplicationStatus;
  statusLabel: string;
  submittedAt: string;
  changeReason?: string | null;
  canUpdateApplication?: boolean;
  timeline: ApplicationTimelineItem[];
}

export interface ApplicationStatusLookupRequest {
  reference: string;
  email: string;
}
