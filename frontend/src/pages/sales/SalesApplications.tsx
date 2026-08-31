import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getSalesApplicationFilterOptions,
  listSalesApplications,
  SalesApiError,
  type SalesApplicationStatus,
  type SalesApplicationSummary,
  type SalesApplicationsPagination,
} from '../../services/salesService';
import { ErrorBanner } from './SalesDashboard';
import { salesStatuses, statusLabels } from './salesUtils';
import { AsyncSearchableTomSelect } from '../../components/ui/AsyncSearchableTomSelect';

const fixedPageSize = 10;

type AdvancedFilterField =
  'reference' | 'company' | 'contact' | 'contactEmail' | 'contactPhone' | 'status' | 'submitted';

type FilterDraft = {
  field: AdvancedFilterField;
  operator:
    | 'contains'
    | 'not_contains'
    | 'equals'
    | 'not_equals'
    | 'starts_with'
    | 'ends_with'
    | 'is_empty'
    | 'is_not_empty'
    | 'from'
    | 'between';
  value: string;
  valueTo: string;
};

const initialFilterDraft: FilterDraft = {
  field: 'contact',
  operator: 'contains',
  value: '',
  valueTo: '',
};

export function SalesApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<SalesApplicationSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState<SalesApplicationsPagination>({
    page: 1,
    pageSize: fixedPageSize,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quickReference, setQuickReference] = useState(searchParams.get('reference') ?? '');
  const [quickCompany, setQuickCompany] = useState(searchParams.get('company') ?? '');
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [filterDraft, setFilterDraft] = useState<FilterDraft>(initialFilterDraft);

  const page = Number(searchParams.get('page') ?? '1');
  const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
  const reference = searchParams.get('reference') ?? '';
  const company = searchParams.get('company') ?? '';
  const contact = searchParams.get('contact') ?? '';
  const submittedFrom = searchParams.get('submittedFrom') ?? '';
  const submittedTo = searchParams.get('submittedTo') ?? '';
  const status = (searchParams.get('status') ?? '') as SalesApplicationStatus | '';

  useEffect(() => {
    setQuickReference(reference);
    setQuickCompany(company);
  }, [company, reference]);

  useEffect(() => {
    const nextReference = quickReference.trim();
    const nextCompany = quickCompany.trim();

    if (nextReference === reference && nextCompany === company) return;

    const debounceTimer = window.setTimeout(() => {
      updateParams({
        reference: nextReference,
        company: nextCompany,
        page: 1,
      });
    }, 450);

    return () => window.clearTimeout(debounceTimer);
  }, [company, quickCompany, quickReference, reference]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await listSalesApplications({
          reference,
          company,
          contact,
          submittedFrom,
          submittedTo,
          status,
          page: normalizedPage,
          pageSize: fixedPageSize,
        });
        if (!mounted) return;
        setItems(response.items);
        setPagination(response.pagination);
        setSelectedIds([]);
      } catch (loadError) {
        if (!mounted) return;
        setError(
          loadError instanceof SalesApiError
            ? 'Unable to load applications right now. Please retry.'
            : 'Unable to load applications.',
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [company, contact, normalizedPage, reference, status, submittedFrom, submittedTo]);

  const updateParams = (next: {
    reference?: string;
    company?: string;
    contact?: string;
    submittedFrom?: string;
    submittedTo?: string;
    status?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams(searchParams);

    updateOptionalParam(params, 'reference', next.reference);
    updateOptionalParam(params, 'company', next.company);
    updateOptionalParam(params, 'contact', next.contact);
    updateOptionalParam(params, 'submittedFrom', next.submittedFrom);
    updateOptionalParam(params, 'submittedTo', next.submittedTo);
    updateOptionalParam(params, 'status', next.status);

    params.delete('search');
    params.delete('pageSize');
    params.set('page', String(next.page ?? 1));
    setSearchParams(params);
  };

  const resetAll = () => {
    setQuickReference('');
    setQuickCompany('');
    setFilterDraft(initialFilterDraft);
    setShowFilterBuilder(false);
    setSearchParams(new URLSearchParams({ page: '1' }));
  };

  const applyAdvancedFilter = () => {
    const value = filterDraft.value.trim();
    const valueTo = filterDraft.valueTo.trim();
    const supportedOperator =
      filterDraft.operator === 'contains' ||
      filterDraft.operator === 'equals' ||
      filterDraft.operator === 'from' ||
      filterDraft.operator === 'between';

    if (!supportedOperator) return;

    if (filterDraft.field === 'reference') {
      updateParams({ reference: value, page: 1 });
    }

    if (filterDraft.field === 'company') {
      updateParams({ company: value, page: 1 });
    }

    if (
      filterDraft.field === 'contact' ||
      filterDraft.field === 'contactEmail' ||
      filterDraft.field === 'contactPhone'
    ) {
      updateParams({ contact: value, page: 1 });
    }

    if (filterDraft.field === 'status') {
      updateParams({ status: value, page: 1 });
    }

    if (filterDraft.field === 'submitted') {
      updateParams({
        submittedFrom: value,
        submittedTo: filterDraft.operator === 'between' ? valueTo : '',
        page: 1,
      });
    }

    setShowFilterBuilder(false);
    setFilterDraft(initialFilterDraft);
  };

  const removeAdvancedFilter = (key: 'contact' | 'status' | 'submitted') => {
    if (key === 'contact') updateParams({ contact: '', page: 1 });
    if (key === 'status') updateParams({ status: '', page: 1 });
    if (key === 'submitted') updateParams({ submittedFrom: '', submittedTo: '', page: 1 });
  };

  const visibleIds = items.map((application) => application.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const hasFilters = Boolean(
    reference || company || contact || submittedFrom || submittedTo || status,
  );
  const activeAdvancedFilterCount = [contact, status, submittedFrom || submittedTo].filter(
    Boolean,
  ).length;
  const showingFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const showingTo = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const pageNumbers = useMemo(
    () => getVisiblePages(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );

  const toggleVisibleSelection = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleIds);
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Applications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review submitted customer organization applications.
          </p>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <QuickSearchableFilter
            field="reference"
            value={quickReference}
            placeholder="Application Reference"
            onChange={setQuickReference}
          />
          <QuickSearchableFilter
            field="company"
            value={quickCompany}
            placeholder="Company Name"
            onChange={setQuickCompany}
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="h-9 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setShowFilterBuilder((current) => !current)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#4b2c71] bg-white px-4 text-sm font-bold text-[#4b2c71] hover:bg-[#f6f2fa]"
            >
              <Filter size={15} />
              Filter
              {activeAdvancedFilterCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#4b2c71] px-1.5 text-xs font-black text-white">
                  {activeAdvancedFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {showFilterBuilder && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <FilterSelect
                value={filterDraft.field}
                onChange={(value) => {
                  const isSubmitted = value === 'submitted';
                  setFilterDraft({
                    field: value as AdvancedFilterField,
                    operator: value === 'status' ? 'equals' : isSubmitted ? 'from' : 'contains',
                    value: isSubmitted ? getTodayInputDate() : '',
                    valueTo: '',
                  });
                }}
                options={[
                  ['reference', 'Application Reference'] as const,
                  ['company', 'Company Name'] as const,
                  ['contact', 'Contact'] as const,
                  ['contactEmail', 'Contact Email'] as const,
                  ['contactPhone', 'Contact Phone'] as const,
                  ['status', 'Status'] as const,
                  ['submitted', 'Submitted Date'] as const,
                ]}
              />
              <FilterSelect
                value={filterDraft.operator}
                onChange={(value) =>
                  setFilterDraft((current) => ({
                    ...current,
                    operator: value as FilterDraft['operator'],
                    valueTo:
                      current.field === 'submitted' && value === 'between'
                        ? current.valueTo || getTodayInputDate()
                        : '',
                  }))
                }
                options={getOperatorOptions(filterDraft.field)}
              />
              {filterDraft.operator === 'is_empty' || filterDraft.operator === 'is_not_empty' ? (
                <div className="min-w-[170px] flex-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500">
                  No value required
                </div>
              ) : filterDraft.field === 'status' ? (
                <FilterSelect
                  value={filterDraft.value}
                  onChange={(value) => setFilterDraft((current) => ({ ...current, value }))}
                  options={[
                    ['', 'Select Status'] as const,
                    ...salesStatuses.map((option) => [option, statusLabels[option]] as const),
                  ]}
                />
              ) : filterDraft.field === 'submitted' ? (
                <FilterValueInput
                  type="date"
                  value={filterDraft.value}
                  placeholder={getFilterValuePlaceholder(filterDraft.field)}
                  onChange={(value) => setFilterDraft((current) => ({ ...current, value }))}
                />
              ) : (
                <SearchableFilterValueInput
                  field={filterDraft.field}
                  value={filterDraft.value}
                  placeholder={getFilterValuePlaceholder(filterDraft.field)}
                  onChange={(value) => setFilterDraft((current) => ({ ...current, value }))}
                />
              )}
              {filterDraft.field === 'submitted' && filterDraft.operator === 'between' ? (
                <FilterValueInput
                  type="date"
                  value={filterDraft.valueTo}
                  onChange={(value) =>
                    setFilterDraft((current) => ({ ...current, valueTo: value }))
                  }
                />
              ) : (
                <div className="hidden xl:block xl:flex-1" />
              )}
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={applyAdvancedFilter}
                  disabled={!canApplyFilter(filterDraft)}
                  className="h-9 rounded-lg bg-[#4b2c71] px-4 text-sm font-bold text-white hover:bg-[#382055] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilterBuilder(false)}
                  className="h-9 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            </div>
            {!isSupportedFilterOperator(filterDraft.operator) && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                This operator is available in the UI but needs backend support before it can be
                applied.
              </p>
            )}
          </div>
        )}

        {(contact || status || submittedFrom || submittedTo) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Active filters
            </span>
            {contact && (
              <FilterChip
                label={`Contact contains ${contact}`}
                onRemove={() => removeAdvancedFilter('contact')}
              />
            )}
            {status && (
              <FilterChip
                label={`Status equals ${statusLabels[status]}`}
                onRemove={() => removeAdvancedFilter('status')}
              />
            )}
            {(submittedFrom || submittedTo) && (
              <FilterChip
                label={`Submitted ${submittedTo ? 'between' : 'from'} ${submittedFrom}${submittedTo ? ` and ${submittedTo}` : ''}`}
                onRemove={() => removeAdvancedFilter('submitted')}
              />
            )}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <span aria-hidden="true" />
          <p className="text-sm font-bold text-slate-600">{pagination.total} Applications</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-[12px] font-semibold text-slate-500">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelection}
                    disabled={items.length === 0 || loading}
                    aria-label="Select all visible applications"
                    className="h-4 w-4 rounded border border-slate-300 accent-[#4b2c71] checked:border-[#4b2c71] focus:ring-[#4b2c71]/20"
                  />
                </th>
                <th className="w-[190px] whitespace-nowrap px-3 py-3">Application Reference</th>
                <th className="w-[230px] whitespace-nowrap px-3 py-3">Company</th>
                <th className="w-[150px] whitespace-nowrap px-3 py-3">Status</th>
                <th className="w-[320px] whitespace-nowrap px-3 py-3">Contact</th>
                <th className="w-[140px] whitespace-nowrap px-3 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <ApplicationSkeletonRows />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="font-bold text-slate-700">
                      {hasFilters
                        ? 'No applications match your search or filters.'
                        : 'No submitted applications yet.'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {hasFilters
                        ? 'Try different search values or filters.'
                        : 'Submitted customer registrations will appear here.'}
                    </p>
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={resetAll}
                        className="mt-3 text-sm font-bold text-[#4b2c71] hover:underline"
                      >
                        Reset search and filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((application) => (
                  <tr key={application.id} className="transition hover:bg-slate-50/80">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(application.id)}
                        onChange={() => toggleRowSelection(application.id)}
                        aria-label={`Select ${application.reference ?? 'application'}`}
                        className="h-4 w-4 rounded border border-slate-300 accent-[#4b2c71] checked:border-[#4b2c71] focus:ring-[#4b2c71]/20"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Link
                        to={`/sales/applications/${application.id}`}
                        className="customer-text font-extrabold underline-offset-4 transition-colors hover:text-[var(--customer-primary)] hover:underline"
                      >
                        {application.reference ?? 'No reference'}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <p
                        className="truncate font-semibold text-slate-900"
                        title={application.companyName ?? undefined}
                      >
                        {application.companyName ?? 'Unnamed company'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusDot status={application.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold text-slate-900"
                          title={application.contactName ?? undefined}
                        >
                          {application.contactName ?? 'No contact name'}
                        </p>
                        <p
                          className="truncate text-[11px] leading-4 text-slate-500"
                          title={[application.contactEmail, application.contactPhone]
                            .filter(Boolean)
                            .join(' · ')}
                        >
                          {[application.contactEmail, application.contactPhone]
                            .filter(Boolean)
                            .join(' · ') || 'No contact details'}
                        </p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {formatSubmittedDate(application.submittedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row">
        <p className="text-sm font-medium text-slate-500">
          Showing {showingFrom}-{showingTo} of {pagination.total}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            disabled={pagination.page <= 1 || loading}
            onClick={() => updateParams({ page: pagination.page - 1 })}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={15} />
            Previous
          </button>

          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              disabled={loading}
              onClick={() => updateParams({ page: pageNumber })}
              className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-bold ${
                pageNumber === pagination.page
                  ? 'border-[#4b2c71] bg-[#4b2c71] text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {pageNumber}
            </button>
          ))}

          <button
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => updateParams({ page: pagination.page + 1 })}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickSearchableFilter({
  field,
  value,
  placeholder,
  onChange,
}: {
  field: 'reference' | 'company';
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 flex-1">
      <span className="sr-only">{placeholder}</span>
      <AsyncSearchableTomSelect
        ariaLabel={placeholder}
        size="compact"
        placeholder={placeholder}
        value={value}
        loadOptions={async (query, signal) => {
          const options = await getSalesApplicationFilterOptions({ field, search: query, limit: 20 });
          return signal.aborted ? [] : options;
        }}
        onChange={onChange}
      />
    </label>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-[170px] flex-1">
      <span className="sr-only">Filter option</span>
      <NativeTomSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </NativeTomSelect>
    </label>
  );
}

function FilterValueInput({
  value,
  type,
  placeholder,
  onChange,
}: {
  value: string;
  type: 'date' | 'text';
  placeholder?: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-[170px] flex-1">
      <span className="sr-only">{placeholder ?? 'Filter value'}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#4b2c71] focus:ring-2 focus:ring-[#4b2c71]/10"
        placeholder={placeholder}
      />
    </label>
  );
}

function SearchableFilterValueInput({
  field,
  value,
  placeholder,
  onChange,
}: {
  field: Exclude<AdvancedFilterField, 'status' | 'submitted'>;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-[220px] flex-1">
      <span className="sr-only">{placeholder}</span>
      <AsyncSearchableTomSelect
        ariaLabel={placeholder}
        value={value}
        placeholder={placeholder}
        loadOptions={async (query, signal) => {
          const options = await getSalesApplicationFilterOptions({ field, search: query, limit: 20 });
          return signal.aborted ? [] : options;
        }}
        onChange={onChange}
      />
    </label>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
      <Filter size={12} />
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
        aria-label={`Remove ${label}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

function StatusDot({ status }: { status: SalesApplicationStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
      <span className={`h-2 w-2 rounded-full ${statusDotClasses[status]}`} />
      {statusLabels[status]}
    </span>
  );
}

const statusDotClasses: Record<SalesApplicationStatus, string> = {
  DRAFT: 'bg-slate-400',
  PENDING_SALES_REVIEW: 'bg-amber-500',
  UNDER_REVIEW: 'bg-blue-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
  CHANGES_REQUESTED: 'bg-orange-500',
  ACTIVATED: 'bg-purple-500',
};

function ApplicationSkeletonRows() {
  return (
    <>
      {Array.from({ length: fixedPageSize }, (_, index) => (
        <tr key={index}>
          {Array.from({ length: 6 }, (_cell, cellIndex) => (
            <td key={cellIndex} className="px-3 py-2.5">
              <div className="h-4 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const safeTotalPages = Math.max(totalPages, 1);
  const start = Math.max(1, Math.min(currentPage - 2, safeTotalPages - 4));
  const end = Math.min(safeTotalPages, start + 4);

  return Array.from({ length: end - start + 1 }, (_item, index) => start + index);
}

function updateOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value === undefined) return;
  if (value) params.set(key, value);
  else params.delete(key);
}

function getOperatorOptions(field: AdvancedFilterField) {
  if (field === 'status') {
    return [
      ['equals', '= equals'],
      ['not_equals', '!= not equals'],
      ['is_empty', 'is empty'],
      ['is_not_empty', 'is not empty'],
    ] as const;
  }
  if (field === 'submitted') {
    return [
      ['from', '>= from'],
      ['between', 'between'],
      ['equals', '= on date'],
      ['not_equals', '!= not on date'],
      ['is_empty', 'is empty'],
      ['is_not_empty', 'is not empty'],
    ] as const;
  }

  return [
    ['contains', 'contains'],
    ['not_contains', 'does not contain'],
    ['equals', '= equals'],
    ['not_equals', '!= not equals'],
    ['starts_with', 'starts with'],
    ['ends_with', 'ends with'],
    ['is_empty', 'is empty'],
    ['is_not_empty', 'is not empty'],
  ] as const;
}

function isSupportedFilterOperator(operator: FilterDraft['operator']) {
  return (
    operator === 'contains' ||
    operator === 'equals' ||
    operator === 'from' ||
    operator === 'between'
  );
}

function canApplyFilter(draft: FilterDraft) {
  if (!isSupportedFilterOperator(draft.operator)) return false;
  if (!draft.value) return false;
  if (draft.operator === 'between' && !draft.valueTo) return false;

  return true;
}

function getFilterValuePlaceholder(field: AdvancedFilterField) {
  const labels: Record<AdvancedFilterField, string> = {
    reference: 'Application Reference',
    company: 'Company Name',
    contact: 'Contact',
    contactEmail: 'Contact Email',
    contactPhone: 'Contact Phone',
    status: 'Status',
    submitted: 'Submitted Date',
  };

  return labels[field];
}

function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatSubmittedDate(value: string | null | undefined) {
  if (!value) return '—';

  const submittedDate = new Date(value);
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - submittedDate.getTime()) / 1000));

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

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
  }).format(submittedDate);
}
