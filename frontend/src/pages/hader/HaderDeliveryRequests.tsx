import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table';
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
import { EmptyValue } from '../../components/list/EmptyValue';
import { ListPageHeader } from '../../components/list/ListPageHeader';
import { ServerPagination } from '../../components/list/ServerPagination';
import { StatusBadge } from '../../components/list/StatusBadge';
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
  getDispatchFilters,
  listDeliveryRequests,
  type DeliveryRequest,
  type DeliveryRequestStatus,
  type InternalPagination,
} from '../../services/haderDeliveryService';
import { formatTonQuantity } from '../../utils/quantity';
import { isAbortError } from '../../utils/abort';

type FilterField = 'status' | 'haderCityId' | 'requestedDate' | 'productId';
type FilterOperator = 'equals';
type FilterRule = QueryFilterRule<FilterField, FilterOperator>;

const emptyPagination: InternalPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const statuses: DeliveryRequestStatus[] = [
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CONVERTED_TO_SHIPMENT',
];
const columnLabels: Record<string, string> = {
  request: 'Request',
  order: 'Order',
  customer: 'Customer',
  product: 'Product',
  quantity: 'Quantity',
  requestedDate: 'Requested Date',
  status: 'Status',
  contract: 'Contract',
  haderCity: 'Hader City',
  boundary: 'Boundary',
  shipTo: 'Ship-to',
};

export function HaderDeliveryRequests() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DeliveryRequest[]>([]);
  const [pagination, setPagination] = useState<InternalPagination>(emptyPagination);
  const [query, setQuery] = useState({ page: 1, search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [appliedRules, setAppliedRules] = useState<FilterRule[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    contract: false,
    haderCity: false,
    boundary: false,
    shipTo: false,
  });
  const [filterOptions, setFilterOptions] = useState<{
    cities: { id: string; name: string }[];
    products: { id: string; code: string; name: string }[];
  }>({ cities: [], products: [] });
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
    void listDeliveryRequests({
      page: query.page,
      search: query.search,
      status: filters.status,
      haderCityId: filters.haderCityId,
      requestedDate: filters.requestedDate,
      productId: filters.productId,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setItems(result.items);
        setPagination(result.pagination);
      })
      .catch((cause) => {
        if (!isAbortError(cause)) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    filters.haderCityId,
    filters.productId,
    filters.requestedDate,
    filters.status,
    query,
    reloadKey,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    void getDispatchFilters(controller.signal)
      .then(setFilterOptions)
      .catch((cause) => {
        if (!isAbortError(cause)) setFilterOptions({ cities: [], products: [] });
      });
    return () => controller.abort();
  }, []);

  const definitions = useMemo<QueryFilterDefinition<FilterField, FilterOperator>[]>(
    () => [
      selectDefinition(
        'status',
        'Status',
        statuses.map((status) => ({ value: status, label: formatHaderStatus(status) })),
      ),
      selectDefinition(
        'haderCityId',
        'Hader City',
        filterOptions.cities.map((city) => ({ value: city.id, label: city.name })),
      ),
      {
        id: 'requestedDate',
        label: 'Requested Date',
        operators: equalsOperator,
        valueKind: 'date',
      },
      selectDefinition(
        'productId',
        'Product',
        filterOptions.products.map((product) => ({
          value: product.id,
          label: `${product.name} - ${product.code}`,
        })),
      ),
    ],
    [filterOptions],
  );

  const columns = useMemo<ColumnDef<DeliveryRequest>[]>(
    () => [
      {
        id: 'request',
        header: 'Request',
        size: 155,
        enableHiding: false,
        cell: ({ row }) => (
          <DocumentReference
            reference={row.original.requestNumber}
            entityId={row.original.id}
            routeBase="/hader/delivery-requests"
            nowrap
          />
        ),
      },
      {
        id: 'order',
        header: 'Order',
        size: 170,
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.order.number}</span>,
      },
      {
        id: 'customer',
        header: 'Customer',
        size: 210,
        cell: ({ row }) => (
          <span className="block truncate font-medium" title={row.original.customer.companyName}>
            {row.original.customer.companyName}
          </span>
        ),
      },
      {
        id: 'product',
        header: 'Product',
        size: 220,
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
        size: 125,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold">
            {formatTonQuantity(row.original.quantityTon)}
          </span>
        ),
      },
      {
        id: 'requestedDate',
        header: 'Requested Date',
        size: 140,
        cell: ({ row }) => <DateValue value={row.original.requestedDate} />,
      },
      {
        id: 'status',
        header: 'Status',
        size: 180,
        enableHiding: false,
        cell: ({ row }) => <HaderStatusBadge status={row.original.status} />,
      },
      {
        id: 'contract',
        header: 'Contract',
        size: 160,
        cell: ({ row }) =>
          row.original.contract?.reference ? (
            <span className="whitespace-nowrap">{row.original.contract.reference}</span>
          ) : (
            <EmptyValue />
          ),
      },
      {
        id: 'haderCity',
        header: 'Hader City',
        size: 180,
        cell: ({ row }) => row.original.haderCity.name || <EmptyValue />,
      },
      {
        id: 'boundary',
        header: 'Boundary',
        size: 145,
        cell: ({ row }) =>
          row.original.haderZoneStatus ? (
            <StatusBadge
              label={
                row.original.haderZoneStatus === 'WITHIN_HADER_ZONE'
                  ? 'Within Zone'
                  : 'Outside Zone'
              }
              tone={
                row.original.haderZoneStatus === 'WITHIN_HADER_ZONE' ? 'success' : 'destructive'
              }
            />
          ) : (
            <StatusBadge label="Not evaluated" tone="secondary" />
          ),
      },
      {
        id: 'shipTo',
        header: 'Ship-to',
        size: 220,
        cell: ({ row }) => {
          const value = shipToName(row.original.shipTo);
          return value ? (
            <span className="block truncate" title={value}>
              {value}
            </span>
          ) : (
            <EmptyValue />
          );
        },
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

  return (
    <div className="space-y-5">
      <ListPageHeader rootLabel="Home" rootTo="/hader" title="Delivery Requests" />
      <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
        <DataTableToolbar
          search={
            <DataTableSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search request, order, customer or product"
              ariaLabel="Search delivery requests"
            />
          }
          actions={
            <>
              <QueryFilterBuilder
                appliedRules={appliedRules}
                definitions={definitions}
                ariaLabel="Delivery request filters"
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
          <Table className="min-w-[900px] table-fixed" aria-busy={loading}>
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
                  message="Unable to load delivery requests."
                  actionLabel="Retry"
                  onAction={() => setReloadKey((value) => value + 1)}
                />
              ) : loading && items.length === 0 ? (
                <TableLoadingRows columns={visibleColumnCount} />
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <NavigableTableRow
                    key={row.id}
                    label={`Open delivery request ${row.original.requestNumber}`}
                    onNavigate={() => navigate(`/hader/delivery-requests/${row.original.id}`)}
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
                  message="No delivery requests match the current search and filters."
                />
              )}
            </TableBody>
          </Table>
        </div>
        <ServerPagination
          {...pagination}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          itemLabel="requests"
        />
      </section>
    </div>
  );
}

const equalsOperator = [{ value: 'equals' as const, label: 'Is' }];
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
  return {
    status: value('status'),
    haderCityId: value('haderCityId'),
    requestedDate: value('requestedDate'),
    productId: value('productId'),
  };
}
function formatFilterRule(
  rule: FilterRule,
  definitions: QueryFilterDefinition<FilterField, FilterOperator>[],
) {
  const definition = definitions.find((item) => item.id === rule.field);
  const option = definition?.valueOptions?.find((item) => item.value === rule.value);
  return `${definition?.label ?? 'Filter'}: ${option?.label ?? (rule.field === 'requestedDate' ? formatDate(rule.value) : rule.value)}`;
}
function DateValue({ value }: { value: string | null }) {
  return value ? <span className="whitespace-nowrap">{formatDate(value)}</span> : <EmptyValue />;
}
function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        date,
      );
}
function shipToName(value: Record<string, unknown> | null) {
  const name = value?.name;
  return typeof name === 'string' ? name : '';
}
// Compatibility exports for existing Hader detail and loading screens.
export function Status({ value }: { value: string }) {
  return <HaderStatusBadge status={value} />;
}
export function Pager({
  pagination,
  onPage,
}: {
  pagination: InternalPagination;
  onPage: (page: number) => void;
}) {
  if (!pagination.total) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
      <span>
        Showing {(pagination.page - 1) * 10 + 1}-{Math.min(pagination.page * 10, pagination.total)}{' '}
        of {pagination.total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="rounded-md border p-2 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="rounded-md border border-[#54247a] px-3 py-2 font-semibold text-[#54247a]">
          {pagination.page}
        </span>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
          className="rounded-md border p-2 disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function State({ message, action }: { message: string; action?: () => void }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center p-8 text-sm text-slate-500">
      <p>{message}</p>
      {action && (
        <button type="button" onClick={action} className="mt-3 font-semibold text-[#54247a]">
          Retry
        </button>
      )}
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-11 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  );
}
export const label = formatHaderStatus;
export function date(value: string | null) {
  return value ? formatDate(value) : 'Not provided';
}
export function text(value: Record<string, unknown> | null, key: string) {
  const item = value?.[key];
  return typeof item === 'string' ? item : '';
}
