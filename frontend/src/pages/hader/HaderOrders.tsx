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
import { DataTableSearchInput } from '../../components/list/DataTableSearchInput';
import { DataTableToolbar } from '../../components/list/DataTableToolbar';
import { ListPageHeader } from '../../components/list/ListPageHeader';
import { ServerPagination } from '../../components/list/ServerPagination';
import { LocationCityDisplay, getShipToCity } from '../../components/list/LocationCityDisplay';
import { ShipmentSummaryCell } from '../../components/list/ShipmentSummaryCell';
import { TrackingQrCell } from '../../components/list/TrackingQrCell';
import { StatusBadge, type StatusTone } from '../../components/list/StatusBadge';
import { TableLoadingRows, TableMessageRow } from '../../components/list/TableState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/shadcn';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { OrderStatus } from '../../services/customerOrdersService';
import { listOperationalOrders, type OperationalOrder } from '../../services/operationalOrdersService';
import { isAbortError } from '../../utils/abort';
import { formatOrderCreator } from '../../utils/orderCreator';
import { formatTonQuantity } from '../../utils/quantity';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { getOperationalPortalPresentation } from '../../utils/operationalPortal';

type FilterField = 'status';
type FilterOperator = 'equals';
type FilterRule = QueryFilterRule<FilterField, FilterOperator>;
const emptyPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const statuses: OrderStatus[] = ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
const columnLabels: Record<string, string> = {
  tracking: 'QR', order: 'Order', contract: 'Contract', customer: 'Customer', product: 'Product',
  quantity: 'Quantity', truck: 'Truck', driver: 'Driver', status: 'Status',
  shipments: 'Shipment(s)', haderCity: 'Hader City', shipToCity: 'Ship-to City',
  createdBy: 'Created By', createdAt: 'Created At',
};

export function HaderOrders() {
  const navigate = useNavigate();
  const { user } = useSalesAuth();
  const { basePath, isDispatch, ordersLabel } = getOperationalPortalPresentation(user?.role);
  const [items, setItems] = useState<OperationalOrder[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const status = rules.find((rule) => rule.field === 'status')?.value as OrderStatus | undefined;

  useEffect(() => setPage(1), [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void listOperationalOrders({ page, search: search.trim(), status, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result.items);
          setPagination(result.pagination);
        }
      })
      .catch((cause) => {
        if (!isAbortError(cause)) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, reload, search, status]);

  const definitions = useMemo<QueryFilterDefinition<FilterField, FilterOperator>[]>(
    () => [{
      id: 'status', label: 'Status', valueKind: 'select',
      operators: [{ value: 'equals', label: 'Is' }],
      valueOptions: statuses.map((value) => ({ value, label: label(value) })),
    }],
    [],
  );
  const columns = useMemo<ColumnDef<OperationalOrder>[]>(() => [
    { id: 'tracking', header: 'QR', enableHiding: false, cell: ({ row }) => <TrackingQrCell documentType="ORDER" reference={row.original.orderNumber} viewTo={`${basePath}/orders/${row.original.id}`} /> },
    { id: 'order', header: 'Order', enableHiding: false, cell: ({ row }) => <DocumentReference reference={row.original.orderNumber} entityId={row.original.id} routeBase={`${basePath}/orders`} nowrap /> },
    { id: 'contract', header: 'Contract', cell: ({ row }) => <DocumentReference reference={row.original.contract?.reference} entityId={row.original.contract?.id} routeBase={`${basePath}/contracts`} nowrap /> },
    { id: 'customer', header: 'Customer', accessorFn: (row) => row.customer?.companyName ?? '\u2014' },
    { id: 'product', header: 'Product', cell: ({ row }) => <ProductDisplay name={row.original.product.name} code={row.original.product.code} compact /> },
    { id: 'quantity', header: 'Quantity', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatTonQuantity(row.original.requestedQuantityTons)}</span> },
    ...(isDispatch ? [
      { id: 'truck', header: 'Truck', cell: ({ row }: { row: { original: OperationalOrder } }) => row.original.pickupTruck?.plateNumber ?? '\u2014' },
      { id: 'driver', header: 'Driver', cell: ({ row }: { row: { original: OperationalOrder } }) => row.original.pickupDriver?.name ?? '\u2014' },
    ] : []),
    { id: 'shipments', header: 'Shipment(s)', cell: ({ row }) => <ShipmentSummaryCell summary={row.original.shipmentSummary} {...(!isDispatch ? { routeBase: `${basePath}/shipments` } : {})} /> },
    { id: 'haderCity', header: 'Hader City', cell: ({ row }) => <LocationCityDisplay city={row.original.fulfilmentType === 'DELIVERY' ? row.original.haderCity : null} /> },
    { id: 'shipToCity', header: 'Ship-to City', cell: ({ row }) => <LocationCityDisplay city={getShipToCity(row.original)} /> },
    { id: 'status', header: 'Status', enableHiding: false, cell: ({ row }) => <StatusBadge label={label(row.original.status)} tone={tone(row.original.status)} /> },
    { id: 'createdBy', header: 'Created By', cell: ({ row }) => <span className="inline-block min-w-[170px] whitespace-nowrap">{formatOrderCreator(row.original.creator)}</span> },
    { id: 'createdAt', header: 'Created At', cell: ({ row }) => <span className="inline-block min-w-[155px] whitespace-nowrap">{dateTime(row.original.createdAt)}</span> },
  ], [basePath, isDispatch]);
  const table = useReactTable({ data: items, columns, state: { columnVisibility: visibility }, onColumnVisibilityChange: setVisibility, getCoreRowModel: getCoreRowModel() });
  const count = table.getVisibleLeafColumns().length;
  const apply = (next: FilterRule[]) => { setRules(next); setPage(1); };

  return <div className="space-y-5">
    <ListPageHeader rootLabel="Home" rootTo={basePath} title={ordersLabel} />
    <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
      <DataTableToolbar search={<DataTableSearchInput value={searchInput} onChange={setSearchInput} placeholder="Search order, contract, customer or product" ariaLabel="Search orders" />} actions={<><QueryFilterBuilder appliedRules={rules} definitions={definitions} ariaLabel="Order filters" onApply={apply} onClear={() => apply([])} /><DataTableColumnsMenu table={table} labels={columnLabels} /></>} />
      <QueryFilterChips rules={rules} formatRule={(rule) => `Status: ${label(rule.value)}`} onRemove={(id) => apply(rules.filter((rule) => rule.id !== id))} onClear={() => apply([])} />
      <div className="[&>div]:rounded-none [&>div]:border-0"><Table className="min-w-[1200px] table-auto" aria-busy={loading}><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id} className="hover:bg-transparent">{group.headers.map((header) => <TableHead key={header.id} className="whitespace-nowrap normal-case tracking-normal">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{error ? <TableMessageRow colSpan={count} message="Unable to load orders." actionLabel="Retry" onAction={() => setReload((value) => value + 1)} /> : loading && !items.length ? <TableLoadingRows columns={count} /> : table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <NavigableTableRow key={row.id} label={`Open order ${row.original.orderNumber}`} onNavigate={() => navigate(`${basePath}/orders/${row.original.id}`)}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</NavigableTableRow>) : <TableMessageRow colSpan={count} message="No orders match the current search and filters." />}</TableBody></Table></div>
      <ServerPagination {...pagination} onPageChange={setPage} itemLabel="orders" />
    </section>
  </div>;
}

function label(value: string) { return value.split('_').map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(' '); }
function tone(status: OrderStatus): StatusTone { if (status === 'CANCELLED' || status === 'REJECTED') return 'destructive'; if (status === 'COMPLETED' || status === 'APPROVED') return 'success'; if (status === 'SUBMITTED' || status === 'PENDING_APPROVAL') return 'warning'; return 'secondary'; }
function dateTime(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
