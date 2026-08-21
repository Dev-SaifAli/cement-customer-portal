import { Eye, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listSalesApplications,
  SalesApiError,
  type SalesApplicationStatus,
  type SalesApplicationSummary,
  type SalesApplicationsPagination,
} from '../../services/salesService';
import { ErrorBanner, StatusBadge } from './SalesDashboard';
import { formatDateTime, salesStatuses, statusLabels } from './salesUtils';

export function SalesApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<SalesApplicationSummary[]>([]);
  const [pagination, setPagination] = useState<SalesApplicationsPagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const page = Number(searchParams.get('page') ?? '1');
  const status = (searchParams.get('status') ?? '') as SalesApplicationStatus | '';
  const activeSearch = searchParams.get('search') ?? '';

  useEffect(() => {
    setSearch(activeSearch);
  }, [activeSearch]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await listSalesApplications({
          search: activeSearch,
          status,
          page: Number.isFinite(page) && page > 0 ? page : 1,
          pageSize: 20,
        });
        if (!mounted) return;
        setItems(response.items);
        setPagination(response.pagination);
      } catch (loadError) {
        if (!mounted) return;
        setError(
          loadError instanceof SalesApiError ? loadError.message : 'Unable to load applications.',
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [activeSearch, page, status]);

  const updateParams = (next: { search?: string; status?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams);
    if ('search' in next) {
      if (next.search) params.set('search', next.search);
      else params.delete('search');
    }
    if ('status' in next) {
      if (next.status) params.set('status', next.status);
      else params.delete('status');
    }
    params.set('page', String(next.page ?? 1));
    setSearchParams(params);
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    updateParams({ search: search.trim(), page: 1 });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">Applications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search, filter, and review submitted customer organization applications.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-[#4b2c71] focus:ring-4 focus:ring-[#4b2c71]/10"
              placeholder="Search reference, company, email, or phone"
            />
          </form>
          <select
            value={status}
            onChange={(event) => updateParams({ status: event.target.value, page: 1 })}
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-[#4b2c71] focus:ring-4 focus:ring-[#4b2c71]/10"
          >
            <option value="">All submitted statuses</option>
            {salesStatuses.map((option) => (
              <option key={option} value={option}>
                {statusLabels[option]}
              </option>
            ))}
          </select>
          <button
            onClick={() => updateParams({ search: '', status: '', page: 1 })}
            className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Application Reference</th>
                <th className="px-4 py-3">Company Name</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Submitted Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Loading applications...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No applications found.
                  </td>
                </tr>
              ) : (
                items.map((application) => (
                  <tr key={application.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">
                      {application.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3">{application.companyName ?? '—'}</td>
                    <td className="px-4 py-3">{application.contactName ?? '—'}</td>
                    <td className="px-4 py-3">{application.contactEmail ?? '—'}</td>
                    <td className="px-4 py-3">{application.contactPhone ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateTime(application.submittedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={application.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/sales/applications/${application.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Eye size={14} />
                        View Application
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-slate-500">
          Showing page {pagination.page} of {Math.max(pagination.totalPages, 1)} ·{' '}
          {pagination.total} total
        </p>
        <div className="flex gap-2">
          <button
            disabled={pagination.page <= 1 || loading}
            onClick={() => updateParams({ page: pagination.page - 1 })}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => updateParams({ page: pagination.page + 1 })}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
