import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  MapPin,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  activateSalesApplication,
  getSalesApplication,
  getSalesApplicationDocumentUrl,
  SalesApiError,
  updateSalesApplicationStatus,
  type SalesApplicationDetails,
} from '../../services/salesService';
import { ErrorBanner, StatusBadge } from './SalesDashboard';
import { displayValue, formatDateTime, getAllowedActions, statusLabels } from './salesUtils';

export function SalesApplicationDetailsPage() {
  const { id } = useParams();
  const [application, setApplication] = useState<SalesApplicationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedAction, setSelectedAction] = useState<
    ReturnType<typeof getAllowedActions>[number] | null
  >(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activating, setActivating] = useState(false);

  const loadApplication = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setApplication(await getSalesApplication(id));
    } catch (loadError) {
      setError(
        loadError instanceof SalesApiError ? loadError.message : 'Unable to load application.',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  const actions = application ? getAllowedActions(application.status) : [];

  const handleAction = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !selectedAction) return;
    setActionError('');

    if (selectedAction.requiresReason && !reason.trim()) {
      setActionError('Reason is required for this action.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Parameters<typeof updateSalesApplicationStatus>[1] = {
        status: selectedAction.status,
      };
      if (reason.trim()) {
        payload.reason = reason.trim();
      }

      await updateSalesApplicationStatus(id, payload);
      setSelectedAction(null);
      setReason('');
      await loadApplication();
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof SalesApiError
          ? actionFailure.message
          : 'Unable to update application status.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateAccount = async () => {
    if (!id) return;
    setActionError('');
    setActivating(true);

    try {
      await activateSalesApplication(id);
      await loadApplication();
    } catch (activationFailure) {
      setActionError(
        activationFailure instanceof SalesApiError
          ? activationFailure.message
          : 'Unable to activate customer account.',
      );
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading application details...</p>;
  }

  if (error || !application) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBanner message={error || 'Application not found.'} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BackLink />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                {application.reference ?? 'Application'}
              </h1>
              <StatusBadge status={application.status} />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Submitted {formatDateTime(application.submittedAt)} Â· Created{' '}
              {formatDateTime(application.createdAt)} Â· Updated{' '}
              {formatDateTime(application.updatedAt)}
            </p>
          </div>
          {(actions.length > 0 || application.status === 'APPROVED') && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.status}
                  onClick={() => {
                    setSelectedAction(action);
                    setReason('');
                    setActionError('');
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-extrabold text-white ${
                    action.status === 'REJECTED'
                      ? 'bg-red-600 hover:bg-red-700'
                      : action.status === 'CHANGES_REQUESTED'
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : 'bg-[#4b2c71] hover:bg-[#382055]'
                  }`}
                >
                  {action.label}
                </button>
              ))}
              {application.status === 'APPROVED' && (
                <button
                  type="button"
                  onClick={handleActivateAccount}
                  disabled={activating}
                  className="rounded-xl bg-[#4b2c71] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#382055] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activating ? 'Activating...' : 'Activate Account'}
                </button>
              )}
            </div>
          )}
        </div>
        {application.status === 'ACTIVATED' && application.activatedAt && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Customer account activated on {formatDateTime(application.activatedAt)}.
          </div>
        )}
        {actionError && !selectedAction && (
          <div className="mt-4">
            <ErrorBanner message={actionError} />
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <InfoSection
            title="Company Information"
            icon={<FileText size={18} />}
            data={application.company}
            fields={[
              ['Company Name', 'companyName'],
              ['CR Number', 'crNumber'],
              ['VAT Number', 'vatNumber'],
              ['Street Address', 'streetAddress'],
              ['City', 'city'],
              ['Region', 'region'],
              ['Country', 'country'],
              ['Postal Code', 'postalCode'],
            ]}
          />
          <InfoSection
            title="Contact Information"
            icon={<UserRound size={18} />}
            data={application.contact}
            fields={[
              ['Full Name', 'fullName'],
              ['Job Title', 'jobTitle'],
              ['Email', 'email'],
              ['Phone', 'phone'],
            ]}
          />
          <DocumentsSection applicationId={application.id} documents={application.documents} />
          <DeliveryLocationsSection locations={application.deliveryLocations} />
          <InfoSection
            title="Customer Administrator"
            icon={<UserRound size={18} />}
            data={application.administrator}
            fields={[
              ['Full Name', 'fullName'],
              ['Job Title', 'jobTitle'],
              ['Email', 'email'],
              ['Phone', 'phone'],
            ]}
          />
        </div>
        <StatusHistoryTimeline application={application} />
      </div>

      {selectedAction && (
        <ReviewActionModal
          action={selectedAction}
          actionError={actionError}
          reason={reason}
          submitting={submitting}
          onCancel={() => {
            setSelectedAction(null);
            setReason('');
            setActionError('');
          }}
          onReasonChange={setReason}
          onSubmit={handleAction}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/sales/applications"
      className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#4b2c71]"
    >
      <ArrowLeft size={16} />
      Back to applications
    </Link>
  );
}

function ReviewActionModal({
  action,
  actionError,
  reason,
  submitting,
  onCancel,
  onReasonChange,
  onSubmit,
}: {
  action: ReturnType<typeof getAllowedActions>[number];
  actionError: string;
  reason: string;
  submitting: boolean;
  onCancel: () => void;
  onReasonChange: (reason: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const isReject = action.status === 'REJECTED';
  const isChangesRequested = action.status === 'CHANGES_REQUESTED';
  const title = action.label;
  const helperText = action.requiresReason
    ? `A reason is required before marking this application as ${statusLabels[action.status].toLowerCase()}.`
    : `Reason is optional for ${statusLabels[action.status].toLowerCase()}.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{helperText}</p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close review action"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-5 py-5">
          {actionError && <ErrorBanner message={actionError} />}

          <label className="block">
            <span className="text-sm font-bold text-slate-800">
              Reason / Review Note
              {action.requiresReason && <span className="ml-1 text-red-600">*</span>}
            </span>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={5}
              maxLength={1000}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-[#4b2c71] focus:ring-4 focus:ring-[#4b2c71]/10"
              placeholder={
                isChangesRequested
                  ? 'Describe what the customer needs to change or upload.'
                  : isReject
                    ? 'Explain why this application is being rejected.'
                    : 'Add an optional internal review note.'
              }
            />
            <span className="mt-1 block text-xs text-slate-400">{reason.length}/1000</span>
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              disabled={submitting}
              className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-60 ${
                isReject
                  ? 'bg-red-600 hover:bg-red-700'
                  : isChangesRequested
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-[#4b2c71] hover:bg-[#382055]'
              }`}
            >
              {submitting ? 'Updating...' : `Confirm ${action.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoSection({
  title,
  icon,
  data,
  fields,
}: {
  title: string;
  icon: ReactNode;
  data: Record<string, unknown>;
  fields: Array<[string, string]>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-xl bg-[#f6f2fa] p-2 text-[#4b2c71]">{icon}</span>
        <h2 className="font-extrabold text-slate-950">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([label, key]) => (
          <div key={key}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{displayValue(data[key])}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentsSection({
  applicationId,
  documents,
}: {
  applicationId: string;
  documents: Record<string, unknown>;
}) {
  const documentItems: Array<{
    id: 'cr' | 'vat';
    label: string;
    document: Record<string, unknown> | undefined;
  }> = [
    {
      id: 'cr',
      label: 'Commercial Registration',
      document: documents.cr as Record<string, unknown> | undefined,
    },
    {
      id: 'vat',
      label: 'VAT Certificate',
      document: documents.vat as Record<string, unknown> | undefined,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-xl bg-[#f6f2fa] p-2 text-[#4b2c71]">
          <FileText size={18} />
        </span>
        <h2 className="font-extrabold text-slate-950">Submitted Documents</h2>
      </div>
      <div className="grid gap-3">
        {documentItems.map(({ id: documentId, label, document }) => {
          const fileType = typeof document?.fileType === 'string' ? document.fileType : '';
          const hasStoredFile = document?.hasFile === true;
          const canPreview = hasStoredFile && isPreviewableDocument(fileType);
          const previewUrl = getSalesApplicationDocumentUrl(applicationId, documentId);
          const downloadUrl = getSalesApplicationDocumentUrl(applicationId, documentId, {
            download: true,
          });
          const fileSize =
            typeof document?.fileSize === 'number' ? formatFileSize(document.fileSize) : 'â€”';

          return (
            <div
              key={documentId}
              className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Document Type
                </p>
                <p className="mt-1 font-bold text-slate-900">{label}</p>
                <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-slate-800">File Name:</span>{' '}
                    {displayValue(document?.fileName)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Uploaded Date:</span>{' '}
                    {formatDateTime(stringOrNull(document?.uploadedAt))}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Content Type:</span>{' '}
                    {displayValue(fileType)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">File Size:</span> {fileSize}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {canPreview && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Eye size={16} />
                    Preview
                  </a>
                )}
                {hasStoredFile ? (
                  <a
                    href={downloadUrl}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#4b2c71] px-3 py-2 text-sm font-bold text-white hover:bg-[#382055]"
                  >
                    <Download size={16} />
                    Download
                  </a>
                ) : (
                  <span className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 ring-1 ring-amber-200">
                    File not persisted
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeliveryLocationsSection({ locations }: { locations: Array<Record<string, unknown>> }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-xl bg-[#f6f2fa] p-2 text-[#4b2c71]">
          <MapPin size={18} />
        </span>
        <h2 className="font-extrabold text-slate-950">Delivery Locations</h2>
      </div>
      {locations.length === 0 ? (
        <p className="text-sm text-slate-500">No delivery locations submitted.</p>
      ) : (
        <div className="grid gap-3">
          {locations.map((location, index) => (
            <div
              key={String(location.id ?? index)}
              className="rounded-xl border border-slate-200 p-4"
            >
              <p className="font-bold text-slate-900">{displayValue(location.name)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {[location.streetAddress, location.city, location.region, location.country]
                  .filter(Boolean)
                  .join(', ') || 'â€”'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Contact: {displayValue(location.contactPerson)} Â·{' '}
                {displayValue(location.contactPhone)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusHistoryTimeline({ application }: { application: SalesApplicationDetails }) {
  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-xl bg-[#f6f2fa] p-2 text-[#4b2c71]">
          <Clock size={18} />
        </span>
        <h2 className="font-extrabold text-slate-950">Status History</h2>
      </div>

      {application.statusHistory.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No Sales status changes recorded yet.
        </div>
      ) : (
        <div className="space-y-4">
          {application.statusHistory.map((event) => (
            <div key={event.id} className="relative pl-8">
              <span className="absolute left-0 top-1 rounded-full bg-emerald-50 p-1 text-emerald-700 ring-1 ring-emerald-200">
                {event.newStatus === 'REJECTED' ? (
                  <XCircle size={14} />
                ) : (
                  <CheckCircle2 size={14} />
                )}
              </span>
              <p className="text-sm font-bold text-slate-950">
                {getStatusHistoryActionMessage(event)}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {getStatusHistoryActor(event)} · {formatRelativeTime(event.createdAt)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {event.previousStatus ? statusLabels[event.previousStatus] : 'Created'} →{' '}
                {statusLabels[event.newStatus]}
              </p>
              {event.reason && (
                <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  {event.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function isPreviewableDocument(fileType: string) {
  return ['application/pdf', 'image/jpeg', 'image/png'].includes(fileType);
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusHistoryActionMessage(event: SalesApplicationDetails['statusHistory'][number]) {
  if (event.previousStatus === 'PENDING_SALES_REVIEW' && event.newStatus === 'UNDER_REVIEW') {
    return 'Review started';
  }

  if (event.newStatus === 'APPROVED') return 'Application approved';
  if (event.newStatus === 'ACTIVATED') return 'Customer account activated';
  if (event.newStatus === 'REJECTED') return 'Application rejected';
  if (event.newStatus === 'CHANGES_REQUESTED') return 'Changes requested from customer';

  if (event.previousStatus === 'CHANGES_REQUESTED' && event.newStatus === 'UNDER_REVIEW') {
    return 'Review resumed';
  }

  return `Status changed to ${statusLabels[event.newStatus]}`;
}

function getStatusHistoryActor(event: SalesApplicationDetails['statusHistory'][number]) {
  return event.changedByName || event.changedByEmail || 'Sales team';
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds || 1} second${elapsedSeconds === 1 ? '' : 's'} ago`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) {
    return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
  }

  return formatDateTime(value);
}
