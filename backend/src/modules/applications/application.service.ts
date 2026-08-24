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
  CHANGES_REQUIRED: 'Changes Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVATED: 'Activated',
};

const createTimeline = (status: ApplicationStatus): ApplicationTimelineItem[] => {
  const reviewCompleted = ['APPROVED', 'REJECTED', 'ACTIVATED'].includes(status);
  const activationCompleted = status === 'ACTIVATED';

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
      `select
         drafts.id,
         drafts.reference,
         drafts.status,
         drafts.submitted_at,
         latest_change.reason as change_reason
       from registration_drafts drafts
       left join lateral (
         select reason
         from application_status_events
         where registration_id = drafts.id
           and new_status = 'CHANGES_REQUESTED'
         order by created_at desc
         limit 1
       ) latest_change on true
       where drafts.reference = $1
         and (
           lower(coalesce(drafts.administrator->>'email', '')) = lower($2)
           or lower(coalesce(drafts.contact->>'email', '')) = lower($2)
         )
       limit 1`,
      [payload.reference, payload.email],
    );

    const row = result.rows[0] as
      | {
          id: string;
          reference: string;
          status: string;
          submitted_at: Date | string | null;
          change_reason: string | null;
        }
      | undefined;

    if (!row) {
      throw new AppError(
        'No application was found for the provided reference and registered email.',
        404,
        'APPLICATION_NOT_FOUND',
      );
    }

    const status = normalizeStatus(row.status);
    const canUpdateApplication = row.status === 'CHANGES_REQUESTED';

    return {
      ...(canUpdateApplication ? { id: row.id } : {}),
      reference: row.reference,
      status,
      statusLabel: statusLabels[status],
      submittedAt: row.submitted_at
        ? new Date(String(row.submitted_at)).toISOString()
        : new Date().toISOString(),
      changeReason: canUpdateApplication ? row.change_reason : null,
      canUpdateApplication,
      timeline: createTimeline(status),
    };
  }
}

export const applicationService = new ApplicationService();

function normalizeStatus(status: string): ApplicationStatus {
  if (status === 'PENDING_SALES_REVIEW') return 'UNDER_REVIEW';
  if (status === 'CHANGES_REQUESTED') return 'CHANGES_REQUIRED';
  return status as ApplicationStatus;
}
