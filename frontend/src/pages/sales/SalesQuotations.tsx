import { ChevronLeft, ChevronRight, Filter, Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AsyncSearchableTomSelect } from '../../components/ui/AsyncSearchableTomSelect';
import { useSalesAuth } from '../../context/SalesAuthContext';
import {
  getSalesQuotationFilterOptions,
  listSalesQuotations,
  type SalesApplicationsPagination,
  type SalesFilterOption,
  type SalesQuotationStatus,
  type SalesQuotationSummary,
} from '../../services/salesService';

const emptyPagination: SalesApplicationsPagination = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
};
type FilterField = 'status' | 'fulfilment' | 'itemCount' | 'total' | 'submitted';
type FilterOperator =
  'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'on' | 'before' | 'after' | 'between';
type DraftFilter = {
  id: number;
  field: FilterField | '';
  operator: FilterOperator | '';
  value: string;
  secondValue: string;
};

const advancedParamKeys = [
  'status',
  'statusOperator',
  'fulfilmentType',
  'fulfilmentOperator',
  'itemCount',
  'itemCountTo',
  'itemCountOperator',
  'total',
  'totalTo',
  'totalOperator',
  'submittedDate',
  'submittedTo',
  'submittedOperator',
] as const;
const filterFields: Array<{ value: FilterField; label: string }> = [
  { value: 'status', label: 'Status' },
  { value: 'fulfilment', label: 'Fulfilment' },
  { value: 'itemCount', label: 'No. of Items' },
  { value: 'total', label: 'Total' },
  { value: 'submitted', label: 'Submitted' },
];
const filterOperators: Record<FilterField, Array<{ value: FilterOperator; label: string }>> = {
  status: [
    { value: 'equals', label: 'Equals' },
    { value: 'notEquals', label: 'Does not equal' },
  ],
  fulfilment: [
    { value: 'equals', label: 'Equals' },
    { value: 'notEquals', label: 'Does not equal' },
  ],
  itemCount: [
    { value: 'equals', label: 'Equals' },
    { value: 'greaterThan', label: 'Greater than' },
    { value: 'lessThan', label: 'Less than' },
    { value: 'between', label: 'Between' },
  ],
  total: [
    { value: 'equals', label: 'Equals' },
    { value: 'greaterThan', label: 'Greater than' },
    { value: 'lessThan', label: 'Less than' },
    { value: 'between', label: 'Between' },
  ],
  submitted: [
    { value: 'on', label: 'On' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
  ],
};
let nextFilterId = 1;
const emptyFilter = (): DraftFilter => ({
  id: nextFilterId++,
  field: '',
  operator: '',
  value: '',
  secondValue: '',
});

export function SalesQuotationsPage() {
  const { user } = useSalesAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<SalesQuotationSummary[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [referenceInput, setReferenceInput] = useState(searchParams.get('reference') ?? '');
  const [customerInput, setCustomerInput] = useState(searchParams.get('customer') ?? '');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<DraftFilter[]>(() =>
    filtersFromParams(searchParams),
  );
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const reference = searchParams.get('reference') ?? '';
  const customer = searchParams.get('customer') ?? '';
  const listQuery = useMemo(() => listQueryFromParams(searchParams), [searchParams]);
  const advancedFilterCount = useMemo(() => countAdvancedFilters(searchParams), [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (referenceInput === reference && customerInput === customer) return;
      const params = new URLSearchParams(searchParams);
      setOrDelete(params, 'reference', referenceInput);
      setOrDelete(params, 'customer', customerInput);
      params.set('page', '1');
      setSearchParams(params);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [customer, customerInput, reference, referenceInput, searchParams, setSearchParams]);

  useEffect(() => {
    if (!filterOpen) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      advancedParamKeys.forEach((key) => params.delete(key));
      draftFilters.filter(isCompleteFilter).forEach((filter) => addFilterToParams(params, filter));
      params.set('page', '1');
      if (params.toString() !== searchParams.toString()) setSearchParams(params);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftFilters, filterOpen, searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void listSalesQuotations({ page, reference, customer, ...listQuery })
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
  }, [customer, listQuery, page, reference]);

  const updatePage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(nextPage));
    setSearchParams(params);
  };
  const openFilters = () => {
    setDraftFilters(filtersFromParams(searchParams));
    setFilterOpen(true);
  };
  const reset = () => {
    setReferenceInput('');
    setCustomerInput('');
    setDraftFilters([emptyFilter()]);
    setSearchParams(new URLSearchParams({ page: '1' }));
  };
  const visibleIds = items.map((item) => item.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const from = pagination.total ? (pagination.page - 1) * 10 + 1 : 0;
  const to = Math.min(pagination.page * 10, pagination.total);
  const pages = useMemo(() => visiblePages(pagination.page, pagination.totalPages), [pagination]);
  const pageTitle =
    user?.role === 'HADER_MANAGER'
      ? 'Delivery Price Approvals'
      : user?.role === 'PRICE_MANAGER'
        ? 'Product Price Approvals'
        : 'Quotations';
  const pageDescription =
    user?.role === 'HADER_MANAGER'
      ? 'Review quotations currently waiting for Hader delivery-price approval.'
      : user?.role === 'PRICE_MANAGER'
        ? 'Review quotations currently waiting for product-price approval.'
        : 'Review customer requirements and prepare commercial quotations.';

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--customer-text,#1a1b23)]">
          {pageTitle}
        </h1>
        <p className="mt-1 text-sm text-[var(--customer-text-muted,#64748b)]">{pageDescription}</p>
      </header>
      <section className="relative overflow-hidden rounded-xl border border-[var(--customer-border,#e3e1e8)] bg-[var(--customer-card,#fff)]">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--customer-border,#e3e1e8)] px-4 py-2">
          <p className="text-sm font-semibold text-[var(--customer-text,#1a1b23)]">
            {pagination.total} Quotations
          </p>
          <div className="flex items-center gap-2">
            {(reference || customer || advancedFilterCount > 0) && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--customer-primary,#54247a)] hover:bg-[var(--customer-primary-soft,#f6f2fa)]"
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
            <button
              type="button"
              onClick={openFilters}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--customer-border,#e3e1e8)] px-3 text-sm font-semibold text-[var(--customer-text,#1a1b23)] hover:bg-[var(--customer-primary-soft,#f6f2fa)]"
            >
              <Filter size={15} /> Filter
              {advancedFilterCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--customer-primary,#54247a)] px-1 text-[11px] text-white">
                  {advancedFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
        {error ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm font-semibold text-[#b42318]">Unable to load quotations.</p>
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams(searchParams))}
              className="rounded-lg border border-[var(--customer-border,#e3e1e8)] px-4 py-2 text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead className="bg-[var(--customer-surface-secondary,#f8fafc)] text-[var(--customer-text-muted,#64748b)]">
                  <tr className="border-b border-[var(--customer-border,#e3e1e8)] font-semibold">
                    <th className="w-12 px-4 py-3 text-center">
                      <CheckBox
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : visibleIds)}
                        label="Select visible quotations"
                      />
                    </th>
                    <th className="min-w-52 px-3 py-3">Quotation Reference</th>
                    <th className="min-w-52 px-3 py-3">Customer</th>
                    <th className="min-w-48 px-3 py-3">Status</th>
                    <th className="min-w-32 px-3 py-3">Fulfilment</th>
                    <th className="w-32 px-3 py-3">No. of Items</th>
                    <th className="min-w-40 px-3 py-3 text-right">Total</th>
                    <th className="w-32 px-3 py-3" aria-label="Submitted time" />
                  </tr>
                  <tr className="border-b border-[var(--customer-border,#e3e1e8)] bg-[var(--customer-card,#fff)]">
                    <th />
                    <th className="px-3 py-2">
                      <QuotationQuickFilter
                        field="reference"
                        ariaLabel="Quotation reference"
                        value={referenceInput}
                        onChange={setReferenceInput}
                      />
                    </th>
                    <th className="px-3 py-2">
                      <QuotationQuickFilter
                        field="customer"
                        ariaLabel="Customer"
                        value={customerInput}
                        onChange={setCustomerInput}
                      />
                    </th>
                    <th colSpan={5} />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows />
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--customer-border,#e2e8f0)] last:border-0 hover:bg-[var(--customer-primary-soft,#faf8fc)]"
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
                            className="font-bold text-[var(--customer-primary,#54247a)] hover:underline"
                          >
                            {item.reference ?? 'Reference pending'}
                          </Link>
                        </td>
                        <td className="max-w-64 truncate px-3 py-3 font-medium text-[var(--customer-text,#1a1b23)]">
                          {item.customer}
                        </td>
                        <td className="px-3 py-3">
                          <Status status={item.status} />
                        </td>
                        <td className="px-3 py-3">
                          {item.fulfilmentType === 'PICKUP' ? 'Pick-Up' : 'Delivery'}
                        </td>
                        <td className="px-3 py-3">
                          {item.itemCount} {item.itemCount === 1 ? 'Item' : 'Items'}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">
                          {item.total === null ? '—' : formatMoney(item.total)}
                        </td>
                        <td
                          className="px-3 py-3 text-right text-xs text-[var(--customer-text-muted,#64748b)]"
                          title={formatExactDateTime(item.submittedAt)}
                        >
                          {formatRelativeTime(item.submittedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              <div className="grid grid-cols-2 gap-2">
                <QuotationQuickFilter
                  field="reference"
                  ariaLabel="Quotation reference"
                  value={referenceInput}
                  onChange={setReferenceInput}
                />
                <QuotationQuickFilter
                  field="customer"
                  ariaLabel="Customer"
                  value={customerInput}
                  onChange={setCustomerInput}
                />
              </div>
              {loading ? (
                <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
              ) : (
                items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/sales/quotations/${item.id}`}
                    className="block rounded-lg border border-[var(--customer-border,#e3e1e8)] p-3 hover:bg-[var(--customer-primary-soft,#faf8fc)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-bold text-[var(--customer-primary,#54247a)]">
                        {item.reference}
                      </span>
                      <Status status={item.status} />
                    </div>
                    <p className="mt-2 text-sm font-semibold">{item.customer}</p>
                    <div className="mt-2 flex justify-between gap-3 text-xs text-[var(--customer-text-muted,#64748b)]">
                      <span>
                        {item.itemCount} {item.itemCount === 1 ? 'Item' : 'Items'} ·{' '}
                        {item.fulfilmentType === 'PICKUP' ? 'Pick-Up' : 'Delivery'}
                      </span>
                      <span title={formatExactDateTime(item.submittedAt)}>
                        {formatRelativeTime(item.submittedAt)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
            {!loading && items.length === 0 && (
              <div className="flex min-h-52 items-center justify-center px-4 text-sm text-[var(--customer-text-muted,#64748b)]">
                No submitted quotations match the current filters.
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-[var(--customer-border,#e3e1e8)] bg-[var(--customer-card,#fff)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-[var(--customer-text-muted,#64748b)]">
                {selected.length ? `${selected.length} selected · ` : ''}Showing {from}–{to} of{' '}
                {pagination.total}
              </span>
              <nav className="flex items-center gap-1" aria-label="Quotation pages">
                <PageButton disabled={page <= 1} onClick={() => updatePage(page - 1)}>
                  <ChevronLeft size={14} /> Previous
                </PageButton>
                {pages.map((value) => (
                  <PageButton key={value} active={value === page} onClick={() => updatePage(value)}>
                    {value}
                  </PageButton>
                ))}
                <PageButton
                  disabled={page >= pagination.totalPages}
                  onClick={() => updatePage(page + 1)}
                >
                  Next <ChevronRight size={14} />
                </PageButton>
              </nav>
            </div>
          </>
        )}
      </section>
      {filterOpen && (
        <AdvancedFilterPopup
          filters={draftFilters}
          setFilters={setDraftFilters}
          close={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

function QuotationQuickFilter({
  field,
  ariaLabel,
  value,
  onChange,
}: {
  field: 'reference' | 'customer';
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <AsyncSearchableTomSelect
      ariaLabel={ariaLabel}
      size="compact"
      value={value}
      loadOptions={(query, signal) => loadFilterOptions(field, query, signal)}
      onChange={onChange}
    />
  );
}

function AdvancedFilterPopup({
  filters,
  setFilters,
  close,
}: {
  filters: DraftFilter[];
  setFilters: React.Dispatch<React.SetStateAction<DraftFilter[]>>;
  close: () => void;
}) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [close]);
  const update = (id: number, patch: Partial<DraftFilter>) =>
    setFilters((current) =>
      current.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)),
    );
  const usedFields = new Set(filters.map((filter) => filter.field).filter(Boolean));
  const canAdd = filters.every(isCompleteFilter) && usedFields.size < filterFields.length;
  return (
    <div className="fixed inset-0 z-[120]" onMouseDown={close}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="quotation-filter-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute right-4 top-20 max-h-[calc(100vh-6rem)] w-[min(760px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[var(--customer-border,#e3e1e8)] bg-[var(--customer-card,#fff)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--customer-border,#e3e1e8)] px-4 py-3">
          <div>
            <h2
              id="quotation-filter-title"
              className="text-base font-bold text-[var(--customer-text,#1a1b23)]"
            >
              Filter Quotations
            </h2>
            <p className="mt-0.5 text-xs text-[var(--customer-text-muted,#64748b)]">
              Filters apply automatically.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close filters"
            onClick={close}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--customer-border,#e3e1e8)] hover:bg-[var(--customer-primary-soft,#f6f2fa)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {filters.map((filter) => (
            <AdvancedFilterRow
              key={filter.id}
              filter={filter}
              unavailableFields={usedFields}
              update={(patch) => update(filter.id, patch)}
              remove={() =>
                setFilters((current) =>
                  current.length === 1
                    ? [emptyFilter()]
                    : current.filter((item) => item.id !== filter.id),
                )
              }
            />
          ))}
          {canAdd && (
            <button
              type="button"
              onClick={() => setFilters((current) => [...current, emptyFilter()])}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-[var(--customer-primary,#54247a)] hover:bg-[var(--customer-primary-soft,#f6f2fa)]"
            >
              <Plus size={15} /> Add Filter
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function AdvancedFilterRow({
  filter,
  unavailableFields,
  update,
  remove,
}: {
  filter: DraftFilter;
  unavailableFields: Set<FilterField | ''>;
  update: (patch: Partial<DraftFilter>) => void;
  remove: () => void;
}) {
  const operators = filter.field ? filterOperators[filter.field] : [];
  const between = filter.operator === 'between';
  const fieldOptions = filterFields.filter(
    (option) => option.value === filter.field || !unavailableFields.has(option.value),
  );
  const allowCreate =
    filter.field === 'itemCount' || filter.field === 'total' || filter.field === 'submitted';
  const validateCreate = filter.field === 'submitted' ? validDate : validNonNegativeNumber;
  return (
    <div className="grid items-end gap-3 rounded-lg bg-[var(--customer-surface-secondary,#f8fafc)] p-3 sm:grid-cols-[1fr_1fr_1.35fr_auto]">
      <FilterSelect
        label="Field"
        value={filter.field}
        {...labelProp(filterFields.find((item) => item.value === filter.field)?.label)}
        options={fieldOptions}
        onChange={(field) =>
          update({ field: field as FilterField | '', operator: '', value: '', secondValue: '' })
        }
      />
      <FilterSelect
        label="Operator"
        value={filter.operator}
        {...labelProp(operators.find((item) => item.value === filter.operator)?.label)}
        options={operators}
        disabled={!filter.field}
        onChange={(operator) =>
          update({ operator: operator as FilterOperator | '', value: '', secondValue: '' })
        }
      />
      <div className={between ? 'grid min-w-0 grid-cols-2 gap-2' : 'min-w-0'}>
        <FilterValue
          label={between ? 'From value' : 'Value'}
          field={filter.field}
          value={filter.value}
          disabled={!filter.field || !filter.operator}
          allowCreate={allowCreate}
          validateCreate={validateCreate}
          onChange={(value) => update({ value })}
        />
        {between && (
          <FilterValue
            label="To value"
            field={filter.field}
            value={filter.secondValue}
            disabled={!filter.field || !filter.operator}
            allowCreate={allowCreate}
            validateCreate={validateCreate}
            onChange={(secondValue) => update({ secondValue })}
          />
        )}
      </div>
      <button
        type="button"
        aria-label="Remove filter"
        onClick={remove}
        className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--customer-border,#e3e1e8)] hover:bg-[var(--customer-primary-soft,#f6f2fa)]"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  selectedLabel,
  options,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  selectedLabel?: string;
  options: SalesFilterOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`min-w-0 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <span className="mb-1 block text-xs font-semibold text-[var(--customer-text-muted,#64748b)]">
        {label}
      </span>
      <AsyncSearchableTomSelect
        ariaLabel={label}
        size="compact"
        value={value}
        {...labelProp(selectedLabel)}
        loadOptions={async (query) => filterOptions(options, query)}
        onChange={onChange}
      />
    </label>
  );
}
function FilterValue({
  label,
  field,
  value,
  disabled,
  allowCreate,
  validateCreate,
  onChange,
}: {
  label: string;
  field: FilterField | '';
  value: string;
  disabled: boolean;
  allowCreate: boolean;
  validateCreate: (value: string) => boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`min-w-0 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <span className="mb-1 block text-xs font-semibold text-[var(--customer-text-muted,#64748b)]">
        {label}
      </span>
      <AsyncSearchableTomSelect
        ariaLabel={label}
        size="compact"
        value={value}
        {...labelProp(formatFilterValueLabel(field, value))}
        allowCreate={allowCreate}
        validateCreate={validateCreate}
        loadOptions={(query, signal) =>
          field
            ? loadFilterOptions(field === 'fulfilment' ? 'fulfilment' : field, query, signal)
            : Promise.resolve([])
        }
        onChange={onChange}
      />
    </label>
  );
}
async function loadFilterOptions(
  field: 'reference' | 'customer' | FilterField,
  query: string,
  signal: AbortSignal,
) {
  const options = await getSalesQuotationFilterOptions({ field, search: query, limit: 20 });
  return signal.aborted ? [] : options;
}
async function filterOptions(options: SalesFilterOption[], query: string) {
  const normalized = query.trim().toLowerCase();
  return normalized
    ? options.filter((option) => option.label.toLowerCase().includes(normalized))
    : options;
}

function filtersFromParams(params: URLSearchParams): DraftFilter[] {
  const filters: DraftFilter[] = [];
  addParamFilter(filters, params, 'status', 'statusOperator');
  addParamFilter(filters, params, 'fulfilment', 'fulfilmentOperator', 'fulfilmentType');
  addParamFilter(filters, params, 'itemCount', 'itemCountOperator', 'itemCount', 'itemCountTo');
  addParamFilter(filters, params, 'total', 'totalOperator', 'total', 'totalTo');
  addParamFilter(filters, params, 'submitted', 'submittedOperator', 'submittedDate', 'submittedTo');
  return filters.length ? filters : [emptyFilter()];
}
function addParamFilter(
  filters: DraftFilter[],
  params: URLSearchParams,
  field: FilterField,
  operatorKey: string,
  valueKey: string = field,
  secondValueKey?: string,
) {
  const value = params.get(valueKey) ?? '';
  if (!value) return;
  filters.push({
    id: nextFilterId++,
    field,
    operator: (params.get(operatorKey) ?? defaultOperator(field)) as FilterOperator,
    value,
    secondValue: secondValueKey ? (params.get(secondValueKey) ?? '') : '',
  });
}
function addFilterToParams(params: URLSearchParams, filter: DraftFilter) {
  if (!filter.field || !filter.operator) return;
  const mapping = {
    status: ['status', 'statusOperator', ''],
    fulfilment: ['fulfilmentType', 'fulfilmentOperator', ''],
    itemCount: ['itemCount', 'itemCountOperator', 'itemCountTo'],
    total: ['total', 'totalOperator', 'totalTo'],
    submitted: ['submittedDate', 'submittedOperator', 'submittedTo'],
  } as const;
  const [valueKey, operatorKey, secondKey] = mapping[filter.field];
  params.set(valueKey, filter.value);
  params.set(operatorKey, filter.operator);
  if (filter.operator === 'between' && secondKey) params.set(secondKey, filter.secondValue);
}
function listQueryFromParams(params: URLSearchParams) {
  return {
    submittedDate: params.get('submittedDate') ?? '',
    submittedTo: params.get('submittedTo') ?? '',
    submittedOperator: (params.get('submittedOperator') ?? '') as
      '' | 'on' | 'before' | 'after' | 'between',
    fulfilmentType: (params.get('fulfilmentType') ?? '') as '' | 'PICKUP' | 'DELIVERY',
    fulfilmentOperator: (params.get('fulfilmentOperator') ?? '') as '' | 'equals' | 'notEquals',
    status: (params.get('status') ?? '') as '' | SalesQuotationStatus,
    statusOperator: (params.get('statusOperator') ?? '') as '' | 'equals' | 'notEquals',
    itemCount: params.get('itemCount') ?? '',
    itemCountTo: params.get('itemCountTo') ?? '',
    itemCountOperator: (params.get('itemCountOperator') ?? '') as
      '' | 'equals' | 'greaterThan' | 'lessThan' | 'between',
    total: params.get('total') ?? '',
    totalTo: params.get('totalTo') ?? '',
    totalOperator: (params.get('totalOperator') ?? '') as
      '' | 'equals' | 'greaterThan' | 'lessThan' | 'between',
  };
}
function countAdvancedFilters(params: URLSearchParams) {
  return ['status', 'fulfilmentType', 'itemCount', 'total', 'submittedDate'].filter((key) =>
    params.has(key),
  ).length;
}
function isCompleteFilter(filter: DraftFilter) {
  return Boolean(
    filter.field &&
    filter.operator &&
    filter.value &&
    (filter.operator !== 'between' || filter.secondValue),
  );
}
function defaultOperator(field: FilterField): FilterOperator {
  return field === 'submitted' ? 'on' : 'equals';
}
function setOrDelete(params: URLSearchParams, key: string, value: string) {
  const normalized = value.trim();
  if (normalized) params.set(key, normalized);
  else params.delete(key);
}
function validNonNegativeNumber(value: string) {
  const number = Number(value);
  return value.trim() !== '' && Number.isFinite(number) && number >= 0;
}
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
  );
}
function formatFilterValueLabel(field: FilterField | '', value: string) {
  if (!value) return undefined;
  if (field === 'status') return statusMap[value as SalesQuotationStatus]?.label ?? value;
  if (field === 'fulfilment') return value === 'PICKUP' ? 'Pick-Up' : 'Delivery';
  if (field === 'itemCount') return `${value} ${value === '1' ? 'Item' : 'Items'}`;
  if (field === 'total') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(2)} SAR` : value;
  }
  return value;
}
function labelProp(value: string | undefined): { selectedLabel?: string } {
  return value ? { selectedLabel: value } : {};
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
      className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold disabled:opacity-40 ${active ? 'border-[var(--customer-primary,#54247a)] bg-[var(--customer-primary-soft,#f6f2fa)] text-[var(--customer-primary,#54247a)]' : 'border-[var(--customer-border,#e3e1e8)] text-[var(--customer-text-muted,#64748b)] hover:bg-[var(--customer-primary-soft,#f6f2fa)]'}`}
    >
      {children}
    </button>
  );
}
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <tr key={index} className="border-b border-[var(--customer-border,#e2e8f0)]">
          <td colSpan={8} className="px-3 py-3">
            <div className="h-5 animate-pulse rounded bg-[var(--customer-surface-secondary,#f1f5f9)]" />
          </td>
        </tr>
      ))}
    </>
  );
}
function Status({ status }: { status: SalesQuotationStatus }) {
  const item = statusMap[status];
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-semibold ${item.text}`}>
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
function formatRelativeTime(value: string | null) {
  if (!value) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
function formatExactDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Submission time unavailable';
}
function formatMoney(value: number) {
  return `${new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} SAR`;
}
function visiblePages(page: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.min(Math.max(1, page - 2), total - 4);
  return Array.from({ length: 5 }, (_, index) => start + index);
}
