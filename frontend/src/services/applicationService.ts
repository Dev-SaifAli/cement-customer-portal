const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type ApplicationStatus =
  'SUBMITTED' | 'UNDER_REVIEW' | 'CHANGES_REQUIRED' | 'APPROVED' | 'REJECTED' | 'ACTIVATED';

export type TimelineStatus = 'completed' | 'current' | 'pending';

export interface ApplicationTimelineItem {
  key: 'submitted' | 'review' | 'activation';
  label: string;
  status: TimelineStatus;
}

export interface ApplicationStatusDetails {
  id?: string;
  reference: string;
  status: ApplicationStatus;
  statusLabel: string;
  submittedAt: string;
  changeReason?: string | null;
  canUpdateApplication?: boolean;
  timeline: ApplicationTimelineItem[];
}

interface ApplicationStatusResponse {
  success: boolean;
  application: ApplicationStatusDetails;
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApplicationServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApplicationServiceError';
  }
}

export const lookupApplicationStatus = async (payload: {
  reference: string;
  email: string;
}): Promise<ApplicationStatusDetails> => {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/applications/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApplicationServiceError('Unable to connect. Please try again.');
  }

  const data = (await response.json().catch(() => ({}))) as Partial<ApplicationStatusResponse>;

  if (!response.ok || !data.application) {
    throw new ApplicationServiceError(
      data.error?.message ?? 'Unable to retrieve application status.',
      response.status,
    );
  }

  return data.application;
};
