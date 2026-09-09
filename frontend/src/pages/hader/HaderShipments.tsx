import { useEffect, useMemo, useState } from 'react';
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
  listShipments,
  type InternalPagination,
  type Shipment,
  type ShipmentStatus,
} from '../../services/haderDeliveryService';
import { formatTonQuantity } from '../../utils/quantity';
import { isAbortError } from '../../utils/abort';

type FilterField = 'status' | 'haderCityId' | 'productId' | 'scheduledDate';
type FilterOperator = 'equals';
type FilterRule = QueryFilterRule<FilterField, FilterOperator>;

const emptyPagination: InternalPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const statuses: ShipmentStatus[] = [
  'CREATED',
  'ASSIGNED',
  'LOADING',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CLOSED',
  'CANCELLED',
];
const columnLabels: Record<string, string> = {
  shipment: 'Shipment',
  order: 'Order',
  customer: 'Customer',
  product: 'Product',
  quantity: 'Quantity',
  scheduledDate: 'Scheduled Date',
  status: 'Status',
  contract: 'Contract',
  haderCity: 'Hader City',
  transporter: 'Transporter',
  truck: 'Truck',
  driver: 'Driver',
};

export function HaderShipments({ audience = 'hader' }: { audience?: 'hader' | 'sales' }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Shipment[]>([]);
  const [pagination, setPagination] = useState<InternalPagination>(emptyPagination);
  const [query, setQuery] = useState({ page: 1, search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [appliedRules, setAppliedRules] = useState<FilterRule[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    contract: false,
    haderCity: false,
    transporter: false,
    truck: false,
    driver: false,
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
  const base = audience === 'hader' ? '/hader/shipments' : '/sales/shipments';

  useEffect(() => {
    const search = debouncedSearchInput.trim();
    setQuery((current) => (current.search === search ? current : { page: 1, search }));
  }, [debouncedSearchInput]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void listShipments(
      {
        page: query.page,
        search: query.search,
        status: filters.status,
        haderCityId: filters.haderCityId,
        productId: filters.productId,
        scheduledDate: filters.scheduledDate,
        signal: controller.signal,
      },
      audience,
    )
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
    audience,
    filters.haderCityId,
    filters.productId,
    filters.scheduledDate,
    filters.status,
    query,
    reloadKey,
  ]);

  useEffect(() => {
    if (audience !== 'hader') return;
    const controller = new AbortController();
    void getDispatchFilters(controller.signal)
      .then(setFilterOptions)
      .catch((cause) => {
        if (!isAbortError(cause)) setFilterOptions({ cities: [], products: [] });
      });
    return () => controller.abort();
  }, [audience]);

  const definitions = useMemo<QueryFilterDefinition<FilterField, FilterOperator>[]>(
    () => [
      selectDefinition(
        'status',
        'Status',
        statuses.map((status) => ({ value: status, label: formatHaderStatus(status) })),
      ),
      ...(audience === 'hader'
        ? [
            selectDefinition(
              'haderCityId',
              'Hader City',
              filterOptions.cities.map((city) => ({ value: city.id, label: city.name })),
            ),
            selectDefinition(
              'productId',
              'Product',
              filterOptions.products.map((product) => ({
                value: product.id,
                label: `${product.name} - ${product.code}`,
              })),
            ),
          ]
        : []),
      {
        id: 'scheduledDate',
        label: 'Scheduled Date',
        operators: equalsOperator,
        valueKind: 'date',
      },
    ],
    [audience, filterOptions],
  );

  const columns = useMemo<ColumnDef<Shipment>[]>(
    () => [
      {
        id: 'shipment',
        header: 'Shipment',
        size: 155,
        enableHiding: false,
        cell: ({ row }) => (
          <DocumentReference
            reference={row.original.shipmentNumber}
            entityId={row.original.id}
            routeBase={base}
            nowrap
          />
        ),
      },
      {
        id: 'order',
        header: 'Order',
        size: 170,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.deliveryRequest.order.number}</span>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        size: 210,
        cell: ({ row }) => (
          <span
            className="block truncate font-medium"
            title={row.original.deliveryRequest.customer.companyName}
          >
            {row.original.deliveryRequest.customer.companyName}
          </span>
        ),
      },
      {
        id: 'product',
        header: 'Product',
        size: 220,
        cell: ({ row }) => (
          <ProductDisplay
            name={row.original.deliveryRequest.product.name}
            code={row.original.deliveryRequest.product.code}
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
        id: 'scheduledDate',
        header: 'Scheduled Date',
        size: 140,
        cell: ({ row }) => <DateValue value={row.original.scheduledDate} />,
      },
      {
        id: 'status',
        header: 'Status',
        size: 150,
        enableHiding: false,
        cell: ({ row }) => <HaderStatusBadge status={row.original.status} />,
      },
      {
        id: 'contract',
        header: 'Contract',
        size: 160,
        cell: ({ row }) =>
          row.original.deliveryRequest.contract?.reference ? (
            <span className="whitespace-nowrap">
              {row.original.deliveryRequest.contract.reference}
            </span>
          ) : (
            <EmptyValue />
          ),
      },
      {
        id: 'haderCity',
        header: 'Hader City',
        size: 180,
        cell: ({ row }) => row.original.deliveryRequest.haderCity.name || <EmptyValue />,
      },
      {
        id: 'transporter',
        header: 'Transporter',
        size: 180,
        cell: ({ row }) => row.original.assignment?.transporter.name ?? 'Unassigned',
      },
      {
        id: 'truck',
        header: 'Truck',
        size: 150,
        cell: ({ row }) => row.original.assignment?.truck?.plateNumber ?? 'Unassigned',
      },
      {
        id: 'driver',
        header: 'Driver',
        size: 180,
        cell: ({ row }) => row.original.assignment?.driver?.name ?? 'Unassigned',
      },
    ],
    [base],
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
      <ListPageHeader
        rootLabel={audience === 'hader' ? 'Home' : 'Sales'}
        rootTo={audience === 'hader' ? '/hader' : '/sales'}
        title="Shipments"
      />
      <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
        <DataTableToolbar
          search={
            <DataTableSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search shipment, order, customer or product"
              ariaLabel="Search shipments"
            />
          }
          actions={
            <>
              <QueryFilterBuilder
                appliedRules={appliedRules}
                definitions={definitions}
                ariaLabel="Shipment filters"
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
                  message="Unable to load shipments."
                  actionLabel="Retry"
                  onAction={() => setReloadKey((value) => value + 1)}
                />
              ) : loading && items.length === 0 ? (
                <TableLoadingRows columns={visibleColumnCount} />
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <NavigableTableRow
                    key={row.id}
                    label={`Open shipment ${row.original.shipmentNumber}`}
                    onNavigate={() => navigate(`${base}/${row.original.id}`)}
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
    productId: value('productId'),
    scheduledDate: value('scheduledDate'),
  };
}
function formatFilterRule(
  rule: FilterRule,
  definitions: QueryFilterDefinition<FilterField, FilterOperator>[],
) {
  const definition = definitions.find((item) => item.id === rule.field);
  const option = definition?.valueOptions?.find((item) => item.value === rule.value);
  return `${definition?.label ?? 'Filter'}: ${option?.label ?? (rule.field === 'scheduledDate' ? formatDate(rule.value) : rule.value)}`;
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
