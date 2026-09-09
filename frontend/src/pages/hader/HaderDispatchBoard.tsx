import { ClipboardCheck, Truck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/shadcn';
import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  assignShipment,
  getDispatchFilters,
  getDispatchResources,
  listDispatch,
  type DispatchResource,
  type InternalPagination,
  type Shipment,
  type ShipmentStatus,
} from '../../services/haderDeliveryService';
import { formatTonQuantity } from '../../utils/quantity';
import { isAbortError } from '../../utils/abort';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { getOperationalPortalPresentation } from '../../utils/operationalPortal';

type FilterField = 'status' | 'haderCityId' | 'productId' | 'scheduledDate';
type FilterOperator = 'equals';
type FilterRule = QueryFilterRule<FilterField, FilterOperator>;

const emptyPage: InternalPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
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
  customer: 'Customer',
  product: 'Product',
  quantity: 'Quantity',
  scheduledDate: 'Scheduled Date',
  transporter: 'Transporter',
  truck: 'Truck',
  driver: 'Driver',
  status: 'Status',
  action: 'Action',
  order: 'Order',
  haderCity: 'Hader City',
  shipTo: 'Ship-to',
};

export function HaderDispatchBoard() {
  const navigate = useNavigate();
  const { user } = useSalesAuth();
  const { basePath, isDispatch } = getOperationalPortalPresentation(user?.role);
  const dispatchPath = isDispatch ? '/dispatch/dispatch-board' : '/hader/dispatch';
  const [items, setItems] = useState<Shipment[]>([]);
  const [pagination, setPagination] = useState<InternalPagination>(emptyPage);
  const [query, setQuery] = useState({ page: 1, search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [appliedRules, setAppliedRules] = useState<FilterRule[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    order: false,
    haderCity: false,
    shipTo: false,
  });
  const [filterOptions, setFilterOptions] = useState<{
    cities: { id: string; name: string }[];
    products: { id: string; code: string; name: string }[];
  }>({ cities: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [assigning, setAssigning] = useState<Shipment | null>(null);
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
    void listDispatch({
      page: query.page,
      search: query.search,
      status: filters.status,
      haderCityId: filters.haderCityId,
      productId: filters.productId,
      scheduledDate: filters.scheduledDate,
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
    filters.scheduledDate,
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
      selectDefinition(
        'productId',
        'Product',
        filterOptions.products.map((product) => ({
          value: product.id,
          label: `${product.name} - ${product.code}`,
        })),
      ),
      {
        id: 'scheduledDate',
        label: 'Scheduled Date',
        operators: equalsOperator,
        valueKind: 'date',
      },
    ],
    [filterOptions],
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
            routeBase={dispatchPath}
            nowrap
          />
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        size: 190,
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
        size: 200,
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
        size: 120,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold">
            {formatTonQuantity(row.original.quantityTon)}
          </span>
        ),
      },
      {
        id: 'scheduledDate',
        header: 'Scheduled Date',
        size: 135,
        cell: ({ row }) => <DateValue value={row.original.scheduledDate} />,
      },
      {
        id: 'transporter',
        header: 'Transporter',
        size: 155,
        cell: ({ row }) => row.original.assignment?.transporter.name ?? 'Unassigned',
      },
      {
        id: 'truck',
        header: 'Truck',
        size: 135,
        cell: ({ row }) => row.original.assignment?.truck?.plateNumber ?? 'Unassigned',
      },
      {
        id: 'driver',
        header: 'Driver',
        size: 155,
        cell: ({ row }) => row.original.assignment?.driver?.name ?? 'Unassigned',
      },
      {
        id: 'status',
        header: 'Status',
        size: 145,
        enableHiding: false,
        cell: ({ row }) => <HaderStatusBadge status={row.original.status} />,
      },
      {
        id: 'action',
        header: 'Action',
        size: 100,
        enableHiding: false,
        cell: ({ row }) =>
          row.original.status === 'CREATED' ? (
            <Button
              type="button"
              size="sm"
              data-row-navigation-ignore
              onClick={(event) => {
                event.stopPropagation();
                setAssigning(row.original);
              }}
            >
              Assign
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link data-row-navigation-ignore to={`${dispatchPath}/${row.original.id}`}>
                View
              </Link>
            </Button>
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
        id: 'haderCity',
        header: 'Hader City',
        size: 180,
        cell: ({ row }) => row.original.deliveryRequest.haderCity.name || <EmptyValue />,
      },
      {
        id: 'shipTo',
        header: 'Ship-to',
        size: 220,
        cell: ({ row }) => {
          const value = shipToName(row.original.deliveryRequest.shipTo);
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
    [dispatchPath],
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
      <ListPageHeader rootLabel="Home" rootTo={basePath} title="Dispatch Board" />
      <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
        <DataTableToolbar
          search={
            <DataTableSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search shipment, order, customer or product"
              ariaLabel="Search dispatch shipments"
            />
          }
          actions={
            <>
              <QueryFilterBuilder
                appliedRules={appliedRules}
                definitions={definitions}
                ariaLabel="Dispatch filters"
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
        <div className="hidden lg:block [&>div]:rounded-none [&>div]:border-0">
          <Table className="min-w-[1120px] table-fixed" aria-busy={loading}>
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
                  message="Unable to load the dispatch board."
                  actionLabel="Retry"
                  onAction={() => setReloadKey((value) => value + 1)}
                />
              ) : loading && items.length === 0 ? (
                <TableLoadingRows columns={visibleColumnCount} />
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <NavigableTableRow
                    key={row.id}
                    label={`Open dispatch shipment ${row.original.shipmentNumber}`}
                    onNavigate={() => navigate(`${dispatchPath}/${row.original.id}`)}
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
        <div className="grid gap-3 p-4 lg:hidden">
          {error ? (
            <p className="py-12 text-center text-sm text-[var(--customer-text-muted)]">
              Unable to load the dispatch board.
            </p>
          ) : loading && items.length === 0 ? (
            Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-md bg-[var(--customer-surface-secondary)]"
              />
            ))
          ) : items.length ? (
            items.map((shipment) => (
              <article
                key={shipment.id}
                className="rounded-md border border-[var(--customer-border)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <DocumentReference
                    reference={shipment.shipmentNumber}
                    entityId={shipment.id}
                    routeBase={dispatchPath}
                    nowrap
                  />
                  <HaderStatusBadge status={shipment.status} />
                </div>
                <p className="mt-3 text-sm font-semibold text-[var(--customer-text)]">
                  {shipment.deliveryRequest.customer.companyName}
                </p>
                <div className="mt-2">
                  <ProductDisplay
                    name={shipment.deliveryRequest.product.name}
                    code={shipment.deliveryRequest.product.code}
                    compact
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--customer-text)]">
                  {formatTonQuantity(shipment.quantityTon)}
                </p>
                {shipment.status === 'CREATED' && (
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    onClick={() => setAssigning(shipment)}
                  >
                    Assign
                  </Button>
                )}
              </article>
            ))
          ) : (
            <p className="py-12 text-center text-sm text-[var(--customer-text-muted)]">
              No shipments match the current search and filters.
            </p>
          )}
        </div>
        <ServerPagination
          {...pagination}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          itemLabel="shipments"
        />
      </section>
      {assigning && (
        <AssignmentModal
          shipment={assigning}
          onClose={() => setAssigning(null)}
          onAssigned={() => {
            setAssigning(null);
            setReloadKey((value) => value + 1);
          }}
        />
      )}
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
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        parsed,
      );
}
function shipToName(value: Record<string, unknown> | null) {
  const name = value?.name;
  return typeof name === 'string' ? name : '';
}
function AssignmentModal({
  shipment,
  onClose,
  onAssigned,
}: {
  shipment: Shipment;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [transporters, setTransporters] = useState<DispatchResource[]>([]);
  const [trucks, setTrucks] = useState<DispatchResource[]>([]);
  const [drivers, setDrivers] = useState<DispatchResource[]>([]);
  const [transporterId, setTransporterId] = useState('');
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDispatchResources()
      .then((resources) => {
        setTransporters(resources.transporters);
        setTrucks(resources.trucks);
        setDrivers(resources.drivers);
      })
      .catch(() => setError('Unable to load active dispatch resources.'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!transporterId || !truckId || !driverId) {
      setError('Transporter, truck and driver are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await assignShipment(shipment.id, { transporterId, truckId, driverId });
      onAssigned();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to assign shipment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <ClipboardCheck size={18} className="text-[#54247a]" /> Assign Shipment
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {shipment.shipmentNumber} - {formatTonQuantity(shipment.quantityTon)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close assignment">
            <X size={18} />
          </button>
        </header>
        <div className="space-y-4 p-5">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {loading ? (
            <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <>
              <ResourceSelect
                label="Transporter"
                value={transporterId}
                onChange={setTransporterId}
                options={transporters.map((item) => ({
                  id: item.id,
                  label: item.companyName || item.name || 'Transporter',
                }))}
              />
              <ResourceSelect
                label="Truck"
                value={truckId}
                onChange={setTruckId}
                options={trucks.map((item) => ({
                  id: item.id,
                  label: `${item.plateNumber} - ${item.vehicleType} - ${item.capacityTon} TON`,
                }))}
              />
              <ResourceSelect
                label="Driver"
                value={driverId}
                onChange={setDriverId}
                options={drivers.map((item) => ({
                  id: item.id,
                  label: `${item.name} - ${item.mobile} - ${item.licenseNumber}`,
                }))}
              />
            </>
          )}
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#54247a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Truck size={16} /> {saving ? 'Assigning...' : 'Assign Shipment'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ResourceSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="block text-sm font-semibold">
      {label} <span className="text-red-600">*</span>
      <NativeTomSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeTomSelect>
    </label>
  );
}
