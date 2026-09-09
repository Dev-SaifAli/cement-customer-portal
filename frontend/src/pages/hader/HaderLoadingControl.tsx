import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  BellRing,
  CircleCheck,
  Clock3,
  Factory,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { DocumentReference } from '../../components/customer-detail/DocumentReference';
import { ProductDisplay } from '../../components/customer-detail/ProductDisplay';
import { DataTableColumnsMenu } from '../../components/customer-list/DataTableColumnsMenu';
import { NavigableTableRow } from '../../components/customer-list/NavigableTableRow';
import {
  QueryFilterBuilder,
  QueryFilterChips,
  type QueryFilterDefinition,
  type QueryFilterRule,
} from '../../components/customer-list/QueryFilterBuilder';
import { HaderStatusBadge, formatHaderStatus } from '../../components/hader/HaderStatusBadge';
import { DataTableSearchInput } from '../../components/list/DataTableSearchInput';
import { DataTableToolbar } from '../../components/list/DataTableToolbar';
import { ListPageHeader } from '../../components/list/ListPageHeader';
import { ServerPagination } from '../../components/list/ServerPagination';
import { TableLoadingRows, TableMessageRow } from '../../components/list/TableState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/shadcn';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  listLoadingControl,
  type InternalPagination,
  type LoadingBoardItem,
} from '../../services/haderDeliveryService';
import { isAbortError } from '../../utils/abort';
import { formatTonQuantity } from '../../utils/quantity';

type LoadingStatusValue = LoadingBoardItem['loadingStatus'];
type FilterField = 'status' | 'productId';
type FilterOperator = 'equals';
type FilterRule = QueryFilterRule<FilterField, FilterOperator>;

const emptyPagination: InternalPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const emptyCounters = { waiting: 0, notified: 0, atGate: 0, loading: 0, completed: 0 };
const equalsOperator = [{ value: 'equals' as const, label: 'Is' }];
const loadingStatuses: LoadingStatusValue[] = [
  'WAITING',
  'NOTIFIED',
  'AT_GATE',
  'LOADING',
  'LOADED',
];
const columnLabels: Record<string, string> = {
  queue: 'Queue Position',
  shipment: 'Shipment',
  order: 'Order',
  customer: 'Customer',
  product: 'Product',
  quantity: 'Quantity',
  truck: 'Truck',
  driver: 'Driver',
  status: 'Status',
  loadingPoint: 'Loading Point',
  arrivalTime: 'Arrival Time',
  action: 'Action',
};

export function HaderLoadingControl() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LoadingBoardItem[]>([]);
  const [pagination, setPagination] = useState<InternalPagination>(emptyPagination);
  const [counters, setCounters] = useState(emptyCounters);
  const [products, setProducts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [query, setQuery] = useState({ page: 1, search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [appliedRules, setAppliedRules] = useState<FilterRule[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    driver: false,
    loadingPoint: false,
    arrivalTime: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearchInput = useDebouncedValue(searchInput);
  const filters = useMemo(() => rulesToFilters(appliedRules), [appliedRules]);

  useEffect(() => {
    const search = debouncedSearchInput.trim();
    setQuery((current) => (current.search === search ? current : { page: 1, search }));
  }, [debouncedSearchInput]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void listLoadingControl({
      page: query.page,
      search: query.search,
      status: filters.status,
      productId: filters.productId,
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setItems(data.items);
        setPagination(data.pagination);
        setCounters(data.counters);
        setProducts(data.products);
      })
      .catch((cause) => {
        if (!isAbortError(cause)) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters.productId, filters.status, query, reloadKey]);

  const definitions = useMemo<QueryFilterDefinition<FilterField, FilterOperator>[]>(
    () => [
      selectDefinition(
        'status',
        'Status',
        loadingStatuses.map((status) => ({ value: status, label: formatHaderStatus(status) })),
      ),
      selectDefinition(
        'productId',
        'Product',
        products.map((product) => ({
          value: product.id,
          label: `${product.name} - ${product.code}`,
        })),
      ),
    ],
    [products],
  );

  const columns = useMemo<ColumnDef<LoadingBoardItem>[]>(
    () => [
      {
        id: 'queue',
        header: 'Queue Position',
        size: 90,
        enableHiding: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold">
            {row.original.queuePosition ?? 'Waiting'}
          </span>
        ),
      },
      {
        id: 'shipment',
        header: 'Shipment',
        size: 165,
        enableHiding: false,
        cell: ({ row }) => (
          <DocumentReference
            reference={row.original.shipmentNumber}
            entityId={row.original.id}
            routeBase="/hader/loading-control"
            nowrap
          />
        ),
      },
      {
        id: 'order',
        header: 'Order',
        size: 155,
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.orderNumber}</span>,
      },
      {
        id: 'customer',
        header: 'Customer',
        size: 190,
        cell: ({ row }) => (
          <span className="block truncate font-medium" title={row.original.customer}>
            {row.original.customer}
          </span>
        ),
      },
      {
        id: 'product',
        header: 'Product',
        size: 205,
        cell: ({ row }) => (
          <ProductDisplay
            name={row.original.product.name}
            code={row.original.product.code}
            compact
          />
        ),
      },
      {
        id: 'quantity',
        header: 'Quantity',
        size: 120,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold">
            {formatTonQuantity(row.original.quantityTon)}
          </span>
        ),
      },
      {
        id: 'truck',
        header: 'Truck',
        size: 145,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.truck ?? 'Unassigned'}</span>
        ),
      },
      {
        id: 'driver',
        header: 'Driver',
        size: 175,
        cell: ({ row }) => row.original.driver ?? 'Unassigned',
      },
      {
        id: 'status',
        header: 'Status',
        size: 125,
        enableHiding: false,
        cell: ({ row }) => <HaderStatusBadge status={row.original.loadingStatus} />,
      },
      {
        id: 'loadingPoint',
        header: 'Loading Point',
        size: 170,
        cell: ({ row }) => row.original.loadingPoint?.name ?? 'Unassigned',
      },
      {
        id: 'arrivalTime',
        header: 'Arrival Time',
        size: 125,
        cell: ({ row }) => <ArrivalTime value={row.original.arrivedAt} />,
      },
      {
        id: 'action',
        header: 'Action',
        size: 105,
        enableHiding: false,
        cell: ({ row }) => (
          <DocumentReference
            reference="Manage"
            entityId={row.original.id}
            routeBase="/hader/loading-control"
            ariaLabel={`Manage shipment ${row.original.shipmentNumber}`}
            nowrap
          />
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const applyRules = (rules: FilterRule[]) => {
    setAppliedRules(rules);
    setQuery((current) => ({ ...current, page: 1 }));
  };
  const selectStatus = (status: LoadingStatusValue) => {
    const withoutStatus = appliedRules.filter((rule) => rule.field !== 'status');
    applyRules(
      filters.status === status
        ? withoutStatus
        : [
            ...withoutStatus,
            { id: crypto.randomUUID(), field: 'status', operator: 'equals', value: status },
          ],
    );
  };

  return (
    <div className="space-y-5">
      <ListPageHeader rootLabel="Home" rootTo="/hader" title="Loading Control" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {statusCards(counters).map((card) => (
          <StatusSummaryCard
            key={card.status}
            {...card}
            active={filters.status === card.status}
            onClick={() => selectStatus(card.status)}
          />
        ))}
      </div>

      <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
        <DataTableToolbar
          search={
            <DataTableSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search shipment, order, customer or truck"
              ariaLabel="Search Loading Control"
            />
          }
          actions={
            <>
              <QueryFilterBuilder
                appliedRules={appliedRules}
                definitions={definitions}
                ariaLabel="Loading Control filters"
                onApply={applyRules}
                onClear={() => applyRules([])}
              />
              <DataTableColumnsMenu table={table} labels={columnLabels} />
            </>
          }
        />
        <QueryFilterChips
          rules={appliedRules}
          formatRule={(rule) => formatFilterRule(rule, definitions)}
          onRemove={(id) => applyRules(appliedRules.filter((rule) => rule.id !== id))}
          onClear={() => applyRules([])}
        />

        <div className="[&>div]:rounded-none [&>div]:border-0">
          <Table className="min-w-[1080px] table-fixed" aria-busy={loading}>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="whitespace-nowrap normal-case tracking-normal"
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
              {error ? (
                <TableMessageRow
                  colSpan={visibleColumnCount}
                  message="Unable to load Loading Control."
                  actionLabel="Retry"
                  onAction={() => setReloadKey((value) => value + 1)}
                />
              ) : loading && items.length === 0 ? (
                <TableLoadingRows columns={visibleColumnCount} />
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <NavigableTableRow
                    key={row.id}
                    label={`Manage shipment ${row.original.shipmentNumber}`}
                    onNavigate={() => navigate(`/hader/loading-control/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="min-w-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </NavigableTableRow>
                ))
              ) : (
                <TableMessageRow
                  colSpan={visibleColumnCount}
                  message="No shipments match the current search and filters."
                />
              )}
            </TableBody>
          </Table>
        </div>
        <ServerPagination
          {...pagination}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          itemLabel="shipments"
        />
      </section>
    </div>
  );
}

function StatusSummaryCard({
  label,
  count,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: LucideIcon;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-w-0 rounded-md border bg-gradient-to-br p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)] ${tone} ${
        active
          ? 'ring-2 ring-[var(--customer-primary)] ring-offset-1 ring-offset-[var(--customer-bg)]'
          : ''
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[var(--customer-text)]">
            {label}
          </span>
          <span className="mt-1 block text-2xl font-bold leading-none text-[var(--customer-text)]">
            {count}
          </span>
          <span className="mt-1 block text-xs text-[var(--customer-text-muted)]">Shipments</span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-current/15 bg-[var(--customer-surface)]/70">
          <Icon size={17} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

function statusCards(counters: typeof emptyCounters) {
  return [
    {
      status: 'WAITING' as const,
      label: 'Waiting',
      count: counters.waiting,
      icon: Clock3,
      tone: 'border-slate-300 from-slate-100/70 to-[var(--customer-surface)] text-slate-600 dark:border-slate-700 dark:from-slate-800/40 dark:text-slate-300',
    },
    {
      status: 'NOTIFIED' as const,
      label: 'Notified',
      count: counters.notified,
      icon: BellRing,
      tone: 'border-blue-200 from-blue-50/80 to-[var(--customer-surface)] text-blue-700 dark:border-blue-900 dark:from-blue-950/30 dark:text-blue-300',
    },
    {
      status: 'AT_GATE' as const,
      label: 'At Gate',
      count: counters.atGate,
      icon: MapPin,
      tone: 'border-violet-200 from-violet-50/80 to-[var(--customer-surface)] text-violet-700 dark:border-violet-900 dark:from-violet-950/30 dark:text-violet-300',
    },
    {
      status: 'LOADING' as const,
      label: 'Loading',
      count: counters.loading,
      icon: Factory,
      tone: 'border-amber-200 from-amber-50/80 to-[var(--customer-surface)] text-amber-700 dark:border-amber-900 dark:from-amber-950/30 dark:text-amber-300',
    },
    {
      status: 'LOADED' as const,
      label: 'Completed',
      count: counters.completed,
      icon: CircleCheck,
      tone: 'border-emerald-200 from-emerald-50/80 to-[var(--customer-surface)] text-emerald-700 dark:border-emerald-900 dark:from-emerald-950/30 dark:text-emerald-300',
    },
  ];
}

function selectDefinition(
  id: FilterField,
  label: string,
  valueOptions: Array<{ value: string; label: string }>,
): QueryFilterDefinition<FilterField, FilterOperator> {
  return { id, label, operators: equalsOperator, valueKind: 'select', valueOptions };
}

function rulesToFilters(rules: FilterRule[]) {
  const value = (field: FilterField) =>
    rules.find((rule) => rule.field === field)?.value || undefined;
  return { status: value('status'), productId: value('productId') };
}

function formatFilterRule(
  rule: FilterRule,
  definitions: QueryFilterDefinition<FilterField, FilterOperator>[],
) {
  const definition = definitions.find((item) => item.id === rule.field);
  const option = definition?.valueOptions?.find((item) => item.value === rule.value);
  return `${definition?.label ?? 'Filter'}: ${option?.label ?? rule.value}`;
}

function ArrivalTime({ value }: { value: string | null }) {
  if (!value) return <span className="whitespace-nowrap">Not arrived</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="whitespace-nowrap">Not arrived</span>;
  return (
    <span className="whitespace-nowrap">
      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

export function LoadingStatus({ value }: { value: string }) {
  return <HaderStatusBadge status={value} />;
}
