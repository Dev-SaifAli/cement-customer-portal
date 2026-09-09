import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type VisibilityState } from '@tanstack/react-table';
import { DocumentReference } from '../../components/customer-detail/DocumentReference';
import { ProductDisplay } from '../../components/customer-detail/ProductDisplay';
import { DataTableColumnsMenu } from '../../components/customer-list/DataTableColumnsMenu';
import { NavigableTableRow } from '../../components/customer-list/NavigableTableRow';
import { QueryFilterBuilder, QueryFilterChips, type QueryFilterDefinition, type QueryFilterRule } from '../../components/customer-list/QueryFilterBuilder';
import { DataTableSearchInput } from '../../components/list/DataTableSearchInput';
import { DataTableToolbar } from '../../components/list/DataTableToolbar';
import { ListPageHeader } from '../../components/list/ListPageHeader';
import { ServerPagination } from '../../components/list/ServerPagination';
import { LocationCityDisplay } from '../../components/list/LocationCityDisplay';
import { TrackingQrCell } from '../../components/list/TrackingQrCell';
import { StatusBadge } from '../../components/list/StatusBadge';
import { TableLoadingRows, TableMessageRow } from '../../components/list/TableState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/shadcn';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { getOperationalContractFilters, listOperationalContracts, type OperationalContract, type OperationalPagination } from '../../services/operationalContractsService';
import { formatCommercialTons } from '../../utils/commercialQuantity';
import { isAbortError } from '../../utils/abort';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { getOperationalPortalPresentation } from '../../utils/operationalPortal';

type Field = 'productId' | 'startDate';
type Operator = 'equals';
type Rule = QueryFilterRule<Field, Operator>;
const emptyPagination: OperationalPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const labels: Record<string, string> = { tracking: 'QR', contract: 'Contract', customer: 'Customer', product: 'Product', fulfilment: 'Fulfilment', haderCity: 'Hader City', shipToCity: 'Ship-to City', orders: 'Orders', total: 'Total Tons', remaining: 'Remaining Tons', start: 'Start Date', end: 'End Date', status: 'Status' };

export function HaderContracts() {
  const navigate = useNavigate();
  const { user } = useSalesAuth();
  const { basePath, contractsLabel } = getOperationalPortalPresentation(user?.role);
  const [items, setItems] = useState<OperationalContract[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [rules, setRules] = useState<Rule[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({ end: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const filters = useMemo(() => ({
    productId: rules.find((rule) => rule.field === 'productId')?.value,
    startDate: rules.find((rule) => rule.field === 'startDate')?.value,
  }), [rules]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    void listOperationalContracts({ page, search: debouncedSearch.trim(), ...filters, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setItems(data.items); setPagination(data.pagination); } })
      .catch((cause) => { if (!isAbortError(cause)) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [debouncedSearch, filters, page, reload]);
  useEffect(() => {
    const controller = new AbortController();
    void getOperationalContractFilters(controller.signal).then((data) => setProducts(data.products)).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const definitions = useMemo<QueryFilterDefinition<Field, Operator>[]>(() => [
    { id: 'productId', label: 'Product', operators: [{ value: 'equals', label: 'Is' }], valueKind: 'select', valueOptions: products.map((item) => ({ value: item.id, label: `${item.name} - ${item.code}` })) },
    { id: 'startDate', label: 'Start Date', operators: [{ value: 'equals', label: 'Is' }], valueKind: 'date' },
  ], [products]);
  const columns = useMemo<ColumnDef<OperationalContract>[]>(() => [
    { id: 'tracking', header: 'QR', enableHiding: false, cell: ({ row }) => <TrackingQrCell documentType="CONTRACT" reference={row.original.reference} viewTo={`${basePath}/contracts/${row.original.id}`} /> },
    { id: 'contract', header: 'Contract', enableHiding: false, cell: ({ row }) => <DocumentReference reference={row.original.reference} entityId={row.original.id} routeBase={`${basePath}/contracts`} nowrap /> },
    { id: 'customer', header: 'Customer', accessorFn: (row) => row.customer.name },
    { id: 'product', header: 'Product', cell: ({ row }) => <ProductDisplay name={row.original.product.name} code={row.original.product.code} compact /> },
    { id: 'fulfilment', header: 'Fulfilment', cell: ({ row }) => row.original.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pick-Up' },
    { id: 'haderCity', header: 'Hader City', cell: ({ row }) => <LocationCityDisplay city={row.original.fulfilment === 'DELIVERY' ? row.original.haderCity : null} /> },
    { id: 'shipToCity', header: 'Ship-to City', cell: ({ row }) => <LocationCityDisplay city={row.original.shipToCity} /> },
    { id: 'orders', header: 'Orders', cell: ({ row }) => <span className="tabular-nums">{row.original.orderCount}</span> },
    { id: 'total', header: 'Total Tons', cell: ({ row }) => formatCommercialTons(row.original.totalQuantityTons) },
    { id: 'remaining', header: 'Remaining Tons', cell: ({ row }) => formatCommercialTons(row.original.remainingQuantityTons) },
    { id: 'start', header: 'Start Date', cell: ({ row }) => formatDate(row.original.startDate) },
    { id: 'end', header: 'End Date', cell: ({ row }) => formatDate(row.original.endDate) },
    { id: 'status', header: 'Status', enableHiding: false, cell: ({ row }) => <StatusBadge label={row.original.status} tone="success" /> },
  ], [basePath]);
  const table = useReactTable({ data: items, columns, state: { columnVisibility: visibility }, onColumnVisibilityChange: setVisibility, getCoreRowModel: getCoreRowModel() });
  const count = table.getVisibleLeafColumns().length;
  const apply = (next: Rule[]) => { setRules(next); setPage(1); };

  return <div className="space-y-5">
    <ListPageHeader rootLabel="Home" rootTo={basePath} title={contractsLabel} />
    <section className="border-y border-[var(--customer-border)] bg-[var(--customer-surface)]">
      <DataTableToolbar search={<DataTableSearchInput value={search} onChange={setSearch} placeholder="Search contract, customer or product" ariaLabel="Search contracts" />} actions={<><QueryFilterBuilder appliedRules={rules} definitions={definitions} ariaLabel="Contract filters" onApply={apply} onClear={() => apply([])} /><DataTableColumnsMenu table={table} labels={labels} /></>} />
      <QueryFilterChips rules={rules} formatRule={(rule) => `${definitions.find((item) => item.id === rule.field)?.label}: ${products.find((item) => item.id === rule.value)?.name ?? rule.value}`} onRemove={(id) => apply(rules.filter((rule) => rule.id !== id))} onClear={() => apply([])} />
      <div className="[&>div]:rounded-none [&>div]:border-0"><Table className="min-w-[980px] table-fixed" aria-busy={loading}><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id} className="hover:bg-transparent">{group.headers.map((header) => <TableHead key={header.id} className="whitespace-nowrap normal-case tracking-normal">{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{error ? <TableMessageRow colSpan={count} message="Unable to load eligible contracts." actionLabel="Retry" onAction={() => setReload((value) => value + 1)} /> : loading && !items.length ? <TableLoadingRows columns={count} /> : table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <NavigableTableRow key={row.id} label={`Open contract ${row.original.reference ?? ''}`} onNavigate={() => navigate(`${basePath}/contracts/${row.original.id}`)}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</NavigableTableRow>) : <TableMessageRow colSpan={count} message="No eligible active contracts match the current search and filters." />}</TableBody></Table></div>
      <ServerPagination {...pagination} onPageChange={setPage} itemLabel="contracts" />
    </section>
  </div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }
