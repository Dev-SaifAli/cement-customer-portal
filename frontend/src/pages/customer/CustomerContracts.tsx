import {
  Badge,
  Button,
  Input,
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/shadcn';
import { CustomerListPageHeader } from '../../components/customer-list/CustomerListPageHeader';
import { DataTableColumnsMenu } from '../../components/customer-list/DataTableColumnsMenu';
import { NavigableTableRow } from '../../components/customer-list/NavigableTableRow';
import { LocationCityDisplay, getShipToCity } from '../../components/list/LocationCityDisplay';
import { TrackingQrCell } from '../../components/list/TrackingQrCell';
import {
  QueryFilterBuilder,
  QueryFilterChips,
  type QueryFilterDefinition,
  type QueryFilterRule,
} from '../../components/customer-list/QueryFilterBuilder';
import { BriefcaseBusiness, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  listCustomerContracts,
  type CustomerContractSummary,
  type CustomerContractsList,
} from '../../services/customerContractsService';
import { formatCommercialTonValue } from '../../utils/commercialQuantity';

const emptyContracts: CustomerContractsList = {
  items: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
};

const columnLabels: Record<string, string> = {
  tracking: 'QR',
  reference: 'Contract',
  source: 'Source',
  product: 'Product',
  packaging: 'Packaging',
  fulfilment: 'Fulfilment',
  haderCity: 'Hader City',
  shipToCity: 'Ship-to City',
  orderCount: 'Orders',
  totalQuantityTons: 'Total Tons',
  remainingQuantityTons: 'Remaining Tons',
  startDate: 'Start Date',
  endDate: 'End Date',
  status: 'Status',
  customerRate: 'Customer Rate / Ton',
};

type ContractFilterField = 'product' | 'date';
type ContractFilterOperator = 'contains' | 'equals';

type ContractFilterRule = QueryFilterRule<ContractFilterField, ContractFilterOperator>;

export function CustomerContracts() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<CustomerContractsList>(emptyContracts);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [appliedRules, setAppliedRules] = useState<ContractFilterRule[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const serverFilters = useMemo(() => rulesToServerFilters(appliedRules), [appliedRules]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void listCustomerContracts({
      page: pagination.pageIndex + 1,
      ...(search ? { search } : {}),
      ...(serverFilters.product ? { product: serverFilters.product } : {}),
      ...(serverFilters.date ? { date: serverFilters.date } : {}),
    })
      .then((data) => {
        if (!cancelled) setContracts(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pagination.pageIndex, reloadKey, search, serverFilters.date, serverFilters.product]);

  const columns = useMemo<ColumnDef<CustomerContractSummary>[]>(
    () => [
      {
        id: 'tracking',
        header: 'QR',
        size: 58,
        enableHiding: false,
        cell: ({ row }) => (
          <TrackingQrCell
            documentType="CONTRACT"
            reference={row.original.reference}
            viewTo={`/customer/contracts/${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: 'reference',
        header: 'Contract',
        size: 145,
        enableHiding: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold text-[var(--customer-primary)]">
            {row.original.reference ?? 'Unavailable'}
          </span>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        size: 155,
        cell: ({ row }) => <ContractSource contract={row.original} />,
      },
      {
        id: 'product',
        header: 'Product',
        size: 285,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p
              className="truncate whitespace-nowrap font-semibold text-[var(--customer-text)]"
              title={row.original.productName ?? undefined}
            >
              {row.original.productName ?? 'Unavailable'}
            </p>
            <p className="mt-0.5 truncate whitespace-nowrap text-xs text-[var(--customer-text-muted)]">
              {row.original.productCode ?? 'Code unavailable'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'packaging',
        header: 'Packaging',
        size: 120,
        cell: ({ getValue }) => <span className="whitespace-nowrap">{String(getValue())}</span>,
      },
      {
        accessorKey: 'fulfilment',
        header: 'Fulfilment',
        size: 145,
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">{formatFulfilment(String(getValue()))}</span>
        ),
      },
      {
        id: 'haderCity',
        header: 'Hader City',
        size: 140,
        cell: ({ row }) => <LocationCityDisplay city={row.original.fulfilment === 'DELIVERY' ? row.original.haderCity : null} />,
      },
      {
        id: 'shipToCity',
        header: 'Ship-to City',
        size: 145,
        cell: ({ row }) => <LocationCityDisplay city={getShipToCity(row.original)} />,
      },
      {
        accessorKey: 'orderCount',
        header: 'Orders',
        size: 90,
        cell: ({ getValue }) => <span className="tabular-nums">{Number(getValue())}</span>,
      },
      {
        accessorKey: 'totalQuantityTons',
        header: 'Total Tons',
        size: 125,
        cell: ({ getValue }) => <span className="tabular-nums">{formatCommercialTonValue(Number(getValue()))}</span>,
      },
      {
        accessorKey: 'remainingQuantityTons',
        header: 'Remaining Tons',
        size: 155,
        enableHiding: false,
        cell: ({ getValue }) => (
          <span className="font-semibold tabular-nums text-[var(--customer-text)]">
            {formatCommercialTonValue(Number(getValue()))}
          </span>
        ),
      },
      {
        accessorKey: 'startDate',
        header: 'Start Date',
        size: 150,
        cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(String(getValue()))}</span>,
      },
      {
        accessorKey: 'endDate',
        header: 'End Date',
        size: 140,
        cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(String(getValue()))}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 115,
        enableHiding: false,
        cell: () => (
          <Badge variant="success" className="gap-1.5 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            Active
          </Badge>
        ),
      },
      {
        accessorKey: 'customerRate',
        header: 'Customer Rate / Ton',
        size: 185,
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap font-semibold tabular-nums">
            {formatMoney(Number(getValue()))}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: contracts.items,
    columns,
    state: { columnVisibility, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: contracts.pagination.totalPages,
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const showingFrom = contracts.pagination.total === 0
    ? 0
    : (contracts.pagination.page - 1) * contracts.pagination.pageSize + 1;
  const showingTo = Math.min(
    contracts.pagination.page * contracts.pagination.pageSize,
    contracts.pagination.total,
  );
  const pageNumbers = getVisiblePages(pagination.pageIndex + 1, contracts.pagination.totalPages);
  const hasActiveQuery = Boolean(search.trim()) || appliedRules.length > 0;

  const openContract = (contract: CustomerContractSummary) => {
    navigate(`/customer/contracts/${contract.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <CustomerListPageHeader title="Contracts" />

      <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--customer-border)] px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <p className="whitespace-nowrap text-base font-semibold text-[var(--customer-text)]">
            {contracts.pagination.total} {contracts.pagination.total === 1 ? 'Contract' : 'Contracts'}
          </p>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <label className="relative min-w-0 flex-1 lg:w-80 lg:flex-none">
              <span className="sr-only">Search contracts or products</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--customer-text-muted)]"
                size={16}
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  table.setPageIndex(0);
                }}
                placeholder="Search contract or product"
                className="pl-9"
              />
            </label>
            <QueryFilterBuilder
              appliedRules={appliedRules}
              definitions={filterDefinitions}
              ariaLabel="Contract filters"
              onApply={(rules) => {
                setAppliedRules(rules);
                table.setPageIndex(0);
              }}
              onClear={() => {
                setAppliedRules([]);
                table.setPageIndex(0);
              }}
            />
            <DataTableColumnsMenu table={table} labels={columnLabels} />
          </div>
        </div>

        <QueryFilterChips
          rules={appliedRules}
          formatRule={formatFilterRule}
          onRemove={(id) => {
            setAppliedRules((current) => current.filter((rule) => rule.id !== id));
            table.setPageIndex(0);
          }}
          onClear={() => {
            setAppliedRules([]);
            table.setPageIndex(0);
          }}
        />

        <div className="[&>div]:rounded-none [&>div]:border-0">
          <Table className="min-w-[2020px] table-fixed text-[14px]" aria-busy={loading}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-11 whitespace-nowrap px-3 text-sm font-semibold normal-case tracking-normal text-[var(--customer-text-secondary)]"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <ContractTableSkeleton columnCount={visibleColumnCount} />
              ) : error ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={visibleColumnCount} className="h-64 p-0 text-center">
                    <p className="font-semibold text-[var(--customer-text)]">Unable to load contracts.</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setReloadKey((current) => current + 1)}
                    >
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <NavigableTableRow
                    key={row.id}
                    label={`Open contract ${row.original.reference ?? ''}`}
                    className="h-[58px] text-[var(--customer-text)]"
                    onNavigate={() => openContract(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="overflow-hidden px-3 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </NavigableTableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={visibleColumnCount} className="h-64 p-0">
                    <div className="flex flex-col items-center justify-center px-4 text-center">
                      <BriefcaseBusiness size={30} className="text-[var(--customer-text-muted)]" />
                      <p className="mt-3 font-semibold text-[var(--customer-text)]">
                        {hasActiveQuery ? 'No contracts match your filters.' : 'No contracts found.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && !error && contracts.pagination.total > 0 && (
          <footer className="flex flex-col gap-3 border-t border-[var(--customer-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-[var(--customer-text-muted)]">
              Showing {showingFrom}-{showingTo} of {contracts.pagination.total}
            </p>
            <Pagination className="mx-0 w-auto justify-start sm:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => table.previousPage()}
                  />
                </PaginationItem>
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationButton
                      type="button"
                      isActive={pageNumber === pagination.pageIndex + 1}
                      onClick={() => table.setPageIndex(pageNumber - 1)}
                    >
                      {pageNumber}
                    </PaginationButton>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    disabled={!table.getCanNextPage()}
                    onClick={() => table.nextPage()}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </footer>
        )}
      </section>
    </div>
  );
}

function ContractSource({ contract }: { contract: CustomerContractSummary }) {
  const source = contract.sourceDocument;
  if (!source) return <span className="text-[var(--customer-text-muted)]">&mdash;</span>;

  return (
    <div className="whitespace-nowrap">
      <p className="font-medium text-[var(--customer-text)]">{source.number ?? 'Unavailable'}</p>
      <p className="mt-0.5 text-xs text-[var(--customer-text-muted)]">
        {source.type === 'DIRECT_ORDER' ? 'Direct Order' : 'RFQ'}
      </p>
    </div>
  );
}

function ContractTableSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, rowIndex) => (
        <TableRow key={rowIndex} className="h-[58px] hover:bg-transparent">
          {Array.from({ length: columnCount }, (__, cellIndex) => (
            <TableCell key={cellIndex} className="px-3 py-2.5">
              <div
                className={`h-4 animate-pulse rounded bg-[var(--customer-surface-secondary)] ${
                  cellIndex === 2 ? 'w-5/6' : 'w-2/3'
                }`}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

const filterDefinitions: QueryFilterDefinition<ContractFilterField, ContractFilterOperator>[] = [
  {
    id: 'product',
    label: 'Product',
    valueKind: 'text',
    operators: [{ value: 'contains', label: 'Contains' }],
  },
  {
    id: 'date',
    label: 'Active On',
    valueKind: 'date',
    operators: [{ value: 'equals', label: 'Is' }],
  },
];

const operatorLabels: Record<ContractFilterOperator, string> = {
  contains: 'Contains',
  equals: 'Is',
};

function getFilterDefinition(field: ContractFilterField | '') {
  return filterDefinitions.find((definition) => definition.id === field) ?? null;
}

function isCompleteFilterRule(rule: ContractFilterRule) {
  const definition = getFilterDefinition(rule.field);
  return Boolean(
    definition &&
      rule.operator &&
      definition.operators.some((operator) => operator.value === rule.operator) &&
      rule.value.trim(),
  );
}

function rulesToServerFilters(rules: ContractFilterRule[]) {
  return rules.reduce<{ product?: string; date?: string }>((filters, rule) => {
    if (!isCompleteFilterRule(rule)) return filters;
    if (rule.field === 'product') filters.product = rule.value.trim();
    if (rule.field === 'date') filters.date = rule.value;
    return filters;
  }, {});
}

function formatFilterRule(rule: ContractFilterRule) {
  const label = getFilterDefinition(rule.field)?.label ?? 'Filter';
  return `${label} ${rule.operator ? operatorLabels[rule.operator] : ''} ${rule.value}`.trim();
}

function getVisiblePages(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function formatFulfilment(value: string) {
  if (value === 'DELIVERY') return 'Hader Delivery';
  if (value === 'PICKUP') return 'Pick-Up';
  return value;
}

function formatMoney(value?: number | null) {
  return value == null || !Number.isFinite(value)
    ? 'Not provided'
    : `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not provided';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
