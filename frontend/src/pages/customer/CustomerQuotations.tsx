  import { AsyncSearchableTomSelect } from '../../components/ui/AsyncSearchableTomSelect';
  import type { SearchableSelectOption } from '../../components/ui/SearchableTomSelect';
  import {
    Button,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '../../components/ui/shadcn';
  import { CustomerListPageHeader } from '../../components/customer-list/CustomerListPageHeader';
  import {
    QueryFilterBuilder,
    QueryFilterChips,
    type QueryFilterDefinition,
    type QueryFilterRule,
  } from '../../components/customer-list/QueryFilterBuilder';
  import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react';
  import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
  } from 'react';
  import { Link } from 'react-router-dom';
  import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type Header,
    type SortingState,
  } from '@tanstack/react-table';
  import {
    listCustomerQuotations,
    type CustomerQuotationListFilters,
    type CustomerQuotationListResult,
    type CustomerQuotationSummary,
    type QuotationFulfilmentType,
    type QuotationStatus,
  } from '../../services/customerQuotationsService';
  import {
    getCustomerLocations,
    type CustomerLocation,
  } from '../../services/customerLocationsService';

  const emptyResult: CustomerQuotationListResult = {
    items: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
  };

  // A fresh fallback array retriggers TanStack's row-model/page-reset cycle.
  const emptySorting: SortingState = [];

  type RFQFilterField = 'reference' | 'status' | 'fulfilmentType' | 'deliveryLocation' | 'requestedDate';
  type RFQFilterOperator = 'contains' | 'equals';

  type RFQFilterRule = QueryFilterRule<RFQFilterField, RFQFilterOperator>;

  const initialFilters: Required<
    Pick<
      CustomerQuotationListFilters,
      'reference' | 'requestedDate' | 'fulfilmentType' | 'deliveryLocation' | 'status'
    >
  > = {
    reference: '',
    requestedDate: '',
    fulfilmentType: '',
    deliveryLocation: '',
    status: '',
  };

  export function CustomerQuotations() {
    const [filters, setFilters] = useState(initialFilters);
    const [appliedFilterRules, setAppliedFilterRules] = useState<RFQFilterRule[]>([]);
    const [referenceInput, setReferenceInput] = useState(initialFilters.reference);
    const [selectedReference, setSelectedReference] = useState(initialFilters.reference);
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<CustomerQuotationListResult>(emptyResult);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [deliveryLocations, setDeliveryLocations] = useState<CustomerLocation[]>([]);
    const referenceDebounceTimer = useRef<number | null>(null);

    const loadQuotations = useCallback(async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await listCustomerQuotations({
          page,
          reference: filters.reference,
          requestedDate: filters.requestedDate,
          fulfilmentType: filters.fulfilmentType,
          deliveryLocation: filters.deliveryLocation,
          status: filters.status,
        });
        setResult(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, [
      filters.deliveryLocation,
      filters.fulfilmentType,
      filters.reference,
      filters.requestedDate,
      filters.status,
      page,
    ]);

    useEffect(() => {
      void loadQuotations();
    }, [loadQuotations]);

    useEffect(() => {
      let active = true;
      void getCustomerLocations()
        .then((locations) => {
          if (active) setDeliveryLocations(locations);
        })
        .catch(() => {
          if (active) setDeliveryLocations([]);
        });

      return () => {
        active = false;
      };
    }, []);

    useEffect(
      () => () => {
        if (referenceDebounceTimer.current !== null) {
          window.clearTimeout(referenceDebounceTimer.current);
        }
      },
      [],
    );

    const hasFilters = Object.values(filters).some(Boolean);
    const showingFrom = result.pagination.total === 0 ? 0 : (page - 1) * 10 + 1;
    const showingTo = Math.min(page * 10, result.pagination.total);
    const pageNumbers = useMemo(
      () => getVisiblePages(page, result.pagination.totalPages),
      [page, result.pagination.totalPages],
    );
    const sortingEnabled = result.pagination.total <= result.pagination.pageSize;

    const applyFilters = (nextFilters: typeof initialFilters, nextRules = filtersToRules(nextFilters)) => {
      if (referenceDebounceTimer.current !== null) {
        window.clearTimeout(referenceDebounceTimer.current);
        referenceDebounceTimer.current = null;
      }
      setReferenceInput(nextFilters.reference);
      setSelectedReference('');
      setAppliedFilterRules(nextRules);
      setFilters(nextFilters);
      setPage(1);
      setSorting([]);
    };

    const updateInlineReference = (value: string) => {
      setReferenceInput(value);
      if (referenceDebounceTimer.current !== null) {
        window.clearTimeout(referenceDebounceTimer.current);
      }
      referenceDebounceTimer.current = window.setTimeout(() => {
        setFilters((current) =>
          current.reference === value ? current : { ...current, reference: value },
        );
        setAppliedFilterRules((current) => upsertReferenceRule(current, value));
        setPage(1);
        setSorting([]);
        referenceDebounceTimer.current = null;
      }, 375);
    };

    const resetFilters = () => {
      applyFilters(initialFilters);
    };

    const selectInlineReference = (value: string) => {
      if (referenceDebounceTimer.current !== null) {
        window.clearTimeout(referenceDebounceTimer.current);
        referenceDebounceTimer.current = null;
      }
      setSelectedReference(value);
      setReferenceInput(value);
      setFilters((current) =>
        current.reference === value ? current : { ...current, reference: value },
      );
      setAppliedFilterRules((current) => upsertReferenceRule(current, value));
      setPage(1);
      setSorting(emptySorting);
    };

    const applyFilterRules = (rules: RFQFilterRule[]) => {
      const completeRules = rules.filter(isCompleteRFQFilterRule).map(cloneRFQFilterRule);
      applyFilters(rulesToFilters(completeRules), completeRules);
    };

    const loadAdvancedReferenceOptions = useCallback(async (query: string, signal: AbortSignal) => {
      const response = await listCustomerQuotations({ page: 1, reference: query }, signal);
      const references = new Set(
        response.items.flatMap((quotation) => quotation.reference ? [quotation.reference] : []),
      );
      return Array.from(references, (reference) => ({ value: reference, label: reference }));
    }, []);

    const filterDefinitions = useMemo(
      () => getSharedRFQFilterDefinitions(deliveryLocations),
      [deliveryLocations],
    );

    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-5">
        <CustomerListPageHeader
          title="RFQs"
          createAction={{ label: 'New RFQ', to: '/customer/quotations/new' }}
        />

        <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--customer-border)] px-4 py-3 sm:px-5">
            <p className="text-base font-semibold text-[var(--customer-text)]">
              {result.pagination.total} {result.pagination.total === 1 ? 'RFQ' : 'RFQs'}
            </p>
            <QueryFilterBuilder
              appliedRules={appliedFilterRules}
              definitions={filterDefinitions}
              ariaLabel="RFQ filters"
              onApply={applyFilterRules}
              onClear={resetFilters}
              renderValueEditor={({ rule, onChange }) => (
                <AsyncSearchableTomSelect
                  value=""
                  searchText={rule.value}
                  placeholder="Select Value"
                  ariaLabel="Filter value"
                  loadOptions={loadAdvancedReferenceOptions}
                  onType={onChange}
                  onChange={onChange}
                  size="compact"
                />
              )}
            />
          </div>

          <QueryFilterChips
            rules={appliedFilterRules}
            formatRule={(rule) => formatFilterChip(rule, deliveryLocations)}
            onRemove={(id) =>
              applyFilterRules(appliedFilterRules.filter((rule) => rule.id !== id))
            }
            onClear={resetFilters}
          />

          <RFQDataTable
            data={result.items}
            error={error}
            filtered={hasFilters}
            loading={loading}
            referenceInput={referenceInput}
            selectedReference={selectedReference}
            sorting={sorting}
            sortingEnabled={sortingEnabled}
            onReferenceFilterChange={updateInlineReference}
            onReferenceSelect={selectInlineReference}
            onReset={resetFilters}
            onRetry={() => void loadQuotations()}
            onSortingChange={setSorting}
          />

          {!error && !loading && result.pagination.total > 0 && (
            <footer className="flex flex-col gap-3 border-t border-[var(--customer-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm text-[var(--customer-text-muted)]">
                Showing {showingFrom}-{showingTo} of {result.pagination.total} RFQs
              </p>
              <nav className="flex items-center gap-1" aria-label="RFQ pagination">
                <PaginationButton
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft size={15} /> Previous
                </PaginationButton>
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    aria-current={pageNumber === page ? 'page' : undefined}
                    className={`h-9 min-w-9 rounded-md border px-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)] ${
                      pageNumber === page
                        ? 'border-[var(--customer-primary)] bg-[var(--customer-primary-soft)] text-[var(--customer-primary)]'
                        : 'border-[var(--customer-border)] bg-[var(--customer-surface)] text-[var(--customer-text-muted)] hover:border-[var(--customer-primary)] hover:text-[var(--customer-primary)]'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <PaginationButton
                  disabled={page >= result.pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next <ChevronRight size={15} />
                </PaginationButton>
              </nav>
            </footer>
          )}
        </section>
      </div>
    );
  }

  function RFQDataTable({
    data,
    error,
    filtered,
    loading,
    referenceInput,
    selectedReference,
    sorting,
    sortingEnabled,
    onReferenceFilterChange,
    onReferenceSelect,
    onReset,
    onRetry,
    onSortingChange,
  }: {
    data: CustomerQuotationSummary[];
    error: boolean;
    filtered: boolean;
    loading: boolean;
    referenceInput: string;
    selectedReference: string;
    sorting: SortingState;
    sortingEnabled: boolean;
    onReferenceFilterChange: (value: string) => void;
    onReferenceSelect: (value: string) => void;
    onReset: () => void;
    onRetry: () => void;
    onSortingChange: Dispatch<SetStateAction<SortingState>>;
  }) {
    const loadReferenceOptions = useCallback(async (query: string, signal: AbortSignal) => {
      const response = await listCustomerQuotations({ page: 1, reference: query }, signal);
      const references = new Set(
        response.items.flatMap((quotation) => quotation.reference ? [quotation.reference] : []),
      );
      return Array.from(references, (reference) => ({ value: reference, label: reference }));
    }, []);
    const columns = useMemo<ColumnDef<CustomerQuotationSummary>[]>(
      () => [
        {
          accessorKey: 'reference',
          header: 'RFQ Reference',
          enableSorting: sortingEnabled,
          cell: ({ row }) => (
            <Link
              to={`/customer/quotations/${row.original.id}`}
              className="text-[15px] font-medium text-[var(--customer-primary)] underline-offset-4 hover:text-[var(--customer-primary-hover)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
            >
              {row.original.reference ?? 'Reference pending'}
            </Link>
          ),
        },
        {
          accessorKey: 'requestedDate',
          header: 'Delivery Date',
          enableSorting: sortingEnabled,
          cell: ({ row }) => formatDate(row.original.requestedDate),
        },
        {
          accessorKey: 'itemCount',
          header: 'Items',
          enableSorting: sortingEnabled,
          cell: ({ row }) => formatItems(row.original.itemCount),
        },
        {
          accessorKey: 'fulfilmentType',
          header: 'Fulfilment',
          enableSorting: false,
          cell: ({ row }) => formatFulfilment(row.original.fulfilmentType),
        },
        {
          accessorKey: 'deliveryLocation',
          header: 'Delivery Location',
          enableSorting: false,
          cell: ({ row }) => {
            const value = row.original.deliveryLocation ?? 'Not provided';
            return (
              <span className="block max-w-[240px] truncate" title={value}>
                {value}
              </span>
            );
          },
        },
        {
          accessorKey: 'status',
          header: 'Status',
          enableSorting: false,
          cell: ({ row }) => <QuotationStatus status={row.original.status} />,
        },
        {
          accessorKey: 'updatedAt',
          header: 'Updated',
          enableSorting: sortingEnabled,
          cell: ({ row }) => <UpdatedTime value={row.original.updatedAt} />,
        },
      ],
      [sortingEnabled],
    );

    const table = useReactTable({
      data,
      columns,
      state: { sorting: sortingEnabled ? sorting : emptySorting },
      enableSorting: sortingEnabled,
      onSortingChange,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });

    return (
      <>
        <div className="hidden md:block [&>div]:rounded-none [&>div]:border-0">
          <Table
            className="min-w-[1080px] table-fixed text-[14px]"
            aria-busy={loading}
          >
            <colgroup>
              <col className="w-[170px]" />
              <col className="w-[180px]" />
              <col className="w-[90px]" />
              <col className="w-[125px]" />
              <col className="w-[245px]" />
              <col className="w-[210px]" />
              <col className="w-[120px]" />
            </colgroup>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <Fragment key={headerGroup.id}>
                  <TableRow className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-10 whitespace-nowrap px-3 py-2 text-sm font-semibold normal-case tracking-normal text-[var(--customer-text-secondary)]"
                      >
                        {header.isPlaceholder ? null : (
                          <SortableHeader header={header} sortingEnabled={sortingEnabled} />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={`${header.id}-filter`} className="h-auto px-3 py-1.5">
                        {header.column.id === 'reference' ? (
                          <AsyncSearchableTomSelect
                            value={selectedReference}
                            searchText={referenceInput}
                            onType={onReferenceFilterChange}
                            onChange={onReferenceSelect}
                            loadOptions={loadReferenceOptions}
                            size="compact"
                            ariaLabel="Filter by RFQ reference"
                          />
                        ) : null}
                      </TableHead>
                    ))}
                  </TableRow>
                </Fragment>
              ))}
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="h-64 p-0">
                    <ErrorState onRetry={onRetry} />
                  </TableCell>
                </TableRow>
              ) : loading && data.length === 0 ? (
                <QuotationTableBodySkeleton />
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="h-[50px] text-[14px] text-[var(--customer-text)] hover:bg-[var(--customer-surface-secondary)]"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-3 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="h-72 p-0">
                    <EmptyState filtered={filtered} onReset={onReset} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="divide-y divide-[var(--customer-border)] md:hidden">
          {error ? (
            <ErrorState onRetry={onRetry} />
          ) : loading && data.length === 0 ? (
            <QuotationMobileSkeleton />
          ) : data.length > 0 ? (
            data.map((quotation) => <QuotationCard key={quotation.id} quotation={quotation} />)
          ) : (
            <EmptyState filtered={filtered} onReset={onReset} />
          )}
        </div>
      </>
    );
  }

  function SortableHeader({
    header,
    sortingEnabled,
  }: {
    header: Header<CustomerQuotationSummary, unknown>;
    sortingEnabled: boolean;
  }) {
    const canSort = header.column.getCanSort() && sortingEnabled;
    const sorted = header.column.getIsSorted();
    const label = flexRender(header.column.columnDef.header, header.getContext());

    if (!canSort) return <span>{label}</span>;

    return (
      <button
        type="button"
        onClick={header.column.getToggleSortingHandler()}
        className="inline-flex items-center gap-1.5 text-left transition hover:text-[var(--customer-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
        aria-label={`Sort by ${String(header.column.columnDef.header)}`}
      >
        {label}
        <span aria-hidden="true" className="text-[13px] text-[var(--customer-text-muted)]">
          {sorted === 'asc' ? 'Asc' : sorted === 'desc' ? 'Desc' : 'Sort'}
        </span>
      </button>
    );
  }

  function QuotationCard({ quotation }: { quotation: CustomerQuotationSummary }) {
    return (
      <article className="p-4">
        <Link
          to={`/customer/quotations/${quotation.id}`}
          className="text-[15px] font-medium text-[var(--customer-primary)] underline-offset-4 hover:text-[var(--customer-primary-hover)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
        >
          {quotation.reference ?? 'Reference pending'}
        </Link>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <MobileField label="Delivery Date" value={formatDate(quotation.requestedDate)} />
          <MobileField label="Items" value={formatItems(quotation.itemCount)} />
          <MobileField label="Fulfilment" value={formatFulfilment(quotation.fulfilmentType)} />
          <MobileField label="Updated" value={formatRelativeTime(quotation.updatedAt)} />
          <div className="col-span-2">
            <p className="text-sm text-[var(--customer-text-muted)]">Delivery Location</p>
            <p
              className="mt-1 truncate font-medium text-[var(--customer-text)]"
              title={quotation.deliveryLocation ?? undefined}
            >
              {quotation.deliveryLocation ?? 'Not provided'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-[var(--customer-text-muted)]">Status</p>
            <div className="mt-1">
              <QuotationStatus status={quotation.status} />
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
        className={`inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium ${presentation.text}`}
      >
        <span className={`h-2 w-2 rounded-full ${presentation.dot}`} aria-hidden="true" />
        {presentation.label}
      </span>
    );
  }

  function UpdatedTime({ value }: { value: string }) {
    const relative = formatRelativeTime(value);
    const exact = formatExactTimestamp(value);

    return (
      <span
        className="text-sm font-medium text-[var(--customer-text-muted)]"
        title={exact}
        tabIndex={0}
        aria-label={`Updated ${relative}. Exact timestamp ${exact}.`}
      >
        {relative}
      </span>
    );
  }

  function MobileField({ label, value }: { label: string; value: string }) {
    return (
      <div>
        <p className="text-sm text-[var(--customer-text-muted)]">{label}</p>
        <p className="mt-1 font-medium text-[var(--customer-text)]">{value}</p>
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
        className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--customer-border)] bg-[var(--customer-surface)] px-3 text-sm font-semibold text-[var(--customer-text-muted)] transition hover:border-[var(--customer-primary)] hover:text-[var(--customer-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {children}
      </button>
    );
  }

  function QuotationTableBodySkeleton() {
    return (
      <>
        {Array.from({ length: 6 }, (_, rowIndex) => (
          <TableRow key={rowIndex} className="h-[50px] hover:bg-transparent">
            {Array.from({ length: 7 }, (__, cellIndex) => (
              <TableCell key={cellIndex} className="px-3 py-3 align-middle">
                <div
                  className={`h-4 animate-pulse rounded bg-[var(--customer-surface-secondary)] ${
                    cellIndex === 2 ? 'w-12' : cellIndex === 5 ? 'w-32' : 'w-3/4'
                  }`}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </>
    );
  }

  function QuotationMobileSkeleton() {
    return (
      <div className="divide-y divide-[var(--customer-border)]" aria-label="Loading RFQs">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 px-4 py-4">
            <div className="h-4 w-36 animate-pulse rounded bg-[var(--customer-surface-secondary)]" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-4 animate-pulse rounded bg-[var(--customer-surface-secondary)]" />
              <div className="h-4 animate-pulse rounded bg-[var(--customer-surface-secondary)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
        <p className="text-base font-semibold text-[var(--customer-text)]">Unable to load RFQs.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 h-10 rounded-lg border border-[var(--customer-border)] px-4 text-sm font-semibold text-[var(--customer-primary)] hover:bg-[var(--customer-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
        >
          Retry
        </button>
      </div>
    );
  }

  function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--customer-primary-soft)] text-[var(--customer-primary)]">
          <FileText size={22} />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[var(--customer-text)]">
          {filtered ? 'No RFQs match your filters.' : 'No RFQs yet'}
        </h2>
        <p className="mt-1 max-w-md text-[15px] text-[var(--customer-text-muted)]">
          {filtered ? 'Clear filters to view all RFQ requests.' : 'Create your first Request for Quote.'}
        </p>
        {filtered ? (
          <button
            type="button"
            onClick={onReset}
            className="mt-4 text-sm font-semibold text-[var(--customer-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
          >
            Clear filters
          </button>
        ) : (
          <Link
            to="/customer/quotations/new"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--customer-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--customer-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
          >
            <Plus size={16} /> New RFQ
          </Link>
        )}
      </div>
    );
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

  function formatExactTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not provided';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  function formatRelativeTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not provided';

    const diffMs = Date.now() - date.getTime();
    const absMs = Math.abs(diffMs);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (absMs < minute) return 'Just now';
    if (absMs < hour) {
      const minutes = Math.round(absMs / minute);
      return diffMs >= 0 ? `${minutes} min ago` : `in ${minutes} min`;
    }
    if (absMs < day) {
      const hours = Math.round(absMs / hour);
      return diffMs >= 0
        ? `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
        : `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    if (absMs < 2 * day) return diffMs >= 0 ? 'Yesterday' : 'Tomorrow';

    const days = Math.round(absMs / day);
    return diffMs >= 0 ? `${days} days ago` : `in ${days} days`;
  }

  function formatItems(count: number) {
    return `${count} ${count === 1 ? 'Item' : 'Items'}`;
  }

  function formatFulfilment(value: CustomerQuotationSummary['fulfilmentType']) {
    return value === 'PICKUP' ? 'Pick-Up' : 'Delivery';
  }

  type RFQFilterValueKind = 'reference' | 'status' | 'fulfilment' | 'deliveryLocation' | 'date';

  interface RFQFilterDefinition {
    id: RFQFilterField;
    label: string;
    valueKind: RFQFilterValueKind;
    operators: RFQFilterOperator[];
  }

  const rfqFilterDefinitions: RFQFilterDefinition[] = [
    {
      id: 'reference',
      label: 'RFQ Reference',
      valueKind: 'reference',
      operators: ['contains'],
    },
    {
      id: 'status',
      label: 'Status',
      valueKind: 'status',
      operators: ['equals'],
    },
    {
      id: 'fulfilmentType',
      label: 'Fulfilment',
      valueKind: 'fulfilment',
      operators: ['equals'],
    },
    {
      id: 'deliveryLocation',
      label: 'Delivery Location',
      valueKind: 'deliveryLocation',
      operators: ['contains'],
    },
    {
      id: 'requestedDate',
      label: 'Delivery Date',
      valueKind: 'date',
      operators: ['equals'],
    },
  ];

  const rfqFilterOperatorLabels: Record<RFQFilterOperator, string> = {
    contains: 'Contains',
    equals: 'Is',
  };

  function getRFQFilterDefinition(field: RFQFilterField | '') {
    return rfqFilterDefinitions.find((definition) => definition.id === field) ?? null;
  }

  function validateRFQFilterRule(rule: RFQFilterRule) {
    const definition = getRFQFilterDefinition(rule.field);
    if (!definition) return 'Select a filter field.';
    if (!rule.operator || !definition.operators.includes(rule.operator)) {
      return 'Select a supported operator.';
    }
    if (!rule.value.trim()) return 'Enter or select a filter value.';
    return null;
  }

  function isCompleteRFQFilterRule(rule: RFQFilterRule) {
    return validateRFQFilterRule(rule) === null;
  }

  function cloneRFQFilterRule(rule: RFQFilterRule): RFQFilterRule {
    return {
      id: rule.id,
      field: rule.field,
      operator: rule.operator,
      value: rule.value,
    };
  }

  function rulesToFilters(rules: RFQFilterRule[]) {
    return rules.reduce<typeof initialFilters>((nextFilters, rule) => {
      if (!isCompleteRFQFilterRule(rule)) return nextFilters;
      const value = rule.value.trim();

      if (rule.field === 'reference' && rule.operator === 'contains') {
        nextFilters.reference = value;
      }
      if (rule.field === 'status' && rule.operator === 'equals') {
        nextFilters.status = value as QuotationStatus;
      }
      if (rule.field === 'fulfilmentType' && rule.operator === 'equals') {
        nextFilters.fulfilmentType = value as QuotationFulfilmentType;
      }
      if (rule.field === 'deliveryLocation' && rule.operator === 'contains') {
        nextFilters.deliveryLocation = value;
      }
      if (rule.field === 'requestedDate' && rule.operator === 'equals') {
        nextFilters.requestedDate = value;
      }

      return nextFilters;
    }, { ...initialFilters });
  }

  function filtersToRules(filters: typeof initialFilters) {
    const rules: RFQFilterRule[] = [];
    if (filters.reference) {
      rules.push({
        id: crypto.randomUUID(),
        field: 'reference',
        operator: 'contains',
        value: filters.reference,
      });
    }
    if (filters.status) {
      rules.push({
        id: crypto.randomUUID(),
        field: 'status',
        operator: 'equals',
        value: filters.status,
      });
    }
    if (filters.fulfilmentType) {
      rules.push({
        id: crypto.randomUUID(),
        field: 'fulfilmentType',
        operator: 'equals',
        value: filters.fulfilmentType,
      });
    }
    if (filters.deliveryLocation) {
      rules.push({
        id: crypto.randomUUID(),
        field: 'deliveryLocation',
        operator: 'contains',
        value: filters.deliveryLocation,
      });
    }
    if (filters.requestedDate) {
      rules.push({
        id: crypto.randomUUID(),
        field: 'requestedDate',
        operator: 'equals',
        value: filters.requestedDate,
      });
    }
    return rules;
  }

  function upsertReferenceRule(rules: RFQFilterRule[], value: string): RFQFilterRule[] {
    const reference = value.trim();
    const withoutReference = rules.filter((rule) => rule.field !== 'reference');
    if (!reference) return withoutReference;

    return [
      {
        id: rules.find((rule) => rule.field === 'reference')?.id ?? crypto.randomUUID(),
        field: 'reference',
        operator: 'contains',
        value: reference,
      },
      ...withoutReference,
    ];
  }

  function formatFilterChip(filterRule: RFQFilterRule, deliveryLocations: CustomerLocation[]) {
    const definition = getRFQFilterDefinition(filterRule.field);
    const fieldLabel = definition?.label ?? 'Filter';
    const operatorLabel = filterRule.operator
      ? rfqFilterOperatorLabels[filterRule.operator]
      : '';
    const valueLabel = formatRFQFilterValue(filterRule, deliveryLocations);

    if (filterRule.operator === 'equals') return `${fieldLabel}: ${valueLabel}`;
    return [fieldLabel, operatorLabel, valueLabel].filter(Boolean).join(' ');
  }

  function formatRFQFilterValue(filterRule: RFQFilterRule, deliveryLocations: CustomerLocation[]) {
    if (filterRule.field === 'status') {
      return statusPresentation[filterRule.value as QuotationStatus]?.label ?? filterRule.value;
    }
    if (filterRule.field === 'fulfilmentType') {
      return filterRule.value === 'PICKUP' ? 'Pick-Up' : 'Delivery';
    }
    if (filterRule.field === 'requestedDate') {
      return formatDate(filterRule.value);
    }
    if (filterRule.field === 'deliveryLocation') {
      const location = deliveryLocations.find((item) => item.name === filterRule.value);
      return formatCustomerLocation(location) || filterRule.value;
    }
    return filterRule.value;
  }

  const statusPresentation: Record<QuotationStatus, { label: string; dot: string; text: string }> = {
    DRAFT: {
      label: 'Draft',
      dot: 'bg-slate-400',
      text: 'text-[var(--customer-text-muted)]',
    },
    PENDING_SALES_REVIEW: {
      label: 'Pending Sales Review',
      dot: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-300',
    },
    UNDER_REVIEW: {
      label: 'Under Review',
      dot: 'bg-blue-600',
      text: 'text-blue-700 dark:text-blue-300',
    },
    PENDING_HADER_APPROVAL: {
      label: 'Pending Hader Approval',
      dot: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-300',
    },
    PENDING_PRICE_APPROVAL: {
      label: 'Pending Price Approval',
      dot: 'bg-orange-500',
      text: 'text-orange-700 dark:text-orange-300',
    },
    READY_FOR_CUSTOMER: {
      label: 'Ready for Customer',
      dot: 'bg-[var(--customer-primary)]',
      text: 'text-[var(--customer-primary)]',
    },
    ACCEPTED: {
      label: 'Accepted',
      dot: 'bg-emerald-600',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
    REJECTED: {
      label: 'Rejected',
      dot: 'bg-red-600',
      text: 'text-red-700 dark:text-red-300',
    },
    CLARIFICATION_REQUESTED: {
      label: 'Changes Requested',
      dot: 'bg-orange-500',
      text: 'text-orange-700 dark:text-orange-300',
    },
  };

  const quotationStatusOptions: SearchableSelectOption[] = Object.entries(statusPresentation).map(
    ([value, presentation]) => ({
      value,
      label: presentation.label,
    }),
  );

  const quotationFulfilmentOptions: SearchableSelectOption[] = [
    { value: 'DELIVERY', label: 'Delivery' },
    { value: 'PICKUP', label: 'Pick-Up' },
  ];

  function getSharedRFQFilterDefinitions(
    deliveryLocations: CustomerLocation[],
  ): QueryFilterDefinition<RFQFilterField, RFQFilterOperator>[] {
    const locationOptions = deliveryLocations.map((location) => ({
      value: location.name,
      label: formatCustomerLocation(location) || location.name,
    }));

    return rfqFilterDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      valueKind:
        definition.valueKind === 'reference'
          ? 'custom'
          : definition.valueKind === 'date'
            ? 'date'
            : 'select',
      operators: definition.operators.map((operator) => ({
        value: operator,
        label: rfqFilterOperatorLabels[operator],
      })),
      ...(definition.valueKind === 'status'
        ? { valueOptions: quotationStatusOptions }
        : definition.valueKind === 'fulfilment'
          ? { valueOptions: quotationFulfilmentOptions }
          : definition.valueKind === 'deliveryLocation'
            ? { valueOptions: locationOptions }
            : {}),
    }));
  }

  function formatCustomerLocation(location: CustomerLocation | undefined) {
    if (!location) return '';
    return [location.name, location.city, location.region].filter(Boolean).join(' - ');
  }
