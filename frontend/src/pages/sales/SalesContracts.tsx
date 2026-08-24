import { BriefcaseBusiness, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listSalesContracts,
  type SalesContractDetails,
  type SalesContractsList,
} from '../../services/salesService';

const statusOptions = ['', 'DRAFT', 'ACTIVE', 'PENDING_SALES_REVIEW'] as const;

export function SalesContractsPage() {
  const [contracts, setContracts] = useState<SalesContractsList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof statusOptions)[number]>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listSalesContracts({ page, search, status })
      .then((data) => {
        if (!cancelled) setContracts(data);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load contracts.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, status]);

  const items = contracts?.items ?? [];
  const pagination = contracts?.pagination;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">My Contracts</h1>
          <p className="text-sm text-slate-500">View contracts created from accepted quotations.</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm font-bold text-slate-900">
            {pagination?.total ?? 0} Contracts
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search contract, customer, product"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#54247a] sm:w-72"
              />
            </label>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#54247a]"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_SALES_REVIEW">Pending Review</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-sm font-semibold text-red-700">{error}</div>
        ) : loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <BriefcaseBusiness className="mx-auto text-slate-300" size={32} />
            <p className="mt-3 text-sm font-bold text-slate-900">No contracts yet</p>
            <p className="mt-1 text-sm text-slate-500">Accepted quotations converted to contracts will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Contract</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Product / Type</th>
                  <th className="px-4 py-3">Remaining / Total TON</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Customer Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((contract) => (
                  <ContractRow key={contract.id} contract={contract} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ContractRow({ contract }: { contract: SalesContractDetails }) {
  return (
    <tr className="hover:bg-[#f8fafc]">
      <td className="px-4 py-3">
        <Link to={`/sales/contracts/${contract.id}`} className="font-bold text-[#54247a] hover:underline">
          {contract.reference ?? 'Draft contract'}
        </Link>
      </td>
      <td className="px-4 py-3 text-slate-700">{contract.customerCompanyName ?? 'Not provided'}</td>
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-900">{contract.productName ?? 'Not provided'}</p>
        <p className="text-xs text-slate-500">{contract.productCode ?? ''}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">
        {formatNumber(contract.remainingQuantityTons)} / {formatNumber(contract.totalQuantityTons)} TON
      </td>
      <td className="px-4 py-3 text-slate-700">{formatDate(contract.startDate)}</td>
      <td className="px-4 py-3 text-slate-700">{formatDate(contract.endDate)}</td>
      <td className="px-4 py-3">
        <StatusDot status={contract.status} />
      </td>
      <td className="px-4 py-3 font-semibold text-slate-900">
        {formatMoney(contract.customerRate)} / TON
      </td>
    </tr>
  );
}

function StatusDot({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
      <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {status.replaceAll('_', ' ')}
    </span>
  );
}

function formatMoney(value?: number | null) {
  return value == null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} SAR`;
}

function formatNumber(value?: number | null) {
  return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}
