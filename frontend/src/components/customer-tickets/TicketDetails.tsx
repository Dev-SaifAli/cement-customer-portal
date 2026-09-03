import { CheckCircle2, Circle, Clock3, Send } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/shadcn';
import type { CustomerTicket, CustomerTicketEvent } from '../../services/customerTicketsService';

export function TicketDetails({
  ticket,
  currentCustomerUserId,
}: {
  ticket: CustomerTicket;
  currentCustomerUserId: string | null;
}) {
  const events = ticket.events ?? [];

  return (
    <div className="max-w-4xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Request Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap rounded-lg border border-[var(--customer-border)] bg-[var(--customer-bg)] p-4 text-sm leading-6 text-[var(--customer-text)]">
            {ticket.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length ? (
            <div className="space-y-4">
              {events.map((event, index) => (
                <ActivityItem
                  key={event.id}
                  event={event}
                  currentCustomerUserId={currentCustomerUserId}
                  isLast={index === events.length - 1}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--customer-text-muted)]">No activity recorded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityItem({
  event,
  currentCustomerUserId,
  isLast,
}: {
  event: CustomerTicketEvent;
  currentCustomerUserId: string | null;
  isLast: boolean;
}) {
  const createdAt = parseTimestamp(event.createdAt);
  const isCreator = event.actor?.kind === 'CUSTOMER' && event.actor.id === currentCustomerUserId;

  return (
    <div className="relative flex gap-3">
      {!isLast && (
        <span className="absolute left-4 top-8 h-[calc(100%+0.25rem)] w-px bg-[var(--customer-border)]" />
      )}
      <span className="relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--customer-primary-soft)] text-[var(--customer-primary)]">
        {activityIcon(event)}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--customer-text)]">{activityTitle(event)}</p>
        {event.type === 'TICKET_CREATED' && (
          <p className="text-xs text-[var(--customer-text-muted)]">
            {isCreator
              ? 'Created By: You'
              : `Created By: ${event.actor?.name ?? 'Customer User'}${
                  event.actor?.role ? ` (${formatRole(event.actor.role)})` : ''
                }`}
          </p>
        )}
        <time className="mt-1 block text-xs font-medium text-[var(--customer-text-muted)]">
          {formatRelativeTime(createdAt)}
        </time>
      </div>
    </div>
  );
}

function activityTitle(event: CustomerTicketEvent) {
  if (event.type === 'TICKET_CREATED') return 'Ticket Created';
  if (event.type === 'TICKET_SUBMITTED') return 'Submitted to Sales';
  if (event.type === 'TICKET_CLOSED') return 'Closed';
  if (event.newStatus === 'OPEN') return 'Opened';
  return 'Ticket Activity';
}

function activityIcon(event: CustomerTicketEvent) {
  if (event.type === 'TICKET_CREATED') return <Circle size={15} />;
  if (event.type === 'TICKET_SUBMITTED') return <Send size={15} />;
  if (event.type === 'TICKET_CLOSED') return <CheckCircle2 size={15} />;
  return <Clock3 size={15} />;
}

function formatRole(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function formatRelativeTime(date: Date) {
  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  const absoluteSeconds = Math.abs(diffSeconds);
  if (absoluteSeconds < 45) return 'just now';
  if (absoluteSeconds < 60 * 60) return `${Math.max(1, Math.round(diffSeconds / 60))} min ago`;
  if (absoluteSeconds < 60 * 60 * 24) {
    const hours = Math.max(1, Math.round(diffSeconds / 3600));
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (absoluteSeconds < 60 * 60 * 48) return 'Yesterday';
  if (absoluteSeconds < 60 * 60 * 24 * 7) return `${Math.round(diffSeconds / 86400)} days ago`;
  if (absoluteSeconds < 60 * 60 * 24 * 30) {
    const weeks = Math.max(1, Math.round(diffSeconds / 604800));
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  if (absoluteSeconds < 60 * 60 * 24 * 365) {
    const months = Math.max(1, Math.round(diffSeconds / 2592000));
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  const years = Math.max(1, Math.round(diffSeconds / 31536000));
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}
