export type ApplicationStatus =
  'SUBMITTED' | 'UNDER_REVIEW' | 'CHANGES_REQUIRED' | 'APPROVED' | 'REJECTED' | 'ACTIVE';

export type ApplicationTimelineStatus = 'completed' | 'current' | 'pending';

export interface ApplicationTimelineItem {
  key: 'submitted' | 'review' | 'activation';
  label: string;
  status: ApplicationTimelineStatus;
}

export interface ApplicationStatusResponse {
  reference: string;
  status: ApplicationStatus;
  statusLabel: string;
  submittedAt: string;
  timeline: ApplicationTimelineItem[];
}

export interface ApplicationStatusLookupRequest {
  reference: string;
  email: string;
}
