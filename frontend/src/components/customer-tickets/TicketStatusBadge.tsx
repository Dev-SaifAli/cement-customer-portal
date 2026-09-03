import { Badge } from '../ui/shadcn';
import type {
  CrmHandoffStatus,
  CustomerTicketStatus,
} from '../../services/customerTicketsService';

export function TicketStatusBadge({ status }: { status: CustomerTicketStatus }) {
  const statusConfig = {
    DRAFT: {
      label: 'Draft',
      className:
        'border-[var(--customer-border)] bg-[var(--customer-bg)] text-[var(--customer-text-muted)]',
      variant: 'outline' as const,
    },
    SUBMITTED: {
      label: 'Submitted',
      className:
        'bg-[var(--customer-primary)]/15 text-[var(--customer-primary)] hover:bg-[var(--customer-primary)]/20',
      variant: 'secondary' as const,
    },
    OPEN: {
      label: 'Open',
      className:
        'bg-[var(--customer-warning)]/15 text-[var(--customer-warning)] hover:bg-[var(--customer-warning)]/20',
      variant: 'secondary' as const,
    },
    CLOSED: {
      label: 'Closed',
      className: 'bg-[var(--customer-success)] text-white hover:bg-[var(--customer-success)]',
      variant: 'default' as const,
    },
  }[status];

  return (
    <Badge
      variant={statusConfig.variant}
      className={statusConfig.className}
    >
      {statusConfig.label}
    </Badge>
  );
}

export function CrmHandoffBadge({ status }: { status: CrmHandoffStatus }) {
  return (
    <Badge
      variant={status === 'SENT' ? 'default' : 'outline'}
      className={
        status === 'SENT'
          ? 'bg-[var(--customer-success)] text-white hover:bg-[var(--customer-success)]'
          : 'border-[var(--customer-border)] text-[var(--customer-text-muted)]'
      }
    >
      {status === 'SENT' ? 'Sent' : 'Not Sent'}
    </Badge>
  );
}
