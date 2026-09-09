import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table';
import { Factory, Pencil, Plus, Warehouse } from 'lucide-react';
import { ProductDisplay } from '../../components/customer-detail/ProductDisplay';
import { DataTableColumnsMenu } from '../../components/customer-list/DataTableColumnsMenu';
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
import { useSalesAuth } from '../../context/SalesAuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  listLoadingPoints,
  type LoadingPoint,
  type LoadingPointProduct,
  type LoadingPointStatus,
  type LoadingPointType,
} from '../../services/loadingPointsService';
import { isAbortError } from '../../utils/abort';
import { formatTonQuantity } from '../../utils/quantity';
import { LoadingPointForm } from '../admin/AdminLoadingPoints';

type FilterField = 'status';
type FilterOperator = 'equals';
type FilterRule = QueryFilterRule<FilterField, FilterOperator>;

const statuses: LoadingPointStatus[] = ['AVAILABLE', 'BUSY', 'FULL', 'INACTIVE'];
const equalsOperator = [{ value: 'equals' as const, label: 'Is' }];
const emptyPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const columnLabels: Record<string, string> = {
  pointNumber: 'Loading Point ID',
  product: 'Product',
  packaging: 'Packaging',
  capacity: 'Capacity',
  maxTrucks: 'Maximum Trucks',
  status: 'Status',
  updatedAt: 'Last Updated',
  action: 'Action',
};

export function HaderLoadingPoints() {
  const { user } = useSalesAuth();
  const canManage = ['PRICING_ADMIN', 'HADER_MANAGER', 'HADER_OPERATIONS'].includes(
    user?.role ?? '',
  );
  const [pointType, setPointType] = useState<LoadingPointType>('SILO');
  const [items, setItems] = useState<LoadingPoint[]>([]);
  const [products, setProducts] = useState<LoadingPointProduct[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [query, setQuery] = useState({ page: 1, search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [appliedRules, setAppliedRules] = useState<FilterRule[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<LoadingPoint | null | undefined>(undefined);
  const debouncedSearchInput = useDebouncedValue(searchInput);
  const status = useMemo(
    () => appliedRules.find((rule) => rule.field === 'status')?.value,
    [appliedRules],
  );

  useEffect(() => {
    const search = debouncedSearchInput.trim();
    setQuery((current) => (current.search === search ? current : { page: 1, search }));
  }, [debouncedSearchInput]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void listLoadingPoints({
      page: query.page,
      search: query.search,
      pointType,
      status: status as LoadingPointStatus | undefined,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setItems(result.items);
        setProducts(result.products);
        setPagination(result.pagination);
      })
      .catch((cause) => {
        if (!isAbortError(cause)) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [pointType, query, reloadKey, status]);

  const definitions = useMemo<QueryFilterDefinition<FilterField, FilterOperator>[]>(
    () => [
      {
        id: 'status',
        label: 'Status',
        operators: equalsOperator,
        valueKind: 'select',
        valueOptions: statuses.map((value) => ({
          value,
          label: formatHaderStatus(value),
        })),
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<LoadingPoint>[]>(
    () => [
      {
        id: 'pointNumber',
        header: pointType === 'SILO' ? 'Silo ID' : 'Bagging Line ID',
        size: 165,
        enableHiding: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold">{row.original.pointNumber}</span>
        ),
      },
      {
        id: 'product',
        header: 'Product',
        size: 245,
        cell: ({ row }) =>
          row.original.product ? (
            <ProductDisplay
              name={row.original.product.name}
              code={row.original.product.code}
              compact
            />
          ) : (
            <span className="text-[var(--customer-text-muted)]">Not configured</span>
          ),
      },
      {
        id: 'packaging',
        header: pointType === 'SILO' ? 'Packaging' : 'Bag Size',
        size: 130,
        cell: ({ row }) =>
          pointType === 'SILO'
            ? row.original.product?.packagingType || <EmptyValue />
            : bagSizeLabel(row.original.product?.uom),
      },
      {
        id: 'capacity',
        header: pointType === 'SILO' ? 'Capacity' : 'Capacity / Hour',
        size: 155,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold">
            {pointType === 'SILO'
              ? formatTonQuantity(row.original.capacityTon)
              : formatTonPerHour(row.original.capacityTonPerHour)}
          </span>
        ),
      },
      ...(pointType === 'BAGGING_LINE'
        ? [
            {
              id: 'maxTrucks',
              header: 'Maximum Trucks',
              size: 145,
              cell: ({ row }: { row: { original: LoadingPoint } }) => row.original.maxTrucks,
            },
          ]
        : []),
      {
        id: 'status',
        header: 'Status',
        size: 125,
        enableHiding: false,
        cell: ({ row }) => <HaderStatusBadge status={row.original.status} />,
      },
      {
        id: 'updatedAt',
        header: 'Last Updated',
        size: 145,
        cell: ({ row }) => <UpdatedTime value={row.original.updatedAt || row.original.createdAt} />,
      },
      ...(canManage
        ? [
            {
              id: 'action',
              header: 'Action',
              size: 105,
              enableHiding: false,
              cell: ({ row }: { row: { original: LoadingPoint } }) => (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(row.original)}
                >
                  <Pencil size={15} />
                  Edit
                </Button>
              ),
            },
          ]
        : []),
    ],
    [canManage, pointType],
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
  const switchTab = (next: LoadingPointType) => {
    setPointType(next);
    setAppliedRules([]);
    setColumnVisibility({});
    setQuery((current) => ({ ...current, page: 1 }));
    setEditing(undefined);
  };
  const title = pointType === 'SILO' ? 'Silos' : 'Bagging Lines';

  return (
    <div className="space-y-5">
      <ListPageHeader
        rootLabel="Home"
        rootTo="/hader"
        title="Loading Points"
        action={
          canManage ? (
            <Button type="button" onClick={() => setEditing(null)}>
              <Plus size={16} />
              Add {pointType === 'SILO' ? 'Silo' : 'Bagging Line'}
            </Button>
          ) : undefined
        }
      />

      <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
        <div
          className="flex gap-1 border-b border-[var(--customer-border)] px-4 pt-2 sm:px-5"
          role="tablist"
          aria-label="Loading point type"
        >
          <LoadingPointTab
            active={pointType === 'SILO'}
            onClick={() => switchTab('SILO')}
            icon={<Warehouse size={17} />}
          >
            Silos
          </LoadingPointTab>
          <LoadingPointTab
            active={pointType === 'BAGGING_LINE'}
            onClick={() => switchTab('BAGGING_LINE')}
            icon={<Factory size={17} />}
          >
            Bagging Lines
          </LoadingPointTab>
        </div>

        <DataTableToolbar
          search={
            <DataTableSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder={
                pointType === 'SILO'
                  ? 'Search silo, product or code'
                  : 'Search bagging line, product or code'
              }
              ariaLabel={`Search ${title}`}
            />
          }
          actions={
            <>
              <QueryFilterBuilder
                appliedRules={appliedRules}
                definitions={definitions}
                ariaLabel={`${title} filters`}
                onApply={applyRules}
                onClear={() => applyRules([])}
              />
              <DataTableColumnsMenu table={table} labels={columnLabels} />
            </>
          }
        />
        <QueryFilterChips
          rules={appliedRules}
          formatRule={(rule) => `Status: ${formatHaderStatus(rule.value)}`}
          onRemove={(id) => applyRules(appliedRules.filter((rule) => rule.id !== id))}
          onClear={() => applyRules([])}
        />

        <div className="[&>div]:rounded-none [&>div]:border-0">
          <Table className="min-w-[820px] table-fixed" aria-busy={loading}>
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
                  message="Unable to load loading points."
                  actionLabel="Retry"
                  onAction={() => setReloadKey((value) => value + 1)}
                />
              ) : loading && items.length === 0 ? (
                <TableLoadingRows columns={visibleColumnCount} />
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="min-w-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableMessageRow
                  colSpan={visibleColumnCount}
                  message={`No ${title.toLowerCase()} match the current search and filters.`}
                />
              )}
            </TableBody>
          </Table>
        </div>
        <ServerPagination
          {...pagination}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          itemLabel="loading points"
        />
      </section>

      {editing !== undefined && (
        <LoadingPointForm
          pointType={pointType}
          point={editing}
          products={products}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            setReloadKey((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}

function LoadingPointTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--customer-primary)] ${
        active
          ? 'border-[var(--customer-primary)] text-[var(--customer-primary)]'
          : 'border-transparent text-[var(--customer-text-muted)] hover:text-[var(--customer-primary)]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function formatTonPerHour(value: number | null) {
  if (value === null) return 'Not configured';
  return formatTonQuantity(value).replace(/ TON$/, ' TON/hour');
}

function bagSizeLabel(uom?: string) {
  if (!uom) return 'Not configured';
  const match = uom.trim().toUpperCase().match(/^(\d+)KG_BAG$/);
  return match ? `${match[1]} KG` : uom.replaceAll('_', ' ');
}

function UpdatedTime({ value }: { value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <EmptyValue />;
  return (
    <span
      className="whitespace-nowrap text-[var(--customer-text-muted)]"
      title={new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)}
    >
      {formatRelativeTimestamp(date)}
    </span>
  );
}

function formatRelativeTimestamp(date: Date) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  if (hours < 48) return 'Yesterday';
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 60) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}
