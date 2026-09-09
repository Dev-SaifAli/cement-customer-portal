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
  getDispatchResources,
  listDeliveryTeam,
  type DeliveryExecutionStatus,
  type DeliveryTeamShipment,
  type DispatchResource,
  type InternalPagination,
} from '../../services/haderDeliveryService';
import { isAbortError } from '../../utils/abort';
import { formatTonQuantity } from '../../utils/quantity';

type FilterField = 'status' | 'haderCityId' | 'deliveryDate' | 'driverId' | 'truckId';
type FilterOperator = 'equals';
type FilterRule = QueryFilterRule<FilterField, FilterOperator>;

const emptyPagination: InternalPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const equalsOperator = [{ value: 'equals' as const, label: 'Is' }];
const statuses: DeliveryExecutionStatus[] = [
  'LOADED',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CLOSED',
];
const columnLabels: Record<string, string> = {
  shipment: 'Shipment',
  order: 'Order',
  customer: 'Customer',
  product: 'Product',
  quantity: 'Quantity',
  transporter: 'Transporter',
  truck: 'Truck',
  driver: 'Driver',
  status: 'Status',
  haderCity: 'Hader City',
  shipTo: 'Ship-to',
  scheduledDate: 'Scheduled Date',
  dispatchedAt: 'Dispatched',
  inTransitAt: 'In Transit',
  deliveredAt: 'Delivered',
  action: 'Action',
};

export function HaderDeliveryTeam() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DeliveryTeamShipment[]>([]);
  const [pagination, setPagination] = useState<InternalPagination>(emptyPagination);
  const [query, setQuery] = useState({ page: 1, search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [appliedRules, setAppliedRules] = useState<FilterRule[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    haderCity: false,
    shipTo: false,
    scheduledDate: false,
    dispatchedAt: false,
    inTransitAt: false,
    deliveredAt: false,
  });
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);
  const [drivers, setDrivers] = useState<DispatchResource[]>([]);
  const [trucks, setTrucks] = useState<DispatchResource[]>([]);
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
    void Promise.all([getDispatchFilters(controller.signal), getDispatchResources(controller.signal)])
      .then(([filterOptions, resources]) => {
        if (controller.signal.aborted) return;
        setCities(filterOptions.cities);
        setDrivers(resources.drivers);
        setTrucks(resources.trucks);
      })
      .catch((cause) => {
        if (isAbortError(cause)) return;
        setCities([]);
        setDrivers([]);
        setTrucks([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void listDeliveryTeam({
      page: query.page,
      search: query.search,
      status: filters.status as DeliveryExecutionStatus | undefined,
      haderCityId: filters.haderCityId,
      deliveryDate: filters.deliveryDate,
      driverId: filters.driverId,
      truckId: filters.truckId,
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
    filters.deliveryDate,
    filters.driverId,
    filters.haderCityId,
    filters.status,
    filters.truckId,
    query,
    reloadKey,
  ]);

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
        cities.map((city) => ({ value: city.id, label: city.name })),
      ),
      {
        id: 'deliveryDate',
        label: 'Delivery Date',
        operators: equalsOperator,
        valueKind: 'date',
      },
      selectDefinition(
        'driverId',
        'Driver',
        drivers.map((driver) => ({
          value: driver.id,
          label: driver.name ?? driver.mobile ?? 'Driver',
        })),
      ),
      selectDefinition(
        'truckId',
        'Truck',
        trucks.map((truck) => ({
          value: truck.id,
          label: truck.plateNumber ?? truck.truckNumber ?? 'Truck',
        })),
      ),
    ],
    [cities, drivers, trucks],
  );

  const columns = useMemo<ColumnDef<DeliveryTeamShipment>[]>(
    () => [
      {
        id: 'shipment',
        header: 'Shipment',
        size: 170,
        enableHiding: false,
        cell: ({ row }) => (
          <DocumentReference
            reference={row.original.shipmentNumber}
            entityId={row.original.id}
            routeBase="/hader/delivery-team"
            nowrap
          />
        ),
      },
      {
        id: 'order',
        header: 'Order',
        size: 165,
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.order.number}</span>,
      },
      {
        id: 'customer',
        header: 'Customer',
        size: 200,
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
        size: 120,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold">
            {formatTonQuantity(row.original.quantityTon)}
          </span>
        ),
      },
      {
        id: 'transporter',
        header: 'Transporter',
        size: 175,
        cell: ({ row }) => row.original.assignment?.transporter.name ?? 'Unassigned',
      },
      {
        id: 'truck',
        header: 'Truck',
        size: 145,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.assignment?.truck?.plateNumber ?? 'Unassigned'}
          </span>
        ),
      },
      {
        id: 'driver',
        header: 'Driver',
        size: 175,
        cell: ({ row }) => row.original.assignment?.driver?.name ?? 'Unassigned',
      },
      {
        id: 'status',
        header: 'Status',
        size: 135,
        enableHiding: false,
        cell: ({ row }) => <DeliveryStatus value={row.original.status} />,
      },
      {
        id: 'haderCity',
        header: 'Hader City',
        size: 170,
        cell: ({ row }) => row.original.haderCity.name ?? <EmptyValue />,
      },
      {
        id: 'shipTo',
        header: 'Ship-to',
        size: 230,
        cell: ({ row }) => (
          <span className="block truncate" title={shipTo(row.original.shipTo)}>
            {shipTo(row.original.shipTo)}
          </span>
        ),
      },
      {
        id: 'scheduledDate',
        header: 'Scheduled Date',
        size: 175,
        cell: ({ row }) => <DateTimeValue shipment={row.original} />,
      },
      {
        id: 'dispatchedAt',
        header: 'Dispatched',
        size: 145,
        cell: ({ row }) => <DateValue value={row.original.dispatchedAt} />,
      },
      {
        id: 'inTransitAt',
        header: 'In Transit',
        size: 145,
        cell: ({ row }) => <DateValue value={row.original.inTransitAt} />,
      },
      {
        id: 'deliveredAt',
        header: 'Delivered',
        size: 145,
        cell: ({ row }) => <DateValue value={row.original.deliveredAt} />,
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
            routeBase="/hader/delivery-team"
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

  return (
    <div className="space-y-5">
      <ListPageHeader rootLabel="Home" rootTo="/hader" title="Delivery Team" />
      <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
        <DataTableToolbar
          search={
            <DataTableSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search shipment, order, customer or product"
              ariaLabel="Search Delivery Team shipments"
            />
          }
          actions={
            <>
              <QueryFilterBuilder
                appliedRules={appliedRules}
                definitions={definitions}
                ariaLabel="Delivery Team filters"
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
          <Table className="min-w-[1180px] table-fixed" aria-busy={loading}>
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
                  message="Unable to load Delivery Team shipments."
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
                    onNavigate={() => navigate(`/hader/delivery-team/${row.original.id}`)}
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

export function DeliveryStatus({ value }: { value: DeliveryExecutionStatus }) {
  return <HaderStatusBadge status={value} />;
}

export function label(value: string) {
  return formatHaderStatus(value);
}

export function tons(value: number) {
  return formatTonQuantity(value);
}

export function date(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not provided';
}

export function shipTo(value: Record<string, unknown> | null) {
  if (!value) return 'Not provided';
  return (
    [value.name, value.streetAddress, value.city, value.region].filter(Boolean).join(', ') ||
    'Not provided'
  );
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
  return {
    status: value('status'),
    haderCityId: value('haderCityId'),
    deliveryDate: value('deliveryDate'),
    driverId: value('driverId'),
    truckId: value('truckId'),
  };
}

function formatFilterRule(
  rule: FilterRule,
  definitions: QueryFilterDefinition<FilterField, FilterOperator>[],
) {
  const definition = definitions.find((item) => item.id === rule.field);
  const option = definition?.valueOptions?.find((item) => item.value === rule.value);
  return `${definition?.label ?? 'Filter'}: ${
    option?.label ?? (rule.field === 'deliveryDate' ? date(rule.value) : rule.value)
  }`;
}

function DateTimeValue({ shipment }: { shipment: DeliveryTeamShipment }) {
  if (!shipment.scheduledDate) return <EmptyValue />;
  return <span className="whitespace-nowrap">{scheduledDateTime(shipment)}</span>;
}

function DateValue({ value }: { value: string | null }) {
  return value ? <span className="whitespace-nowrap">{date(value)}</span> : <EmptyValue />;
}

function scheduledDateTime(shipment: DeliveryTeamShipment) {
  return `${date(shipment.scheduledDate)}${
    shipment.scheduledTime ? `, ${shipment.scheduledTime}` : ''
  }`;
}
