import { Factory, Pencil, Plus, Search, Warehouse, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSalesAuth } from '../../context/SalesAuthContext';
import {
  createLoadingPoint,
  listLoadingPoints,
  updateLoadingPoint,
  type LoadingPoint,
  type LoadingPointInput,
  type LoadingPointProduct,
  type LoadingPointStatus,
  type LoadingPointType,
} from '../../services/loadingPointsService';

const statuses: LoadingPointStatus[] = ['AVAILABLE', 'BUSY', 'FULL', 'INACTIVE'];

export function AdminLoadingPoints() {
  const { user } = useSalesAuth();
  const canManage = ['PRICING_ADMIN', 'HADER_MANAGER', 'HADER_OPERATIONS'].includes(
    user?.role ?? '',
  );
  const [pointType, setPointType] = useState<LoadingPointType>('SILO');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LoadingPointStatus | ''>('');
  const [items, setItems] = useState<LoadingPoint[]>([]);
  const [products, setProducts] = useState<LoadingPointProduct[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<LoadingPoint | null | undefined>(undefined);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listLoadingPoints({ page, search, pointType, status });
      setItems(result.items);
      setProducts(result.products);
      setPagination(result.pagination);
    } catch {
      setError('Unable to load loading points.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [page, pointType, search, status]);

  const switchTab = (next: LoadingPointType) => {
    setPointType(next);
    setPage(1);
    setStatus('');
    setEditing(undefined);
  };
  const title = pointType === 'SILO' ? 'Silos' : 'Bagging Lines';

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1b23]">Loading Points</h1>
          <p className="mt-1 text-sm text-[#64748b]">
            Configure product-compatible silos and bagging lines for Loading Control.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-semibold text-white hover:bg-[#472066]"
          >
            <Plus size={16} /> Add {pointType === 'SILO' ? 'Silo' : 'Bagging Line'}
          </button>
        )}
      </header>

      <section className="overflow-hidden rounded-xl border border-[#e3e1e8] bg-white shadow-sm">
        <div className="flex border-b border-[#e3e1e8] px-4 pt-3">
          <Tab active={pointType === 'SILO'} onClick={() => switchTab('SILO')}>
            <Warehouse size={17} /> Silos
          </Tab>
          <Tab active={pointType === 'BAGGING_LINE'} onClick={() => switchTab('BAGGING_LINE')}>
            <Factory size={17} /> Bagging Lines
          </Tab>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e1e8] p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 text-[#94a3b8]" size={17} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={`Search ${title.toLowerCase()}`}
              className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#54247a]"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as LoadingPointStatus | '');
                setPage(1);
              }}
              className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm"
            >
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
            <span className="text-sm text-[#64748b]">{pagination.total} records</span>
          </div>
        </div>
        {error && (
          <div className="m-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#b42318]">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="font-semibold">
              Retry
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-4 py-3">
                  {pointType === 'SILO' ? 'Silo ID' : 'Bagging Line ID'}
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Packaging</th>
                <th className="px-4 py-3">
                  {pointType === 'SILO' ? 'Capacity (TON)' : 'Capacity (TON/hour)'}
                </th>
                {pointType === 'BAGGING_LINE' && <th className="px-4 py-3">Maximum Trucks</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={pointType === 'BAGGING_LINE' ? 7 : 6} className="px-4 py-4">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#faf8fc]">
                    <td className="px-4 py-4 font-semibold">{item.pointNumber}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{item.product?.name ?? 'Not configured'}</p>
                      <p className="text-xs text-[#64748b]">
                        {item.product?.code ?? 'Select a product'}
                      </p>
                    </td>
                    <td className="px-4 py-4">{item.product?.packagingType ?? 'Not configured'}</td>
                    <td className="px-4 py-4">
                      {pointType === 'SILO'
                        ? `${item.capacityTon.toFixed(3)} TON`
                        : `${(item.capacityTonPerHour ?? 0).toFixed(3)} TON/hour`}
                    </td>
                    {pointType === 'BAGGING_LINE' && (
                      <td className="px-4 py-4">{item.maxTrucks}</td>
                    )}
                    <td className="px-4 py-4">
                      <Status value={item.status} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setEditing(item)}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d7cbe0] px-3 py-2 font-semibold text-[#54247a] hover:bg-[#f6f2fa]"
                        >
                          <Pencil size={15} /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={pointType === 'BAGGING_LINE' ? 7 : 6}
                    className="px-4 py-12 text-center text-[#64748b]"
                  >
                    No {title.toLowerCase()} configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-[#e3e1e8] px-4 py-3 text-sm text-[#64748b]">
          <span>
            Showing {items.length ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, pagination.total)}{' '}
            of {pagination.total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="rounded-lg border border-[#54247a] px-3 py-2 text-[#54247a]">
              {page}
            </span>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      </section>
      {editing !== undefined && (
        <LoadingPointForm
          pointType={pointType}
          point={editing}
          products={products}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await load();
          }}
        />
      )}
    </div>
  );
}

function LoadingPointForm({
  pointType,
  point,
  products,
  onClose,
  onSaved,
}: {
  pointType: LoadingPointType;
  point: LoadingPoint | null;
  products: LoadingPointProduct[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const compatibleProducts = useMemo(
    () => products.filter((product) => product.compatiblePointType === pointType),
    [pointType, products],
  );
  const [form, setForm] = useState<LoadingPointInput>({
    pointNumber: point?.pointNumber ?? '',
    pointType,
    productId: point?.product?.id ?? '',
    capacityTon: point?.capacityTon ?? 0,
    capacityTonPerHour: point?.capacityTonPerHour ?? 0,
    maxTrucks: point?.maxTrucks ?? 1,
    status: point?.status ?? 'AVAILABLE',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validCapacity =
      pointType === 'SILO' ? Number(form.capacityTon) > 0 : Number(form.capacityTonPerHour) > 0;
    const validMaxTrucks = pointType === 'SILO' || Number(form.maxTrucks) >= 1;
    if (!form.productId || !validCapacity || !validMaxTrucks) {
      setError(
        pointType === 'SILO'
          ? 'Product and a capacity greater than zero are required.'
          : 'Product, a capacity greater than zero, and at least one maximum truck are required.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (point) await updateLoadingPoint(point.id, form);
      else await createLoadingPoint(form);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save loading point.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[#e3e1e8] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">
              {point ? 'Edit' : 'Add'} {pointType === 'SILO' ? 'Silo' : 'Bagging Line'}
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Only compatible {pointType === 'SILO' ? 'bulk' : 'bag'} products are available.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#64748b] hover:bg-[#f6f2fa]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label={pointType === 'SILO' ? 'Silo ID' : 'Bagging Line ID'}>
            <input
              required
              value={form.pointNumber}
              onChange={(event) => setForm({ ...form, pointNumber: event.target.value })}
              className={inputClass}
              placeholder={pointType === 'SILO' ? 'SILO-01' : 'LINE-01'}
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as LoadingPointStatus })
              }
              className={inputClass}
            >
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Product">
              <select
                required
                value={form.productId}
                onChange={(event) => setForm({ ...form, productId: event.target.value })}
                className={inputClass}
              >
                <option value="">Select compatible product</option>
                {compatibleProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} — {product.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className={pointType === 'SILO' ? 'sm:col-span-2' : ''}>
            <Field label={pointType === 'SILO' ? 'Capacity (TON)' : 'Capacity (TON/hour)'}>
              <input
                required
                min="0.001"
                step="0.001"
                type="number"
                value={(pointType === 'SILO' ? form.capacityTon : form.capacityTonPerHour) || ''}
                onChange={(event) =>
                  setForm(
                    pointType === 'SILO'
                      ? { ...form, capacityTon: Number(event.target.value) }
                      : { ...form, capacityTonPerHour: Number(event.target.value) },
                  )
                }
                className={inputClass}
              />
            </Field>
            {pointType === 'BAGGING_LINE' && (
              <p className="mt-1.5 text-xs font-normal text-[#64748b]">
                Operational processing/loading capacity of this bagging line.
              </p>
            )}
          </div>
          {pointType === 'BAGGING_LINE' && (
            <Field label="Maximum Trucks">
              <input
                required
                min="1"
                step="1"
                type="number"
                value={form.maxTrucks || ''}
                onChange={(event) => setForm({ ...form, maxTrucks: Number(event.target.value) })}
                className={inputClass}
              />
            </Field>
          )}
          {error && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#b42318]">
              {error}
            </p>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#e3e1e8] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#e3e1e8] px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className="rounded-lg bg-[#54247a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#472066] disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save Loading Point'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${active ? 'border-[#54247a] text-[#54247a]' : 'border-transparent text-[#64748b] hover:text-[#54247a]'}`}
    >
      {children}
    </button>
  );
}
function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-[#1a1b23]">
      {text}
      <span className="text-red-600"> *</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
function Status({ value }: { value: LoadingPointStatus }) {
  const color =
    value === 'AVAILABLE'
      ? 'bg-emerald-500'
      : value === 'BUSY'
        ? 'bg-blue-500'
        : value === 'FULL'
          ? 'bg-amber-500'
          : 'bg-slate-400';
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label(value)}
    </span>
  );
}
function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
const inputClass =
  'h-11 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm outline-none focus:border-[#54247a]';
