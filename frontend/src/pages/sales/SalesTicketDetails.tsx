import { ArrowLeft, CheckCircle2, Circle, Clock3, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CrmHandoffBadge, TicketStatusBadge } from '../../components/customer-tickets/TicketStatusBadge';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  Skeleton,
} from '../../components/ui/shadcn';
import { useToast } from '../../components/ui/ToastProvider';
import {
  getSalesTicket,
  sendSalesTicketToCrm,
  type CustomerTicket,
  type CustomerTicketEvent,
} from '../../services/customerTicketsService';

export function SalesTicketDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [ticket, setTicket] = useState<CustomerTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const loadTicket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      setTicket(await getSalesTicket(id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  const sendToCrm = async () => {
    if (!ticket || ticket.status !== 'SUBMITTED') return;
    setSending(true);
    setError(false);
    try {
      const updated = await sendSalesTicketToCrm(ticket.id);
      setTicket(updated);
      setSendDialogOpen(false);
      toast.success(`Service request ${updated.ticketNumber} sent to CRM.`);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      <Link
        to="/sales/tickets"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--customer-primary)] hover:underline"
      >
        <ArrowLeft size={16} /> Service Requests
      </Link>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4" aria-label="Loading service request">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-20" />
              <Skeleton className="h-32" />
            </div>
          </CardContent>
        </Card>
      ) : error || !ticket ? (
        <Card className="border-[var(--customer-danger)]/30 bg-[var(--customer-danger)]/10">
          <CardContent className="p-4">
            <p className="font-semibold text-[var(--customer-danger)]">
              Unable to load this service request.
            </p>
            <div className="mt-3">
              <Button variant="secondary" type="button" onClick={() => void loadTicket()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <header className="flex flex-col gap-4 rounded-xl border border-[var(--customer-border)] bg-[var(--customer-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--customer-text)]">
                  {ticket.ticketNumber}
                </h1>
                <TicketStatusBadge status={ticket.status} />
                <CrmHandoffBadge status={ticket.crmHandoffStatus} />
                <span className="text-sm text-[var(--customer-text-muted)]">·</span>
                <time
                  title={getLatestTimestamp(ticket.createdAt, ticket.updatedAt).toLocaleString()}
                  className="text-sm font-medium text-[var(--customer-text-muted)]"
                >
                  {formatRelativeTime(getLatestTimestamp(ticket.createdAt, ticket.updatedAt))}
                </time>
              </div>
            </div>
            {ticket.status === 'SUBMITTED' && (
              <Button
                type="button"
                className="shrink-0 bg-[#472066] text-white hover:bg-[#54247a]"
                disabled={sending}
                onClick={() => setSendDialogOpen(true)}
              >
                {sending ? 'Sending...' : 'Send to CRM'}
              </Button>
            )}
          </header>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
            <main className="space-y-4">
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

              {ticket.status === 'CLOSED' && ticket.crmResponse && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Resolution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--customer-text)]">
                      {ticket.crmResponse}
                    </p>
                    {ticket.crmResolvedAt && (
                      <time className="text-xs font-medium text-[var(--customer-text-muted)]">
                        Closed {formatRelativeTime(parseTimestamp(ticket.crmResolvedAt))}
                      </time>
                    )}
                  </CardContent>
                </Card>
              )}
            </main>

            <aside className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Ticket Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="Customer" value={ticket.customer.companyName ?? 'Customer'} />
                  <InfoRow
                    label="Customer User"
                    value={ticket.customerUser.name ?? ticket.customerUser.email ?? 'Customer User'}
                  />
                  <InfoRow label="User Role" value={formatRole(ticket.customerUser.role)} />
                  <Separator />
                  <InfoRow label="Status" value={<TicketStatusBadge status={ticket.status} />} />
                  <InfoRow
                    label="CRM Handoff"
                    value={<CrmHandoffBadge status={ticket.crmHandoffStatus} />}
                  />
                  <InfoRow
                    label="Created By"
                    value={ticket.createdBy.name ?? ticket.createdBy.email ?? 'Customer User'}
                  />
                  <InfoRow
                    label="Last Activity"
                    value={formatRelativeTime(getLatestTimestamp(ticket.createdAt, ticket.updatedAt))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {ticket.events?.length ? (
                    <div className="space-y-4">
                      {ticket.events.map((event, index) => (
                        <ActivityItem
                          key={event.id}
                          event={event}
                          isLast={index === (ticket.events?.length ?? 0) - 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--customer-text-muted)]">
                      No activity recorded.
                    </p>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>

          <Dialog
            open={sendDialogOpen}
            onOpenChange={(open) => {
              if (!sending) setSendDialogOpen(open);
            }}
          >
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Send Ticket to CRM?</DialogTitle>
                <DialogDescription>
                  This will send the customer request to the CRM processing team.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={sending}
                  onClick={() => setSendDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-[#472066] text-white hover:bg-[#54247a]"
                  disabled={sending}
                  onClick={() => void sendToCrm()}
                >
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[var(--customer-text-muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--customer-text)]">{value}</span>
    </div>
  );
}

function ActivityItem({ event, isLast }: { event: CustomerTicketEvent; isLast: boolean }) {
  const createdAt = parseTimestamp(event.createdAt);

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
        <p className="text-xs text-[var(--customer-text-muted)]">{activityActor(event)}</p>
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
  if (event.type === 'TICKET_SENT_TO_CRM') return 'Sent to CRM';
  if (event.type === 'TICKET_CLOSED') return 'Closed';
  if (event.newStatus === 'OPEN') return 'Opened';
  return 'Ticket Activity';
}

function activityActor(event: CustomerTicketEvent) {
  if (!event.actor) return 'System activity';
  const name = event.actor.name ?? (event.actor.kind === 'SALES' ? 'Sales user' : 'Customer user');
  return event.actor.kind === 'SALES' ? `By ${name}` : `By ${name}`;
}

function activityIcon(event: CustomerTicketEvent) {
  if (event.type === 'TICKET_CREATED') return <Circle size={15} />;
  if (event.type === 'TICKET_SUBMITTED') return <Send size={15} />;
  if (event.type === 'TICKET_SENT_TO_CRM') return <Send size={15} />;
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

function getLatestTimestamp(createdAt: string, updatedAt: string) {
  const created = parseTimestamp(createdAt);
  const updated = parseTimestamp(updatedAt);
  return updated.getTime() >= created.getTime() ? updated : created;
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
