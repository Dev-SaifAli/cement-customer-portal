import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TicketDetails } from '../../components/customer-tickets/TicketDetails';
import { TicketStatusBadge } from '../../components/customer-tickets/TicketStatusBadge';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '../../components/ui/shadcn';
import { useToast } from '../../components/ui/ToastProvider';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  getCustomerTicket,
  submitCustomerTicket,
  type CustomerTicket,
} from '../../services/customerTicketsService';

export function CustomerTicketDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useCustomerAuth();
  const toast = useToast();
  const [ticket, setTicket] = useState<CustomerTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const loadTicket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      setTicket(await getCustomerTicket(id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  const submitDraft = async () => {
    if (!ticket || ticket.status !== 'DRAFT') return;
    setSubmitting(true);
    setError(false);
    try {
      const submitted = await submitCustomerTicket(ticket.id);
      setTicket(submitted);
      setSubmitDialogOpen(false);
      toast.success(`Service request ${submitted.ticketNumber} submitted to Sales.`);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      <Link
        to="/customer/tickets"
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
                <span className="text-sm text-[var(--customer-text-muted)]">·</span>
                <time className="text-sm font-medium text-[var(--customer-text-muted)]">
                  {formatRelativeTime(getLatestTimestamp(ticket.createdAt, ticket.updatedAt))}
                </time>
              </div>
            </div>
            {ticket.status === 'DRAFT' && (
              <Button
                type="button"
                className="shrink-0 bg-[var(--customer-primary-hover)] hover:bg-[var(--customer-primary)]"
                disabled={submitting}
                onClick={() => setSubmitDialogOpen(true)}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </Button>
            )}
          </header>
          <TicketDetails ticket={ticket} currentCustomerUserId={user?.id ?? null} />
          <Dialog
            open={submitDialogOpen}
            onOpenChange={(open) => {
              if (!submitting) setSubmitDialogOpen(open);
            }}
          >
            <DialogContent
              showCloseButton={false}
              className="customer-ticket-submit-dialog"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !submitting) {
                  event.preventDefault();
                  void submitDraft();
                }
              }}
            >
              <DialogHeader>
                <DialogTitle>Submit Service Request?</DialogTitle>
                <DialogDescription>
                  Are you sure you want to submit this service request to the Sales Team? Once
                  submitted, it cannot be edited.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={submitting}
                  onClick={() => setSubmitDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-[#472066] text-white hover:bg-[#54247a]"
                  autoFocus
                  disabled={submitting}
                  onClick={() => void submitDraft()}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
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
