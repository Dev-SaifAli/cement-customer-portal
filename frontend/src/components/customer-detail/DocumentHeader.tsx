import type { ReactNode } from 'react';
import { Badge } from '../ui/shadcn';
import { cn } from '../../lib/utils';

type StatusTone = 'default' | 'success' | 'warning' | 'destructive' | 'secondary';

export function DocumentHeader({
  number,
  status,
  actions,
  description,
  className,
}: {
  number: string;
  status?: ReactNode;
  actions?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-[var(--customer-border)] pb-4',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-all text-2xl font-semibold text-[var(--customer-text)]">
            {number}
          </h1>
          {status}
        </div>
        {description && (
          <div className="mt-1 text-sm text-[var(--customer-text-muted)]">{description}</div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function DocumentStatusBadge({ label, tone = 'secondary' }: { label: string; tone?: StatusTone }) {
  return (
    <Badge variant={tone} className="gap-1.5 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function DocumentStateBadge({
  persisted,
  status,
  label,
  tone,
}: {
  persisted: boolean;
  status?: string | null;
  label?: string;
  tone?: StatusTone;
}) {
  if (!persisted) return <DocumentStatusBadge label="Not Saved" tone="warning" />;

  const resolvedLabel = label ?? formatDocumentStatus(status ?? 'DRAFT');
  return (
    <DocumentStatusBadge
      label={resolvedLabel}
      tone={tone ?? documentStatusTone(status ?? 'DRAFT')}
    />
  );
}

function formatDocumentStatus(status: string) {
  return status
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function documentStatusTone(status: string): StatusTone {
  if (['APPROVED', 'ACCEPTED', 'ACTIVE', 'COMPLETED'].includes(status)) return 'success';
  if (['REJECTED', 'CANCELLED'].includes(status)) return 'destructive';
  if (status === 'DRAFT') return 'secondary';
  return 'default';
}
