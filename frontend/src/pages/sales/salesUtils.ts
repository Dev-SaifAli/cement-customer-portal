import type { SalesApplicationStatus } from '../../services/salesService';

export const salesStatuses: SalesApplicationStatus[] = [
  'PENDING_SALES_REVIEW',
  'UNDER_REVIEW',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
];

export const statusLabels: Record<SalesApplicationStatus, string> = {
  DRAFT: 'Draft',
  PENDING_SALES_REVIEW: 'Pending Review',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes Requested',
  ACTIVATED: 'Activated',
};

export const statusBadgeClasses: Record<SalesApplicationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  PENDING_SALES_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-200',
  UNDER_REVIEW: 'bg-blue-50 text-blue-700 ring-blue-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  CHANGES_REQUESTED: 'bg-orange-50 text-orange-700 ring-orange-200',
  ACTIVATED: 'bg-purple-50 text-purple-700 ring-purple-200',
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

export const displayValue = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return '—';
};

export const getAllowedActions = (status: SalesApplicationStatus) => {
  if (status === 'PENDING_SALES_REVIEW') {
    return [{ label: 'Start Review', status: 'UNDER_REVIEW' as const, requiresReason: false }];
  }
  if (status === 'UNDER_REVIEW') {
    return [
      { label: 'Approve', status: 'APPROVED' as const, requiresReason: false },
      { label: 'Reject', status: 'REJECTED' as const, requiresReason: true },
      {
        label: 'Request Changes',
        status: 'CHANGES_REQUESTED' as const,
        requiresReason: true,
      },
    ];
  }
  if (status === 'CHANGES_REQUESTED') {
    return [{ label: 'Start Review', status: 'UNDER_REVIEW' as const, requiresReason: false }];
  }
  return [];
};
