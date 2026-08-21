import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  MapPin,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
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
              Submitted {formatDateTime(application.submittedAt)} · Created{' '}
              {formatDateTime(application.createdAt)} · Updated{' '}
              {formatDateTime(application.updatedAt)}
            </p>
          </div>
          {actions.length > 0 && (
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
            </div>
          )}
        </div>
      </section>

      {selectedAction && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <form onSubmit={handleAction} className="space-y-4">
            <div>
              <h2 className="font-extrabold text-slate-950">{selectedAction.label}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Update status to {statusLabels[selectedAction.status]}.
                {selectedAction.requiresReason ? ' A reason is required.' : ' Reason is optional.'}
              </p>
            </div>
            {actionError && <ErrorBanner message={actionError} />}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-[#4b2c71] focus:ring-4 focus:ring-[#4b2c71]/10"
              placeholder="Add reason or review note"
            />
            <div className="flex flex-wrap gap-2">
              <button
                disabled={submitting}
                className="rounded-xl bg-[#4b2c71] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#382055] disabled:opacity-60"
              >
                {submitting ? 'Updating...' : 'Confirm action'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedAction(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

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
            typeof document?.fileSize === 'number' ? formatFileSize(document.fileSize) : '—';

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
                  .join(', ') || '—'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Contact: {displayValue(location.contactPerson)} ·{' '}
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
                {event.previousStatus ? statusLabels[event.previousStatus] : 'Created'} →{' '}
                {statusLabels[event.newStatus]}
              </p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
              <p className="mt-1 text-xs text-slate-500">Changed by: {event.changedBy}</p>
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
