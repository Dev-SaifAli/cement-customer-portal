import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Eye, Filter, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listSalesContracts,
  type SalesContractDetails,
  type SalesContractsList,
} from '../../services/salesService';

const pageSize = 10;
const statusOptions = ['', 'DRAFT', 'ACTIVE'] as const;

type ContractFilters = {
  status: (typeof statusOptions)[number];
  customer: string;
  product: string;
  dateFrom: string;
  dateTo: string;
};

const initialFilters: ContractFilters = {
  status: '',
  customer: '',
  product: '',
  dateFrom: '',
  dateTo: '',
};

export function SalesContractsPage() {
  const [contracts, setContracts] = useState<SalesContractsList | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ContractFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listSalesContracts({ page, pageSize, ...filters })
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
  }, [page, filters]);

  const items = contracts?.items ?? [];
  const pagination = contracts?.pagination;
  const hasFilters = Object.values(filters).some(Boolean);

  const updateFilter = <Key extends keyof ContractFilters>(key: Key, value: ContractFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1a1b23]">My Contracts</h1>
          <p className="text-sm text-[#64748b]">
            View draft and active contracts created from accepted quotations.
          </p>
        </div>
        <div className="text-sm font-bold text-[#1a1b23]">{pagination?.total ?? 0} Contracts</div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-[#54247a]">
            <Filter size={16} />
            Filters
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-[#e3e1e8] px-3 py-1.5 text-xs font-bold text-[#64748b] hover:bg-[#f8fafc]"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}
        </div>

        {error ? (
          <div className="p-8 text-sm font-semibold text-red-700">
            {error}
            <button onClick={() => setPage((current) => current)} className="ml-3 font-bold underline">
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-xs font-bold uppercase tracking-wide text-[#64748b]">
                  <th className="px-4 py-3">Contract No.</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Product / Type</th>
                  <th className="px-4 py-3">Total TON</th>
                  <th className="px-4 py-3">Remaining TON</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Customer Rate / TON</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
                <tr className="border-b border-[#e2e8f0] bg-white">
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2">
                    <FilterInput
                      value={filters.customer}
                      placeholder="Customer"
                      onChange={(value) => updateFilter('customer', value)}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <FilterInput
                      value={filters.product}
                      placeholder="Product"
                      onChange={(value) => updateFilter('product', value)}
                    />
                  </th>
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2">
                    <DateInput
                      value={filters.dateFrom}
                      onChange={(value) => updateFilter('dateFrom', value)}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <DateInput
                      value={filters.dateTo}
                      onChange={(value) => updateFilter('dateTo', value)}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <NativeTomSelect
                      value={filters.status}
                      onChange={(event) =>
                        updateFilter('status', event.target.value as ContractFilters['status'])
                      }
                      className="h-9 w-full rounded-lg border border-[#d8d4df] bg-white px-2 text-sm font-medium text-[#1a1b23] outline-none focus:border-[#54247a]"
                    >
                      <option value="">All</option>
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                    </NativeTomSelect>
                  </th>
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={10} className="px-4 py-3">
                        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <BriefcaseBusiness className="mx-auto text-slate-300" size={34} />
                      <p className="mt-3 text-sm font-bold text-[#1a1b23]">No contracts found</p>
                      <p className="mt-1 text-sm text-[#64748b]">
                        Accepted quotations converted to contracts will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((contract) => <ContractRow key={contract.id} contract={contract} />)
                )}
              </tbody>
            </table>
          </div>
        )}

        {pagination && (
          <div className="flex flex-col gap-3 border-t border-[#e2e8f0] px-4 py-3 text-sm text-[#64748b] sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}-
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#e3e1e8] px-3 py-2 font-semibold text-[#1a1b23] disabled:opacity-50"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="rounded-lg border border-[#54247a] px-3 py-2 font-bold text-[#54247a]">
                {pagination.page}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#e3e1e8] px-3 py-2 font-semibold text-[#1a1b23] disabled:opacity-50"
              >
                Next <ChevronRight size={16} />
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
      <td className="px-4 py-3 font-semibold text-[#1a1b23]">
        {contract.customerCompanyName ?? 'Not provided'}
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-[#1a1b23]">{contract.productName ?? 'Not provided'}</p>
        <p className="text-xs text-[#64748b]">
          {[contract.productCode, contract.packaging].filter(Boolean).join(' · ') || 'Not provided'}
        </p>
      </td>
      <td className="px-4 py-3 text-[#1a1b23]">{formatNumber(contract.totalQuantityTons)}</td>
      <td className="px-4 py-3 text-[#1a1b23]">{formatNumber(contract.remainingQuantityTons)}</td>
      <td className="px-4 py-3 text-[#1a1b23]">{formatDate(contract.startDate)}</td>
      <td className="px-4 py-3 text-[#1a1b23]">{formatDate(contract.endDate)}</td>
      <td className="px-4 py-3">
        <StatusDot status={contract.status} />
      </td>
      <td className="px-4 py-3 font-semibold text-[#1a1b23]">
        {formatMoney(contract.customerRate)}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          to={`/sales/contracts/${contract.id}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3e1e8] text-[#54247a] hover:bg-[#f6f2fa]"
          aria-label={`Open contract ${contract.reference ?? contract.id}`}
        >
          <Eye size={16} />
        </Link>
      </td>
    </tr>
  );
}

function FilterInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-[#d8d4df] bg-white px-2 text-sm font-medium text-[#1a1b23] outline-none placeholder:text-[#94a3b8] focus:border-[#54247a]"
    />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-lg border border-[#d8d4df] bg-white px-2 text-sm font-medium text-[#1a1b23] outline-none focus:border-[#54247a]"
    />
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'ACTIVE'
      ? 'bg-[#0f8b5f]'
      : status === 'DRAFT'
        ? 'bg-slate-400'
        : 'bg-[#b45309]';

  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a1b23]">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {formatStatus(status)}
    </span>
  );
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatMoney(value?: number | null) {
  return value == null
    ? 'Not provided'
    : `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function formatNumber(value?: number | null) {
  return value == null ? 'Not provided' : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not provided';
}
