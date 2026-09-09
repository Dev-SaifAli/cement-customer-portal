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
import { ProductDisplay } from '../../components/customer-detail/ProductDisplay';
import { LocationCityDisplay, getShipToCity } from '../../components/list/LocationCityDisplay';
import { ShipmentSummaryCell } from '../../components/list/ShipmentSummaryCell';
import { TrackingQrCell } from '../../components/list/TrackingQrCell';
import {
  QueryFilterBuilder,
  QueryFilterChips,
  type QueryFilterDefinition,
  type QueryFilterRule,
} from '../../components/customer-list/QueryFilterBuilder';
import { PackageOpen, Search } from 'lucide-react';
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
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  listCustomerOrders,
  type CustomerOrder,
  type CustomerOrdersList,
  type OrderStatus,
} from '../../services/customerOrdersService';
import { formatCommercialTons } from '../../utils/commercialQuantity';
import { formatOrderCreator } from '../../utils/orderCreator';

type OrderListMode = 'DIRECT' | 'CONTRACT';
type OrderFilterField = 'status';
type OrderFilterOperator = 'equals';
type OrderFilterRule = QueryFilterRule<OrderFilterField, OrderFilterOperator>;

const emptyOrders: CustomerOrdersList = {
  items: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
};

const columnLabels: Record<string, string> = {
  tracking: 'QR',
  orderNumber: 'Order Number',
  contract: 'Contract',
  product: 'Product',
  quantity: 'Quantity',
  preferredDeliveryDate: 'Preferred Delivery Date',
  fulfilment: 'Fulfilment',
  shipments: 'Shipment(s)',
  haderCity: 'Hader City',
  shipToCity: 'Ship-to City',
  status: 'Status',
  createdBy: 'Created By',
  createdAt: 'Created Date',
};

export function CustomerOrderList({ mode }: { mode: OrderListMode }) {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [result, setResult] = useState<CustomerOrdersList>(emptyOrders);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [appliedRules, setAppliedRules] = useState<OrderFilterRule[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isDirectOrders = mode === 'DIRECT';
  const status = (appliedRules.find((rule) => rule.field === 'status')?.value ?? '') as
    | OrderStatus
    | '';

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      void listCustomerOrders({
        page: pagination.pageIndex + 1,
        search: search.trim(),
        orderType: mode,
        status,
      })
        .then((data) => {
          if (!cancelled) setResult(data);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, pagination.pageIndex, reloadKey, search, status]);

  const columns = useMemo<ColumnDef<CustomerOrder>[]>(
    () => [
      {
        id: 'tracking',
        header: 'QR',
        size: 58,
        enableHiding: false,
        cell: ({ row }) => (
          <TrackingQrCell
            documentType="ORDER"
            reference={row.original.orderNumber}
            viewTo={isDirectOrders
              ? `/customer/direct-orders/${row.original.id}`
              : `/customer/orders/${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: 'orderNumber',
        header: isDirectOrders ? 'DO Number' : 'Order Number',
        size: 155,
        enableHiding: false,
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap font-semibold text-[var(--customer-primary)]">
            {String(getValue())}
          </span>
        ),
      },
      ...(!isDirectOrders
        ? [
            {
              id: 'contract',
              header: 'Contract',
              size: 145,
              cell: ({ row }: { row: { original: CustomerOrder } }) => (
                <span className="whitespace-nowrap font-medium text-[var(--customer-text)]">
                  {row.original.contract?.reference ?? '\u2014'}
                </span>
              ),
            },
          ]
        : []),
      {
        id: 'product',
        header: 'Product',
        size: 270,
        enableHiding: false,
        cell: ({ row }) => (
          <ProductDisplay
            name={row.original.product.name}
            code={row.original.product.code}
            compact
          />
        ),
      },
      {
        accessorKey: 'requestedQuantityTons',
        id: 'quantity',
        header: 'Quantity',
        size: 120,
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap tabular-nums">{formatCommercialTons(Number(getValue()))}</span>
        ),
      },
      {
        accessorKey: 'preferredDeliveryDate',
        header: isDirectOrders ? 'Delivery Date' : 'Preferred Delivery Date',
        size: isDirectOrders ? 145 : 190,
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">{formatDate(getValue<string | null>())}</span>
        ),
      },
      {
        accessorKey: 'fulfilmentType',
        id: 'fulfilment',
        header: 'Fulfilment',
        size: 145,
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">{formatFulfilment(String(getValue()))}</span>
        ),
      },
      {
        id: 'shipments',
        header: 'Shipment(s)',
        size: 155,
        cell: ({ row }) => (
          <ShipmentSummaryCell summary={row.original.shipmentSummary} routeBase="/customer/shipments" />
        ),
      },
      {
        id: 'haderCity',
        header: 'Hader City',
        size: 140,
        cell: ({ row }) => (
          <LocationCityDisplay city={row.original.fulfilmentType === 'DELIVERY' ? row.original.haderCity : null} />
        ),
      },
      {
        id: 'shipToCity',
        header: 'Ship-to City',
        size: 145,
        cell: ({ row }) => <LocationCityDisplay city={getShipToCity(row.original)} />,
      },
      ...(isDirectOrders
        ? [
            {
              id: 'contract',
              header: 'Contract',
              size: 145,
              cell: ({ row }: { row: { original: CustomerOrder } }) => (
                <span className="whitespace-nowrap font-medium text-[var(--customer-text)]">
                  {row.original.contract?.reference ?? '\u2014'}
                </span>
              ),
            },
          ]
        : []),
      {
        accessorKey: 'status',
        header: 'Status',
        size: 170,
        enableHiding: false,
        cell: ({ getValue }) => <OrderStatusBadge status={getValue<OrderStatus>()} />,
      },
      ...(!isDirectOrders
        ? [
            {
              id: 'createdBy',
              header: 'Created By',
              size: 190,
              cell: ({ row }: { row: { original: CustomerOrder } }) => (
                <span className="block truncate" title={formatOrderCreator(row.original.creator, user?.id)}>
                  {formatOrderCreator(row.original.creator, user?.id)}
                </span>
              ),
            },
          ]
        : []),
      {
        accessorKey: 'createdAt',
        header: 'Created Date',
        size: 150,
        cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(getValue<string>())}</span>,
      },
    ],
    [isDirectOrders, user?.id],
  );

  const table = useReactTable({
    data: result.items,
    columns,
    state: { columnVisibility, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: result.pagination.totalPages,
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const pageNumbers = getVisiblePages(pagination.pageIndex + 1, result.pagination.totalPages);
  const showingFrom = result.pagination.total === 0
    ? 0
    : (result.pagination.page - 1) * result.pagination.pageSize + 1;
  const showingTo = Math.min(
    result.pagination.page * result.pagination.pageSize,
    result.pagination.total,
  );
  const title = isDirectOrders ? 'Direct Orders' : 'Orders';
  const visibleColumnLabels = useMemo(
    () => ({
      ...columnLabels,
      orderNumber: isDirectOrders ? 'DO Number' : 'Order Number',
      preferredDeliveryDate: isDirectOrders ? 'Delivery Date' : 'Preferred Delivery Date',
    }),
    [isDirectOrders],
  );
  const canCreateDirectOrder =
    isDirectOrders && (user?.role === 'CUSTOMER_ADMIN' || user?.role === 'PURCHASER');
  const openOrder = (order: CustomerOrder) =>
    navigate(
      isDirectOrders
        ? `/customer/direct-orders/${order.id}`
        : `/customer/orders/${order.id}`,
    );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <CustomerListPageHeader
        title={title}
        {...(canCreateDirectOrder
          ? { createAction: { label: 'New Direct Order', to: '/customer/orders/new' } }
          : {})}
      />

      <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--customer-border)] px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <p className="whitespace-nowrap text-base font-semibold text-[var(--customer-text)]">
            {result.pagination.total} {result.pagination.total === 1 ? title.slice(0, -1) : title}
          </p>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <label className="relative min-w-0 flex-1 lg:w-80 lg:flex-none">
              <span className="sr-only">Search {title.toLowerCase()}</span>
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
                placeholder={isDirectOrders ? 'DO number, contract or product' : 'Order, contract or product'}
                className="pl-9"
              />
            </label>
            <QueryFilterBuilder
              appliedRules={appliedRules}
              definitions={orderFilterDefinitions}
              ariaLabel={`${title} filters`}
              onApply={(rules) => {
                setAppliedRules(rules);
                table.setPageIndex(0);
              }}
              onClear={() => {
                setAppliedRules([]);
                table.setPageIndex(0);
              }}
            />
            <DataTableColumnsMenu table={table} labels={visibleColumnLabels} />
          </div>
        </div>

        <QueryFilterChips
          rules={appliedRules}
          formatRule={(rule) => `Status: ${formatStatus(rule.value as OrderStatus)}`}
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
          <Table className="min-w-[1580px] table-fixed text-[14px]" aria-busy={loading}>
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
                <OrderTableSkeleton columnCount={visibleColumnCount} />
              ) : error ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={visibleColumnCount} className="h-64 p-0 text-center">
                    <p className="font-semibold text-[var(--customer-text)]">Unable to load {title.toLowerCase()}.</p>
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
                    label={`View ${isDirectOrders ? 'direct order' : 'order'} ${row.original.orderNumber}`}
                    onNavigate={() => openOrder(row.original)}
                    className="h-[58px] text-[14px] text-[var(--customer-text)]"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-3 py-2.5 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </NavigableTableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={visibleColumnCount} className="h-72 p-0">
                    <EmptyState title={title} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && !error && result.pagination.total > 0 && (
          <footer className="flex flex-col gap-3 border-t border-[var(--customer-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-[var(--customer-text-muted)]">
              Showing {showingFrom}-{showingTo} of {result.pagination.total} {title}
            </p>
            <Pagination className="mx-0 w-auto justify-start sm:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    disabled={pagination.pageIndex === 0}
                    onClick={() => table.previousPage()}
                  />
                </PaginationItem>
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationButton
                      isActive={pageNumber === pagination.pageIndex + 1}
                      onClick={() => table.setPageIndex(pageNumber - 1)}
                    >
                      {pageNumber}
                    </PaginationButton>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </footer>
        )}
      </section>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const variant = status === 'REJECTED' || status === 'CANCELLED'
    ? 'destructive'
    : status === 'PENDING_APPROVAL' || status === 'SUBMITTED'
      ? 'warning'
      : status === 'APPROVED' || status === 'COMPLETED'
        ? 'success'
        : 'secondary';

  return (
    <Badge variant={variant} className="gap-1.5 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {formatStatus(status)}
    </Badge>
  );
}

function OrderTableSkeleton({ columnCount }: { columnCount: number }) {
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

function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center px-4 text-center">
      <PackageOpen size={32} className="text-[var(--customer-text-muted)]" aria-hidden="true" />
      <h2 className="mt-3 font-semibold text-[var(--customer-text)]">No {title.toLowerCase()} yet</h2>
      <p className="mt-1 text-sm text-[var(--customer-text-muted)]">
        {title === 'Direct Orders'
          ? 'Submitted Direct Orders will appear here.'
          : 'Orders placed against active contracts will appear here.'}
      </p>
    </div>
  );
}

function getVisiblePages(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function formatDate(value: string | null) {
  if (!value) return '\u2014';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '\u2014';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatFulfilment(value: string) {
  return value === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up';
}

function formatStatus(value: OrderStatus) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

const orderStatusOptions: OrderStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
];

const orderFilterDefinitions: QueryFilterDefinition<OrderFilterField, OrderFilterOperator>[] = [
  {
    id: 'status',
    label: 'Status',
    valueKind: 'select',
    operators: [{ value: 'equals', label: 'Is' }],
    valueOptions: orderStatusOptions.map((status) => ({
      value: status,
      label: formatStatus(status),
    })),
  },
];
