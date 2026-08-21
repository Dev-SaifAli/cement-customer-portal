import { ArrowRight, ClipboardCheck, Clock, FileWarning, SearchCheck, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  listSalesApplications,
  SalesApiError,
  type SalesApplicationStatus,
  type SalesApplicationSummary,
} from '../../services/salesService';
import { formatDateTime, salesStatuses, statusBadgeClasses, statusLabels } from './salesUtils';

const cardIconMap: Record<SalesApplicationStatus, ReactNode> = {
  DRAFT: <ClipboardCheck size={20} />,
  PENDING_SALES_REVIEW: <Clock size={20} />,
  UNDER_REVIEW: <SearchCheck size={20} />,
  APPROVED: <ClipboardCheck size={20} />,
  CHANGES_REQUESTED: <FileWarning size={20} />,
  REJECTED: <XCircle size={20} />,
  ACTIVATED: <ClipboardCheck size={20} />,
};

export function SalesDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<SalesApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const visibleStatuses = useMemo(() => salesStatuses, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [recentResponse, ...countResponses] = await Promise.all([
          listSalesApplications({ page: 1, pageSize: 5 }),
          ...visibleStatuses.map((status) =>
            listSalesApplications({ status, page: 1, pageSize: 1 }),
          ),
        ]);
        if (!mounted) return;
        setRecent(recentResponse.items);
        setCounts(
          visibleStatuses.reduce<Record<string, number>>((nextCounts, status, index) => {
            nextCounts[status] = countResponses[index]?.pagination.total ?? 0;
            return nextCounts;
          }, {}),
        );
      } catch (loadError) {
        if (!mounted) return;
        setError(
          loadError instanceof SalesApiError
            ? loadError.message
            : 'Unable to load Sales dashboard.',
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [visibleStatuses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Sales Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live customer onboarding review metrics from submitted applications.
          </p>
        </div>
        <Link
          to="/sales/applications"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4b2c71] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#382055]"
        >
          View applications
          <ArrowRight size={16} />
        </Link>
      </div>

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {visibleStatuses.map((status) => (
          <div key={status} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`rounded-xl p-2 ring-1 ${statusBadgeClasses[status]}`}>
                {cardIconMap[status]}
              </div>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Live</span>
            </div>
            <p className="mt-5 text-3xl font-black text-slate-950">
              {loading ? '—' : (counts[status] ?? 0)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{statusLabels[status]}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-extrabold text-slate-950">Recent submitted applications</h2>
            <p className="text-sm text-slate-500">Latest Sales-relevant registrations</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading recent applications...</p>
          ) : recent.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No submitted applications found.</p>
          ) : (
            recent.map((application) => (
              <Link
                key={application.id}
                to={`/sales/applications/${application.id}`}
                className="flex flex-col gap-3 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold text-slate-950">
                    {application.companyName ?? 'Unnamed company'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {application.reference ?? 'No reference'} ·{' '}
                    {formatDateTime(application.submittedAt)}
                  </p>
                </div>
                <StatusBadge status={application.status} />
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function StatusBadge({ status }: { status: SalesApplicationStatus }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusBadgeClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
      {message}
    </div>
  );
}
