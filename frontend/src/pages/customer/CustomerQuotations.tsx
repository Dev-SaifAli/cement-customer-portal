import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  listCustomerQuotations,
  type CustomerQuotationListFilters,
  type CustomerQuotationListResult,
  type CustomerQuotationSummary,
  type QuotationStatus,
} from '../../services/customerQuotationsService';

const emptyResult: CustomerQuotationListResult = {
  items: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
};

const initialFilters: Required<
  Pick<
    CustomerQuotationListFilters,
    'reference' | 'createdDate' | 'requestedDate' | 'fulfilmentType' | 'deliveryLocation' | 'status'
  >
> = {
  reference: '',
  createdDate: '',
  requestedDate: '',
  fulfilmentType: '',
  deliveryLocation: '',
  status: '',
};

export function CustomerQuotations() {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CustomerQuotationListResult>(emptyResult);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const debouncedReference = useDebouncedValue(filters.reference, 300);
  const debouncedLocation = useDebouncedValue(filters.deliveryLocation, 300);

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    setError(false);
    setSelected(new Set());
    try {
      const data = await listCustomerQuotations({
        page,
        reference: debouncedReference,
        createdDate: filters.createdDate,
        requestedDate: filters.requestedDate,
        fulfilmentType: filters.fulfilmentType,
        deliveryLocation: debouncedLocation,
        status: filters.status,
      });
      setResult(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedLocation,
    debouncedReference,
    filters.createdDate,
    filters.fulfilmentType,
    filters.requestedDate,
    filters.status,
    page,
  ]);

  useEffect(() => {
    void loadQuotations();
  }, [loadQuotations]);

  const allVisibleSelected =
    result.items.length > 0 && result.items.every((quotation) => selected.has(quotation.id));
  const hasFilters = Object.values(filters).some(Boolean);
  const showingFrom = result.pagination.total === 0 ? 0 : (page - 1) * 10 + 1;
  const showingTo = Math.min(page * 10, result.pagination.total);
  const pageNumbers = useMemo(
    () => getVisiblePages(page, result.pagination.totalPages),
    [page, result.pagination.totalPages],
  );

  const updateFilter = <Key extends keyof typeof filters>(
    key: Key,
    value: (typeof filters)[Key],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        result.items.forEach((quotation) => next.delete(quotation.id));
      } else {
        result.items.forEach((quotation) => next.add(quotation.id));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1a1b23]">Quotations</h1>
          <p className="mt-1 text-sm text-[#64748b]">Manage and track your quotation requests.</p>
        </div>
        <Link
          to="/customer/quotations/new"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-[#54247a] px-4 text-sm font-semibold text-white transition hover:bg-[#472066]"
        >
          <Plus size={16} /> New Quotation
        </Link>
      </header>

      <section className="overflow-hidden rounded-xl border border-[#e3e1e8] bg-white">
        <div className="flex min-h-14 items-center justify-between border-b border-[#e3e1e8] px-4 sm:px-5">
          <p className="text-sm font-semibold text-[#1a1b23]">
            {result.pagination.total} {result.pagination.total === 1 ? 'Quotation' : 'Quotations'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-[#64748b] transition hover:bg-[#f6f2fa] hover:text-[#54247a]"
            >
              <RotateCcw size={13} /> Reset filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-[#e3e1e8] p-3 md:hidden">
          <FilterTextInput
            icon={<Search size={14} />}
            value={filters.reference}
            placeholder="Reference"
            onChange={(value) => updateFilter('reference', value)}
          />
          <select
            value={filters.status}
            onChange={(event) =>
              updateFilter('status', event.target.value as typeof filters.status)
            }
            className={filterControlClass}
            aria-label="Filter by quotation status"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusPresentation[status].label}
              </option>
            ))}
          </select>
          <FilterDateInput
            label="Requested date"
            value={filters.requestedDate}
            onChange={(value) => updateFilter('requestedDate', value)}
          />
          <select
            value={filters.fulfilmentType}
            onChange={(event) =>
              updateFilter('fulfilmentType', event.target.value as typeof filters.fulfilmentType)
            }
            className={filterControlClass}
            aria-label="Filter by fulfilment"
          >
            <option value="">All Fulfilment</option>
            <option value="DELIVERY">Delivery</option>
            <option value="PICKUP">Pick-Up</option>
          </select>
        </div>

        {error ? (
          <ErrorState onRetry={() => void loadQuotations()} />
        ) : loading ? (
          <QuotationSkeleton />
        ) : result.items.length === 0 ? (
          <EmptyState filtered={hasFilters} onReset={resetFilters} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                <thead className="bg-[#f8fafc] text-[#64748b]">
                  <tr className="border-b border-[#e3e1e8] font-semibold">
                    <th className="w-12 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible quotations"
                        className={checkboxClass}
                      />
                    </th>
                    <th className="min-w-48 px-3 py-3">Quotation Reference</th>
                    <th className="hidden min-w-36 px-3 py-3 xl:table-cell">Created Date</th>
                    <th className="min-w-36 px-3 py-3">Requested Date</th>
                    <th className="w-24 px-3 py-3">Items</th>
                    <th className="hidden min-w-32 px-3 py-3 lg:table-cell">Fulfilment</th>
                    <th className="hidden min-w-48 px-3 py-3 2xl:table-cell">Delivery Location</th>
                    <th className="min-w-48 px-3 py-3">Status</th>
                  </tr>
                  <tr className="border-b border-[#e3e1e8] bg-white">
                    <th />
                    <th className="px-3 py-2">
                      <FilterTextInput
                        icon={<Search size={14} />}
                        value={filters.reference}
                        placeholder="Search reference"
                        onChange={(value) => updateFilter('reference', value)}
                      />
                    </th>
                    <th className="hidden px-3 py-2 xl:table-cell">
                      <FilterDateInput
                        label="Created date"
                        value={filters.createdDate}
                        onChange={(value) => updateFilter('createdDate', value)}
                      />
                    </th>
                    <th className="px-3 py-2">
                      <FilterDateInput
                        label="Requested date"
                        value={filters.requestedDate}
                        onChange={(value) => updateFilter('requestedDate', value)}
                      />
                    </th>
                    <th className="px-3 py-2 text-center text-slate-300">—</th>
                    <th className="hidden px-3 py-2 lg:table-cell">
                      <select
                        value={filters.fulfilmentType}
                        onChange={(event) =>
                          updateFilter(
                            'fulfilmentType',
                            event.target.value as typeof filters.fulfilmentType,
                          )
                        }
                        className={filterControlClass}
                        aria-label="Filter by fulfilment"
                      >
                        <option value="">All</option>
                        <option value="DELIVERY">Delivery</option>
                        <option value="PICKUP">Pick-Up</option>
                      </select>
                    </th>
                    <th className="hidden px-3 py-2 2xl:table-cell">
                      <FilterTextInput
                        value={filters.deliveryLocation}
                        placeholder="Search location"
                        onChange={(value) => updateFilter('deliveryLocation', value)}
                      />
                    </th>
                    <th className="px-3 py-2">
                      <select
                        value={filters.status}
                        onChange={(event) =>
                          updateFilter('status', event.target.value as typeof filters.status)
                        }
                        className={filterControlClass}
                        aria-label="Filter by quotation status"
                      >
                        <option value="">All Statuses</option>
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {statusPresentation[status].label}
                          </option>
                        ))}
                      </select>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((quotation) => (
                    <QuotationRow
                      key={quotation.id}
                      quotation={quotation}
                      selected={selected.has(quotation.id)}
                      onToggle={() => toggleRow(quotation.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#e3e1e8] md:hidden">
              {result.items.map((quotation) => (
                <QuotationCard
                  key={quotation.id}
                  quotation={quotation}
                  selected={selected.has(quotation.id)}
                  onToggle={() => toggleRow(quotation.id)}
                />
              ))}
            </div>

            <div className="flex h-10 items-center border-t border-[#e3e1e8] bg-[#f6f2fa] px-4 text-xs font-semibold text-[#54247a]">
              {selected.size} selected
            </div>
          </>
        )}

        {!error && !loading && result.pagination.total > 0 && (
          <footer className="flex flex-col gap-3 border-t border-[#e3e1e8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-[#64748b]">
              Showing {showingFrom}–{showingTo} of {result.pagination.total}
            </p>
            <nav className="flex items-center gap-1" aria-label="Quotation pagination">
              <PaginationButton
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </PaginationButton>
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === page ? 'page' : undefined}
                  className={`h-9 min-w-9 rounded-md border px-2 text-xs font-semibold transition ${
                    pageNumber === page
                      ? 'border-[#54247a] bg-[#f6f2fa] text-[#54247a]'
                      : 'border-[#e3e1e8] bg-white text-[#64748b] hover:border-[#54247a] hover:text-[#54247a]'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
              <PaginationButton
                disabled={page >= result.pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next <ChevronRight size={14} />
              </PaginationButton>
            </nav>
          </footer>
        )}
      </section>
    </div>
  );
}

function QuotationRow({
  onToggle,
  quotation,
  selected,
}: {
  onToggle: () => void;
  quotation: CustomerQuotationSummary;
  selected: boolean;
}) {
  return (
    <tr className="border-b border-[#e3e1e8] text-[#1a1b23] transition last:border-b-0 hover:bg-[#faf9fb]">
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${quotation.reference ?? 'quotation'}`}
          className={checkboxClass}
        />
      </td>
      <td className="px-3 py-3">
        <Link
          to={`/customer/quotations/${quotation.id}`}
          className="font-semibold text-[#54247a] hover:text-[#472066] hover:underline"
        >
          {quotation.reference ?? 'Reference pending'}
        </Link>
      </td>
      <td className="hidden px-3 py-3 xl:table-cell">{formatDate(quotation.createdAt)}</td>
      <td className="px-3 py-3">{formatDate(quotation.requestedDate)}</td>
      <td className="px-3 py-3">{formatItems(quotation.itemCount)}</td>
      <td className="hidden px-3 py-3 lg:table-cell">
        {formatFulfilment(quotation.fulfilmentType)}
      </td>
      <td className="hidden max-w-56 truncate px-3 py-3 2xl:table-cell">
        {quotation.deliveryLocation ?? 'Not provided'}
      </td>
      <td className="px-3 py-3">
        <QuotationStatus status={quotation.status} />
      </td>
    </tr>
  );
}

function QuotationCard({
  onToggle,
  quotation,
  selected,
}: {
  onToggle: () => void;
  quotation: CustomerQuotationSummary;
  selected: boolean;
}) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${quotation.reference ?? 'quotation'}`}
          className={`${checkboxClass} mt-0.5`}
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/customer/quotations/${quotation.id}`}
            className="font-semibold text-[#54247a] hover:underline"
          >
            {quotation.reference ?? 'Reference pending'}
          </Link>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <MobileField label="Requested Date" value={formatDate(quotation.requestedDate)} />
            <MobileField label="Items" value={formatItems(quotation.itemCount)} />
            <MobileField label="Fulfilment" value={formatFulfilment(quotation.fulfilmentType)} />
            <div>
              <p className="text-[11px] text-[#64748b]">Status</p>
              <div className="mt-1">
                <QuotationStatus status={quotation.status} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuotationStatus({ status }: { status: QuotationStatus }) {
  const presentation = statusPresentation[status];
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium ${presentation.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${presentation.dot}`} />
      {presentation.label}
    </span>
  );
}

function FilterTextInput({
  icon,
  onChange,
  placeholder,
  value,
}: {
  icon?: ReactNode;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
      )}
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${filterControlClass} ${icon ? 'pl-8' : ''}`}
      />
    </div>
  );
}

function FilterDateInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${filterControlClass} pl-8`}
        aria-label={label}
      />
    </div>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[#64748b]">{label}</p>
      <p className="mt-1 font-medium text-[#1a1b23]">{value}</p>
    </div>
  );
}

function PaginationButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1 rounded-md border border-[#e3e1e8] bg-white px-3 text-xs font-semibold text-[#64748b] transition hover:border-[#54247a] hover:text-[#54247a] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function QuotationSkeleton() {
  return (
    <div className="divide-y divide-[#e3e1e8] px-4" aria-label="Loading quotations">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="grid grid-cols-[24px_1.5fr_1fr_1fr_1fr] gap-4 py-4">
          {Array.from({ length: 5 }, (__, cell) => (
            <div key={cell} className="h-4 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-[#1a1b23]">Unable to load quotations.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 h-9 rounded-lg border border-[#e3e1e8] px-4 text-xs font-semibold text-[#54247a] hover:bg-[#f6f2fa]"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f6f2fa] text-[#54247a]">
        <FileText size={22} />
      </span>
      <h2 className="mt-4 text-base font-semibold text-[#1a1b23]">
        {filtered ? 'No quotations match these filters' : 'No quotations yet'}
      </h2>
      <p className="mt-1 max-w-md text-sm text-[#64748b]">
        {filtered
          ? 'Reset the filters to view all quotation requests.'
          : 'Create your first quotation request for bulk cement requirements.'}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 text-sm font-semibold text-[#54247a] hover:underline"
        >
          Reset filters
        </button>
      ) : (
        <Link
          to="/customer/quotations/new"
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-semibold text-white hover:bg-[#472066]"
        >
          <Plus size={15} /> New Quotation
        </Link>
      )}
    </div>
  );
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debouncedValue;
}

function getVisiblePages(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function formatDate(value: string | null) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatItems(count: number) {
  return `${count} ${count === 1 ? 'Item' : 'Items'}`;
}

function formatFulfilment(value: CustomerQuotationSummary['fulfilmentType']) {
  return value === 'PICKUP' ? 'Pick-Up' : 'Delivery';
}

const filterControlClass =
  'h-9 w-full rounded-md border border-[#e3e1e8] bg-white px-2.5 text-xs font-medium text-[#1a1b23] outline-none transition placeholder:text-slate-400 focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10';
const checkboxClass =
  'h-4 w-4 rounded border-slate-300 text-[#54247a] accent-[#54247a] focus:ring-[#54247a]';

const statusOptions: QuotationStatus[] = [
  'DRAFT',
  'PENDING_SALES_REVIEW',
  'UNDER_REVIEW',
  'READY_FOR_CUSTOMER',
  'ACCEPTED',
  'REJECTED',
  'CLARIFICATION_REQUESTED',
];

const statusPresentation: Record<QuotationStatus, { label: string; dot: string; text: string }> = {
  DRAFT: { label: 'Draft', dot: 'bg-slate-400', text: 'text-slate-600' },
  PENDING_SALES_REVIEW: {
    label: 'Pending Sales Review',
    dot: 'bg-amber-500',
    text: 'text-[#b45309]',
  },
  UNDER_REVIEW: { label: 'Under Review', dot: 'bg-blue-600', text: 'text-blue-700' },
  READY_FOR_CUSTOMER: { label: 'Ready for Customer', dot: 'bg-[#54247a]', text: 'text-[#54247a]' },
  ACCEPTED: { label: 'Accepted', dot: 'bg-[#0f8b5f]', text: 'text-[#0f8b5f]' },
  REJECTED: { label: 'Rejected', dot: 'bg-[#b42318]', text: 'text-[#b42318]' },
  CLARIFICATION_REQUESTED: {
    label: 'Clarification Requested',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
  },
};
