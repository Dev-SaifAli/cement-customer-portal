import { AppError } from '../../errors/app-error.js';
import { pool } from '../../database/pool.js';
import type {
  ApplicationStatus,
  ApplicationStatusLookupRequest,
  ApplicationStatusResponse,
  ApplicationTimelineItem,
} from './application.types.js';

const statusLabels: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Pending Sales Review',
  CHANGES_REQUIRED: 'Changes Required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVE: 'Account Active',
};

const createTimeline = (status: ApplicationStatus): ApplicationTimelineItem[] => {
  const reviewCompleted = ['APPROVED', 'REJECTED', 'ACTIVE'].includes(status);
  const activationCompleted = status === 'ACTIVE';

  return [
    {
      key: 'submitted',
      label: 'Application Submitted',
      status: 'completed',
    },
    {
      key: 'review',
      label: 'Sales Team Review',
      status: reviewCompleted ? 'completed' : 'current',
    },
    {
      key: 'activation',
      label: 'Account Activation',
      status: activationCompleted ? 'completed' : reviewCompleted ? 'current' : 'pending',
    },
  ];
};

export class ApplicationService {
  async getApplicationStatus(
    payload: ApplicationStatusLookupRequest,
  ): Promise<ApplicationStatusResponse> {
    if (!payload.reference || !payload.email) {
      throw new AppError(
        'Application reference and registered email are required.',
        400,
        'APPLICATION_LOOKUP_REQUIRED',
      );
    }

    const result = await pool.query(
      `select reference, status, submitted_at
       from registration_drafts
       where reference = $1
         and lower(coalesce(administrator->>'email', contact->>'email')) = lower($2)
       limit 1`,
      [payload.reference, payload.email],
    );

    const row = result.rows[0] as
      { reference: string; status: string; submitted_at: Date | string | null } | undefined;

    if (!row) {
      throw new AppError(
        'No application was found for the provided reference and registered email.',
        404,
        'APPLICATION_NOT_FOUND',
      );
    }

    const status = normalizeStatus(row.status);

    return {
      reference: row.reference,
      status,
      statusLabel: statusLabels[status],
      submittedAt: row.submitted_at
        ? new Date(String(row.submitted_at)).toISOString()
        : new Date().toISOString(),
      timeline: createTimeline(status),
    };
  }
}

export const applicationService = new ApplicationService();

function normalizeStatus(status: string): ApplicationStatus {
  if (status === 'PENDING_SALES_REVIEW') return 'UNDER_REVIEW';
  if (status === 'CHANGES_REQUESTED') return 'CHANGES_REQUIRED';
  if (status === 'ACTIVATED') return 'ACTIVE';
  return status as ApplicationStatus;
}
