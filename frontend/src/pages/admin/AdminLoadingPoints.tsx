import { Factory, Pencil, Plus, Search, Warehouse, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { SearchableTomSelect } from '../../components/ui/SearchableTomSelect';
import { useSalesAuth } from '../../context/SalesAuthContext';
import {
  createLoadingPoint,
  listLoadingPoints,
  LoadingPointRequestError,
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
                <th className="px-4 py-3">S.No.</th>
                <th className="px-4 py-3">
                  {pointType === 'SILO' ? 'Silo ID' : 'Bagging Line ID'}
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">
                  {pointType === 'SILO' ? 'Packaging' : 'Bag Size'}
                </th>
                <th className="px-4 py-3">
                  {pointType === 'SILO' ? 'Capacity (TON)' : 'Capacity (TON/hour)'}
                </th>
                {pointType === 'BAGGING_LINE' && <th className="px-4 py-3">Maximum Trucks</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={pointType === 'BAGGING_LINE' ? 9 : 8} className="px-4 py-4">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : items.length ? (
                items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-[#faf8fc]">
                    <td className="px-4 py-4 text-[#64748b]">{(page - 1) * 10 + index + 1}</td>
                    <td className="px-4 py-4 font-semibold">{item.pointNumber}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{item.product?.name ?? 'Not configured'}</p>
                      <p className="text-xs text-[#64748b]">
                        {item.product?.code ?? 'Select a product'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {pointType === 'SILO'
                        ? item.product?.packagingType ?? 'Not configured'
                        : bagSizeLabel(item.product?.uom)}
                    </td>
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
                    <td
                      className="px-4 py-4 text-[#64748b]"
                      title={formatExactTimestamp(item.updatedAt || item.createdAt)}
                    >
                      {formatRelativeTimestamp(item.updatedAt || item.createdAt)}
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
                    colSpan={pointType === 'BAGGING_LINE' ? 9 : 8}
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
    pointType,
    productId: point?.product?.id ?? '',
    capacityTon: point?.capacityTon ?? 0,
    capacityTonPerHour: point?.capacityTonPerHour ?? 0,
    maxTrucks: point?.maxTrucks ?? 1,
    status: point?.status ?? 'AVAILABLE',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const selectedProduct = compatibleProducts.find((product) => product.id === form.productId);
  const capacityError =
    pointType === 'SILO' ? fieldErrors.capacityTon : fieldErrors.capacityTonPerHour;
  const updateField = (field: keyof LoadingPointInput, value: LoadingPointInput[typeof field]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextFieldErrors: Record<string, string> = {};
    if (!form.productId) nextFieldErrors.productId = 'Select a compatible product.';
    if (pointType === 'SILO' && Number(form.capacityTon) <= 0) {
      nextFieldErrors.capacityTon = 'Silo capacity must be greater than zero.';
    }
    if (pointType === 'BAGGING_LINE' && Number(form.capacityTonPerHour) <= 0) {
      nextFieldErrors.capacityTonPerHour = 'Bagging Line capacity must be greater than zero.';
    }
    if (pointType === 'BAGGING_LINE' && Number(form.maxTrucks) < 1) {
      nextFieldErrors.maxTrucks = 'Maximum Trucks must be at least one.';
    }
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setError('');
      return;
    }
    const payload: LoadingPointInput =
      pointType === 'SILO'
        ? {
            pointType,
            productId: form.productId,
            capacityTon: Number(form.capacityTon),
            status: form.status,
          }
        : {
            pointType,
            productId: form.productId,
            capacityTonPerHour: Number(form.capacityTonPerHour),
            maxTrucks: Number(form.maxTrucks),
            status: form.status,
          };
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      if (point) await updateLoadingPoint(point.id, payload);
      else await createLoadingPoint(payload);
      await onSaved();
    } catch (cause) {
      if (cause instanceof LoadingPointRequestError) {
        const requestFieldErrors =
          Object.keys(cause.fieldErrors).length > 0
            ? cause.fieldErrors
            : fieldErrorsForLoadingPointError(cause.code, cause.message);
        if (Object.keys(requestFieldErrors).length) {
          setFieldErrors(requestFieldErrors);
          setError('Correct the highlighted fields and try again.');
        } else {
          setError(cause.message);
        }
      } else {
        setError(cause instanceof Error ? cause.message : 'Unable to save loading point.');
      }
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
        <div className="grid gap-4 p-5 sm:grid-cols-12">
          {point && (
            <div className="sm:col-span-5">
              <Field label={pointType === 'SILO' ? 'Silo ID' : 'Bagging Line ID'} required={false}>
                <div className="flex h-11 items-center rounded-lg border border-[#e2e8f0] bg-slate-50 px-3 text-sm text-[#64748b]">
                  {point.pointNumber}
                </div>
              </Field>
            </div>
          )}
          <div className="sm:col-span-5">
            <Field label="Status" {...(fieldErrors.status ? { error: fieldErrors.status } : {})}>
              <SearchableTomSelect
                ariaLabel="Loading point status"
                placeholder="Select status"
                value={form.status}
                options={statuses.map((value) => ({ value, label: label(value) }))}
                dropdownParent="body"
                onChange={(value) => updateField('status', value as LoadingPointStatus)}
              />
            </Field>
          </div>
          <div className="sm:col-span-12">
            <Field
              label="Product"
              {...(fieldErrors.productId ? { error: fieldErrors.productId } : {})}
            >
              <SearchableTomSelect
                ariaLabel="Compatible product"
                placeholder="Select compatible product"
                value={form.productId}
                options={compatibleProducts.map((product) => ({
                  value: product.id,
                  label: `${product.code} — ${product.name}`,
                }))}
                dropdownParent="body"
                onChange={(value) => updateField('productId', value)}
              />
            </Field>
          </div>
          {pointType === 'BAGGING_LINE' && (
            <div className="sm:col-span-4">
              <Field label="Bag Size">
                <SearchableTomSelect
                  ariaLabel="Product bag size"
                  placeholder={form.productId ? 'Bag size not configured' : 'Select product first'}
                  value={selectedProduct?.uom ?? ''}
                  options={
                    selectedProduct?.uom
                      ? [{ value: selectedProduct.uom, label: bagSizeLabel(selectedProduct.uom) }]
                      : []
                  }
                  disabled
                  dropdownParent="body"
                  onChange={() => undefined}
                />
              </Field>
            </div>
          )}
          <div className={pointType === 'BAGGING_LINE' ? 'sm:col-span-4' : 'sm:col-span-5'}>
            <Field
              label={pointType === 'SILO' ? 'Capacity (TON)' : 'Capacity (TON/hour)'}
              {...(capacityError ? { error: capacityError } : {})}
            >
              <input
                required
                min="0.001"
                step="0.001"
                type="number"
                value={(pointType === 'SILO' ? form.capacityTon : form.capacityTonPerHour) || ''}
                onChange={(event) =>
                  updateField(
                    pointType === 'SILO' ? 'capacityTon' : 'capacityTonPerHour',
                    Number(event.target.value),
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
            <div className="sm:col-span-4">
              <Field
                label="Maximum Trucks"
                {...(fieldErrors.maxTrucks ? { error: fieldErrors.maxTrucks } : {})}
              >
                <input
                  required
                  min="1"
                  step="1"
                  type="number"
                  value={form.maxTrucks || ''}
                  onChange={(event) => updateField('maxTrucks', Number(event.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
          {error && (
            <p className="sm:col-span-12 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#b42318]">
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
            {busy ? 'Saving...' : `Save ${pointType === 'SILO' ? 'Silo' : 'Bagging Line'}`}
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
function Field({
  label: text,
  children,
  error,
  required = true,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-[#1a1b23]">
      {text}
      {required && <span className="text-red-600"> *</span>}
      <span className="mt-1.5 block">{children}</span>
      {error && <span className="mt-1.5 block text-xs font-medium text-[#b42318]">{error}</span>}
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

function bagSizeLabel(uom?: string) {
  if (!uom) return 'Not configured';
  const match = uom.trim().toUpperCase().match(/^(\d+)KG_BAG$/);
  return match ? `${match[1]} KG` : uom.replaceAll('_', ' ');
}

function formatExactTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatRelativeTimestamp(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 10) return 'Just now';
  if (elapsedSeconds < 60) return `${elapsedSeconds} seconds ago`;

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
const inputClass =
  'h-11 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm outline-none focus:border-[#54247a]';

function fieldErrorsForLoadingPointError(code: string | undefined, message: string) {
  if (
    ['LOADING_POINT_PRODUCT_INVALID', 'LOADING_POINT_PRODUCT_INCOMPATIBLE', 'LOADING_POINT_PACKAGING_UNSUPPORTED'].includes(
      code ?? '',
    )
  ) {
    return { productId: message };
  }
  if (code === 'LOADING_POINT_CAPACITY_INVALID') return { capacityTon: message };
  if (code === 'BAGGING_LINE_CAPACITY_INVALID') return { capacityTonPerHour: message };
  if (code === 'BAGGING_LINE_MAX_TRUCKS_INVALID') return { maxTrucks: message };
  return {};
}
