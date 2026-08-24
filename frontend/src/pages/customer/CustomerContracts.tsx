import { BriefcaseBusiness, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listCustomerContracts,
  type CustomerContractSummary,
  type CustomerContractsList,
} from '../../services/customerContractsService';

export function CustomerContracts() {
  const [contracts, setContracts] = useState<CustomerContractsList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listCustomerContracts({ page, search })
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
  }, [page, search]);

  const items = contracts?.items ?? [];
  const pagination = contracts?.pagination;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1b23]">Active Contracts</h1>
        <p className="text-sm text-[#64748b]">View approved active contracts for your account.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e3e1e8] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#eceaf0] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-[#1a1b23]">{pagination?.total ?? 0} Contracts</p>
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search contract or product"
              className="h-10 w-full rounded-lg border border-[#e3e1e8] pl-9 pr-3 text-sm outline-none focus:border-[#54247a] sm:w-72"
            />
          </label>
        </div>

        {error ? (
          <div className="p-8 text-sm font-semibold text-[#b42318]">{error}</div>
        ) : loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <BriefcaseBusiness className="mx-auto text-slate-300" size={34} />
            <p className="mt-3 text-sm font-bold text-[#1a1b23]">No active contracts yet</p>
            <p className="mt-1 text-sm text-[#64748b]">Accepted and activated contracts will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-[#64748b]">
                <tr>
                  <th className="px-4 py-3">Contract Number</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Packaging</th>
                  <th className="px-4 py-3">Fulfilment</th>
                  <th className="px-4 py-3">Remaining / Total TON</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Customer Rate / TON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceaf0]">
                {items.map((contract) => (
                  <CustomerContractRow key={contract.id} contract={contract} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#eceaf0] px-4 py-3 text-sm text-[#64748b]">
            <span>
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total}
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#e3e1e8] px-3 py-2 disabled:opacity-50">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#e3e1e8] px-3 py-2 disabled:opacity-50">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function CustomerContractRow({ contract }: { contract: CustomerContractSummary }) {
  return (
    <tr className="hover:bg-[#f8fafc]">
      <td className="px-4 py-3">
        <Link to={`/customer/contracts/${contract.id}`} className="font-bold text-[#54247a] hover:underline">
          {contract.reference}
        </Link>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-[#1a1b23]">{contract.productName}</p>
        <p className="text-xs text-[#64748b]">{contract.productCode}</p>
      </td>
      <td className="px-4 py-3">{contract.packaging}</td>
      <td className="px-4 py-3">{contract.fulfilment}</td>
      <td className="px-4 py-3">{formatNumber(contract.remainingQuantityTons)} / {formatNumber(contract.totalQuantityTons)}</td>
      <td className="px-4 py-3">{formatDate(contract.startDate)}</td>
      <td className="px-4 py-3">{formatDate(contract.endDate)}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active
        </span>
      </td>
      <td className="px-4 py-3 font-semibold">{formatMoney(contract.customerRate)}</td>
    </tr>
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
