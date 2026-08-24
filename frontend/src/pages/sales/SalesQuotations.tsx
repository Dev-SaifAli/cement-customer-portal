import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listSalesQuotations,
  type SalesApplicationsPagination,
  type SalesQuotationStatus,
  type SalesQuotationSummary,
} from '../../services/salesService';

const emptyPagination: SalesApplicationsPagination = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
};

export function SalesQuotationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<SalesQuotationSummary[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [referenceInput, setReferenceInput] = useState(searchParams.get('reference') ?? '');
  const [customerInput, setCustomerInput] = useState(searchParams.get('customer') ?? '');

  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const reference = searchParams.get('reference') ?? '';
  const customer = searchParams.get('customer') ?? '';
  const submittedDate = searchParams.get('submittedDate') ?? '';
  const fulfilmentType = (searchParams.get('fulfilmentType') ?? '') as '' | 'PICKUP' | 'DELIVERY';
  const status = (searchParams.get('status') ?? '') as '' | SalesQuotationStatus;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (referenceInput.trim() === reference && customerInput.trim() === customer) return;
      updateParams({ reference: referenceInput.trim(), customer: customerInput.trim(), page: 1 });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [customer, customerInput, reference, referenceInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void listSalesQuotations({ page, reference, customer, submittedDate, fulfilmentType, status })
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setPagination(result.pagination);
        setSelected([]);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [customer, fulfilmentType, page, reference, status, submittedDate]);

  const updateParams = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, String(value));
    });
    if (!('page' in next)) params.set('page', '1');
    setSearchParams(params);
  };
  const reset = () => {
    setReferenceInput('');
    setCustomerInput('');
    setSearchParams(new URLSearchParams({ page: '1' }));
  };
  const visibleIds = items.map((item) => item.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const from = pagination.total ? (pagination.page - 1) * 10 + 1 : 0;
  const to = Math.min(pagination.page * 10, pagination.total);
  const pages = useMemo(() => visiblePages(pagination.page, pagination.totalPages), [pagination]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a1b23]">Quotations</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Review customer requirements and prepare commercial quotations.
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-[#e3e1e8] bg-white">
        <div className="flex h-12 items-center justify-between border-b border-[#e3e1e8] px-4">
          <p className="text-sm font-semibold text-[#1a1b23]">{pagination.total} Quotations</p>
          {(reference || customer || submittedDate || fulfilmentType || status) && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#54247a] hover:text-[#472066]"
            >
              <RotateCcw size={13} /> Reset filters
            </button>
          )}
        </div>

        {error ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm font-semibold text-[#b42318]">Unable to load quotations.</p>
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams(searchParams))}
              className="rounded-lg border border-[#e3e1e8] px-4 py-2 text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] table-fixed text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
                  <tr className="border-b border-[#e3e1e8]">
                    <th className="w-11 px-3 py-3 text-center">
                      <CheckBox
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : visibleIds)}
                        label="Select visible quotations"
                      />
                    </th>
                    <th className="w-[19%] px-3 py-3">Quotation Reference</th>
                    <th className="w-[20%] px-3 py-3">Customer</th>
                    <th className="w-[15%] px-3 py-3">Submitted</th>
                    <th className="w-[9%] px-3 py-3">Items</th>
                    <th className="w-[12%] px-3 py-3">Fulfilment</th>
                    <th className="w-[13%] px-3 py-3 text-right">Total</th>
                    <th className="w-[17%] px-3 py-3">Status</th>
                  </tr>
                  <tr className="border-b border-[#e3e1e8] bg-white align-top">
                    <th />
                    <th className="p-2">
                      <FilterInput
                        value={referenceInput}
                        onChange={setReferenceInput}
                        placeholder="Reference"
                      />
                    </th>
                    <th className="p-2">
                      <FilterInput
                        value={customerInput}
                        onChange={setCustomerInput}
                        placeholder="Customer"
                      />
                    </th>
                    <th className="p-2">
                      <input
                        aria-label="Submitted date"
                        type="date"
                        value={submittedDate}
                        onChange={(e) => updateParams({ submittedDate: e.target.value })}
                        className={filterClass}
                      />
                    </th>
                    <th />
                    <th className="p-2">
                      <select
                        aria-label="Fulfilment"
                        value={fulfilmentType}
                        onChange={(e) => updateParams({ fulfilmentType: e.target.value })}
                        className={filterClass}
                      >
                        <option value="">All</option>
                        <option value="DELIVERY">Delivery</option>
                        <option value="PICKUP">Pick-Up</option>
                      </select>
                    </th>
                    <th />
                    <th className="p-2">
                      <select
                        aria-label="Status"
                        value={status}
                        onChange={(e) => updateParams({ status: e.target.value })}
                        className={filterClass}
                      >
                        <option value="">All Statuses</option>
                        {statusOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows />
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#faf8fc]"
                      >
                        <td className="px-3 py-3 text-center">
                          <CheckBox
                            checked={selected.includes(item.id)}
                            onChange={() =>
                              setSelected((current) =>
                                current.includes(item.id)
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id],
                              )
                            }
                            label={`Select ${item.reference ?? 'quotation'}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            to={`/sales/quotations/${item.id}`}
                            className="font-bold text-[#54247a] hover:underline"
                          >
                            {item.reference ?? 'Reference pending'}
                          </Link>
                        </td>
                        <td className="truncate px-3 py-3 font-medium text-[#1a1b23]">
                          {item.customer}
                        </td>
                        <td className="px-3 py-3 text-[#64748b]">
                          {formatDateTime(item.submittedAt)}
                        </td>
                        <td className="px-3 py-3">
                          {item.itemCount} {item.itemCount === 1 ? 'Item' : 'Items'}
                        </td>
                        <td className="px-3 py-3">
                          {item.fulfilmentType === 'PICKUP' ? 'Pick-Up' : 'Delivery'}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">
                          {item.total === null ? '—' : formatMoney(item.total)}
                        </td>
                        <td className="px-3 py-3">
                          <Status status={item.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
              <div className="grid grid-cols-2 gap-2">
                <FilterInput
                  value={referenceInput}
                  onChange={setReferenceInput}
                  placeholder="Reference"
                />
                <FilterInput
                  value={customerInput}
                  onChange={setCustomerInput}
                  placeholder="Customer"
                />
              </div>
              {loading ? (
                <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
              ) : (
                items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/sales/quotations/${item.id}`}
                    className="block rounded-lg border border-[#e3e1e8] p-3 hover:bg-[#faf8fc]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-bold text-[#54247a]">{item.reference}</span>
                      <Status status={item.status} />
                    </div>
                    <p className="mt-2 text-sm font-semibold">{item.customer}</p>
                    <div className="mt-2 flex justify-between text-xs text-[#64748b]">
                      <span>
                        {item.itemCount} {item.itemCount === 1 ? 'Item' : 'Items'} ·{' '}
                        {item.fulfilmentType === 'PICKUP' ? 'Pick-Up' : 'Delivery'}
                      </span>
                      <span>{formatDateTime(item.submittedAt)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {!loading && items.length === 0 && (
              <div className="flex min-h-52 items-center justify-center px-4 text-sm text-[#64748b]">
                No submitted quotations match the current filters.
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-[#e3e1e8] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-[#64748b]">
                {selected.length ? `${selected.length} selected · ` : ''}Showing {from}–{to} of{' '}
                {pagination.total}
              </span>
              <nav className="flex items-center gap-1" aria-label="Quotation pages">
                <PageButton disabled={page <= 1} onClick={() => updateParams({ page: page - 1 })}>
                  <ChevronLeft size={14} /> Previous
                </PageButton>
                {pages.map((value) => (
                  <PageButton
                    key={value}
                    active={value === page}
                    onClick={() => updateParams({ page: value })}
                  >
                    {value}
                  </PageButton>
                ))}
                <PageButton
                  disabled={page >= pagination.totalPages}
                  onClick={() => updateParams({ page: page + 1 })}
                >
                  Next <ChevronRight size={14} />
                </PageButton>
              </nav>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

const filterClass =
  'h-9 w-full rounded-md border border-[#e3e1e8] bg-white px-2.5 text-xs font-medium text-[#1a1b23] outline-none focus:border-[#54247a] focus:ring-1 focus:ring-[#54247a]';
function FilterInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={filterClass}
    />
  );
}
function CheckBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      aria-label={label}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-slate-300 accent-[#54247a]"
    />
  );
}
function PageButton({
  active,
  children,
  disabled,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold disabled:opacity-40 ${active ? 'border-[#54247a] bg-[#f6f2fa] text-[#54247a]' : 'border-[#e3e1e8] text-[#64748b] hover:bg-slate-50'}`}
    >
      {children}
    </button>
  );
}
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <tr key={index} className="border-b border-[#e2e8f0]">
          <td colSpan={8} className="px-3 py-3">
            <div className="h-5 animate-pulse rounded bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  );
}
function Status({ status }: { status: SalesQuotationStatus }) {
  const item = statusMap[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${item.text}`}>
      <span className={`h-2 w-2 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
}
const statusMap: Record<SalesQuotationStatus, { label: string; dot: string; text: string }> = {
  PENDING_SALES_REVIEW: {
    label: 'Pending Sales Review',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
  },
  UNDER_REVIEW: { label: 'Under Review', dot: 'bg-blue-600', text: 'text-blue-700' },
  PENDING_HADER_APPROVAL: {
    label: 'Pending Hader Approval',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
  },
  PENDING_PRICE_APPROVAL: {
    label: 'Pending Price Approval',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
  },
  READY_FOR_CUSTOMER: { label: 'Ready for Customer', dot: 'bg-[#54247a]', text: 'text-[#54247a]' },
  ACCEPTED: { label: 'Accepted', dot: 'bg-emerald-600', text: 'text-emerald-700' },
  REJECTED: { label: 'Rejected', dot: 'bg-red-600', text: 'text-red-700' },
  CLARIFICATION_REQUESTED: {
    label: 'Clarification Requested',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
  },
};
const statusOptions = Object.entries(statusMap).map(
  ([value, item]) => [value, item.label] as const,
);
function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : '—';
}
function formatMoney(value: number) {
  return `${new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} SAR`;
}
function visiblePages(page: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.min(Math.max(1, page - 2), total - 4);
  return Array.from({ length: 5 }, (_, i) => start + i);
}
