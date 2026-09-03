import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TicketStatusBadge } from '../../components/customer-tickets/TicketStatusBadge';
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
  Label,
  Textarea,
} from '../../components/ui/shadcn';
import { useToast } from '../../components/ui/ToastProvider';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  createCustomerTicket,
  submitCustomerTicket,
  updateCustomerTicketDraft,
  type CustomerTicket,
} from '../../services/customerTicketsService';

const maxDescriptionLength = 2000;

export function CustomerTicketNew() {
  const { user } = useCustomerAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [description, setDescription] = useState('');
  const [ticket, setTicket] = useState<CustomerTicket | null>(null);
  const [lastSavedDescription, setLastSavedDescription] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const canCreate = user?.role !== 'VIEWER';
  const isDraft = ticket?.status === 'DRAFT';
  const isReadOnly = Boolean(ticket && ticket.status !== 'DRAFT');
  const hasUnsavedDraftChanges = isDraft && description.trim() !== lastSavedDescription;
  const primaryAction = useMemo(() => {
    if (!ticket) return 'save';
    if (ticket.status === 'DRAFT' && hasUnsavedDraftChanges) return 'save';
    if (ticket.status === 'DRAFT') return 'submit';
    return null;
  }, [hasUnsavedDraftChanges, ticket]);

  const validateDescription = useCallback(() => {
    const trimmed = description.trim();
    setFieldError('');

    if (!trimmed) {
      setFieldError('Description is required.');
      return null;
    }
    if (trimmed.length > maxDescriptionLength) {
      setFieldError('Description must be 2,000 characters or fewer.');
      return null;
    }

    return trimmed;
  }, [description]);

  const saveDraft = useCallback(async () => {
    setSubmitError('');
    const trimmed = validateDescription();
    if (!trimmed) return null;

    setSaving(true);
    try {
      const savedTicket =
        ticket?.status === 'DRAFT'
          ? await updateCustomerTicketDraft(ticket.id, { description: trimmed })
          : await createCustomerTicket({ description: trimmed });
      setTicket(savedTicket);
      setDescription(savedTicket.description);
      setLastSavedDescription(savedTicket.description.trim());
      toast.success(`Draft ${savedTicket.ticketNumber} saved.`);
      return savedTicket;
    } catch {
      setSubmitError('Unable to save service request.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [ticket, toast, validateDescription]);

  const submitDraft = async () => {
    setSubmitError('');
    if (!ticket || ticket.status !== 'DRAFT' || hasUnsavedDraftChanges) return;

    setSubmitting(true);
    try {
      const submitted = await submitCustomerTicket(ticket.id);
      setTicket(submitted);
      setDescription(submitted.description);
      setLastSavedDescription(submitted.description.trim());
      setSubmitDialogOpen(false);
      toast.success(`Service request ${submitted.ticketNumber} submitted to Sales.`);
      navigate(`/customer/tickets/${submitted.id}`);
    } catch {
      setSubmitError('Unable to submit service request.');
    } finally {
      setSubmitting(false);
    }
  };

  const runPrimaryAction = useCallback(() => {
    if (primaryAction === 'save') {
      void saveDraft();
    } else if (primaryAction === 'submit') {
      setSubmitDialogOpen(true);
    }
  }, [primaryAction, saveDraft]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!saving && !submitting && primaryAction) runPrimaryAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [primaryAction, runPrimaryAction, saving, submitting]);

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runPrimaryAction();
  };

  if (!canCreate) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          to="/customer/tickets"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--customer-primary)] hover:underline"
        >
          <ArrowLeft size={16} /> Service Requests
        </Link>
        <Notice tone="warning" title="View-only access">
          Your role can view service requests, but cannot create a new service request.
        </Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      <Link
        to="/customer/tickets"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--customer-primary)] hover:underline"
      >
        <ArrowLeft size={16} /> Service Requests
      </Link>

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--customer-border)] bg-[var(--customer-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--customer-text)]">
              {ticket?.ticketNumber ?? 'New Service Request'}
            </h1>
            {ticket && <TicketStatusBadge status={ticket.status} />}
            {ticket && (
              <>
                <span className="text-sm text-[var(--customer-text-muted)]">·</span>
                <time className="text-sm font-medium text-[var(--customer-text-muted)]">
                  {formatRelativeTime(getLatestTimestamp(ticket.createdAt, ticket.updatedAt))}
                </time>
              </>
            )}
          </div>
        </div>
        {primaryAction && (
          <Button
            type="button"
            className="shrink-0 bg-[var(--customer-primary-hover)] hover:bg-[var(--customer-primary)]"
            disabled={saving || submitting}
            onClick={runPrimaryAction}
          >
            {primaryAction === 'save'
              ? saving
                ? 'Saving...'
                : 'Save'
              : submitting
                ? 'Submitting...'
                : 'Submit'}
          </Button>
        )}
      </header>

      {submitError && (
        <Notice tone="danger" title={submitError} />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Request Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleFormSubmit}>
            <div className="space-y-2">
              <Label htmlFor="ticket-description">Description *</Label>
              <Textarea
                id="ticket-description"
                value={description}
                maxLength={maxDescriptionLength}
                onChange={(event) => setDescription(event.target.value)}
                disabled={saving || submitting || isReadOnly}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? 'ticket-description-error' : undefined}
              />
              {fieldError && (
                <p
                  id="ticket-description-error"
                  className="text-xs font-medium text-[var(--customer-danger)]"
                >
                  {fieldError}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

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
    </div>
  );
}

function Notice({
  children,
  title,
  tone,
}: {
  children?: ReactNode;
  title: string;
  tone: 'danger' | 'warning';
}) {
  const toneClasses =
    tone === 'danger'
      ? 'border-[var(--customer-danger)]/30 bg-[var(--customer-danger)]/10 text-[var(--customer-danger)]'
      : 'border-[var(--customer-warning)]/30 bg-[var(--customer-warning)]/10 text-[var(--customer-warning)]';

  return (
    <Card className={toneClasses}>
      <CardContent className="p-4">
        <p className="font-semibold">{title}</p>
        {children && <p className="mt-1 text-sm">{children}</p>}
      </CardContent>
    </Card>
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
