import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Truck,
  Warehouse,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ProductImage } from '../../components/customer/ProductImage';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  getCustomerLocations,
  type CustomerLocation,
} from '../../services/customerLocationsService';
import { getCustomerProducts, type CustomerProduct } from '../../services/customerProductsService';
import {
  createCustomerQuotation,
  getCustomerQuotation,
  getPickupLocations,
  submitCustomerQuotation,
  updateCustomerQuotation,
  type CustomerQuotation,
  type CustomerQuotationPayload,
  type PickupLocation,
  type QuotationFulfilmentType,
} from '../../services/customerQuotationsService';

type FormItem = {
  key: string;
  product: CustomerProduct | null;
  quantity: string;
  palletRequired: boolean;
  palletType: string;
  palletQuantity: string;
};

type FormState = {
  fulfilmentType: QuotationFulfilmentType;
  pickupLocationId: string;
  shipToLocationId: string;
  requestedDate: string;
  notes: string;
  items: FormItem[];
};

const draftStorageKey = 'alsafwa_customer_quotation_draft_id';
const writableRoles = new Set(['CUSTOMER_ADMIN', 'PURCHASER']);

const initialItem = (): FormItem => ({
  key: crypto.randomUUID(),
  product: null,
  quantity: '',
  palletRequired: false,
  palletType: '',
  palletQuantity: '',
});

const today = new Date().toISOString().slice(0, 10);

const initialForm: FormState = {
  fulfilmentType: 'DELIVERY',
  pickupLocationId: '',
  shipToLocationId: '',
  requestedDate: '',
  notes: '',
  items: [initialItem()],
};

export function CustomerQuotationNew() {
  const { user } = useCustomerAuth();
  const canManageQuotation = Boolean(user?.role && writableRoles.has(user.role));
  const [form, setForm] = useState<FormState>(initialForm);
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [quotation, setQuotation] = useState<CustomerQuotation | null>(null);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<CustomerLocation[]>([]);
  const [productResults, setProductResults] = useState<CustomerProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedShipTo = deliveryLocations.find(
    (location) => location.id === form.shipToLocationId,
  );
  const selectedPickup = pickupLocations.find((location) => location.id === form.pickupLocationId);
  const hasCoordinates =
    typeof selectedShipTo?.latitude === 'number' && typeof selectedShipTo.longitude === 'number';

  const validationErrors = useMemo(() => validateForm(form), [form]);
  const isValid = validationErrors.length === 0;

  useEffect(() => {
    const loadFoundation = async () => {
      setLoading(true);
      setError('');

      try {
        const [pickup, locations] = await Promise.all([
          getPickupLocations(),
          getCustomerLocations(),
        ]);
        setPickupLocations(pickup);
        setDeliveryLocations(locations);
        setForm((current) => ({
          ...current,
          pickupLocationId: current.pickupLocationId || pickup[0]?.id || '',
          shipToLocationId:
            current.shipToLocationId || locations.find((location) => location.isPrimary)?.id || '',
        }));

        const draftId = localStorage.getItem(draftStorageKey);
        if (draftId) {
          const draft = await getCustomerQuotation(draftId);
          if (draft.status === 'DRAFT') {
            setQuotationId(draft.id);
            setQuotation(draft);
            setForm(fromQuotation(draft));
          } else {
            localStorage.removeItem(draftStorageKey);
          }
        }
      } catch {
        setError('Unable to load quotation setup. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadFoundation();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setProductsLoading(true);
      try {
        const result = await getCustomerProducts({ search: productSearch });
        setProductResults(result.items);
      } catch {
        setProductResults([]);
      } finally {
        setProductsLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [productSearch]);

  if (!canManageQuotation) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
        You can view customer portal information, but your role cannot create quotations.
      </section>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (quotation?.status === 'PENDING_SALES_REVIEW') {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-slate-950">Quotation Submitted</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">
          Your quotation request has been submitted for Sales review.
        </p>
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
          Reference: {quotation.reference ?? 'Pending reference'}
        </p>
        <Link
          to="/customer/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#54247a] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#462064]"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const saveDraft = async () => {
    setError('');
    setSuccess('');

    if (!isValid) {
      setError(validationErrors[0] ?? 'Please complete the quotation form.');
      return;
    }

    setSaving(true);
    try {
      const payload = toPayload(form);
      const saved = quotationId
        ? await updateCustomerQuotation(quotationId, payload)
        : await createCustomerQuotation(payload);

      setQuotationId(saved.id);
      setQuotation(saved);
      localStorage.setItem(draftStorageKey, saved.id);
      setSuccess('Draft saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save quotation draft.');
    } finally {
      setSaving(false);
    }
  };

  const submitQuotation = async () => {
    setError('');
    setSuccess('');

    if (!isValid) {
      setError(validationErrors[0] ?? 'Please complete the quotation form.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = toPayload(form);
      const saved = quotationId
        ? await updateCustomerQuotation(quotationId, payload)
        : await createCustomerQuotation(payload);
      const submitted = await submitCustomerQuotation(saved.id);

      setQuotationId(submitted.id);
      setQuotation(submitted);
      localStorage.removeItem(draftStorageKey);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to submit quotation request.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const addProduct = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, initialItem()],
    }));
  };

  const updateItem = (key: string, patch: Partial<FormItem>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  };

  const removeItem = (key: string) => {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((item) => item.key !== key),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7c3b7e]">
            Customer Portal
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">New Quotation</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
            Select fulfilment, products, delivery location, and requested date.
          </p>
        </div>
        {quotationId && (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
            Draft saved in progress
          </span>
        )}
      </div>

      {error && <InlineAlert tone="error" message={error} />}
      {success && <InlineAlert tone="success" message={success} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-base font-bold text-slate-950">Fulfilment</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <SegmentButton
                active={form.fulfilmentType === 'PICKUP'}
                icon={<Warehouse size={17} />}
                title="Pick-Up"
                description="Use your own truck to collect."
                onClick={() => setForm((current) => ({ ...current, fulfilmentType: 'PICKUP' }))}
              />
              <SegmentButton
                active={form.fulfilmentType === 'DELIVERY'}
                icon={<Truck size={17} />}
                title="Delivery (Hader)"
                description="AlSafwa ships to your site."
                onClick={() => setForm((current) => ({ ...current, fulfilmentType: 'DELIVERY' }))}
              />
            </div>
          </div>

          {form.fulfilmentType === 'PICKUP' && (
            <Field label="Pickup From">
              <select
                value={form.pickupLocationId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, pickupLocationId: event.target.value }))
                }
                className={fieldClass}
              >
                {pickupLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} — {location.city}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label={form.fulfilmentType === 'PICKUP' ? 'Ship-To / Destination' : 'Delivery Location'}
          >
            <select
              value={form.shipToLocationId}
              onChange={(event) =>
                setForm((current) => ({ ...current, shipToLocationId: event.target.value }))
              }
              className={fieldClass}
            >
              <option value="">Select delivery location</option>
              {deliveryLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} — {location.city}, {location.region}
                </option>
              ))}
            </select>
          </Field>

          {selectedShipTo && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{selectedShipTo.name}</p>
                  <p className="mt-1 font-medium text-slate-500">
                    {selectedShipTo.streetAddress}, {selectedShipTo.city}, {selectedShipTo.region}
                  </p>
                </div>
                {hasCoordinates && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${selectedShipTo.latitude}&mlon=${selectedShipTo.longitude}#map=16/${selectedShipTo.latitude}/${selectedShipTo.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#54247a] hover:bg-[#f6f2fa]"
                  >
                    <MapPin size={14} />
                    View Map
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-950">Products</h2>
              <button
                type="button"
                onClick={addProduct}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Plus size={15} />
                Add Product
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {form.items.map((item, index) => (
                <ProductLine
                  key={item.key}
                  item={item}
                  index={index}
                  products={productResults}
                  productsLoading={productsLoading}
                  productSearch={productSearch}
                  canRemove={form.items.length > 1}
                  onSearchChange={setProductSearch}
                  onChange={(patch) => updateItem(item.key, patch)}
                  onRemove={() => removeItem(item.key)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
            <Field label="Requested Delivery Date">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  min={today}
                  value={form.requestedDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, requestedDate: event.target.value }))
                  }
                  className={`${fieldClass} pl-10`}
                />
              </div>
            </Field>
            <Field label="Notes">
              <input
                value={form.notes}
                maxLength={1000}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional instructions"
                className={fieldClass}
              />
            </Field>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-20">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-[#54247a]" />
            <h2 className="text-base font-bold text-slate-950">Quotation Summary</h2>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <SummaryRow
              label="Fulfilment"
              value={form.fulfilmentType === 'PICKUP' ? 'Pick-Up' : 'Delivery'}
            />
            {form.fulfilmentType === 'PICKUP' && (
              <SummaryRow label="Pickup From" value={selectedPickup?.name || 'Not selected'} />
            )}
            <SummaryRow label="Ship-To" value={selectedShipTo?.name || 'Not selected'} />
            <SummaryRow label="Requested Date" value={form.requestedDate || 'Not selected'} />
          </dl>

          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            {form.items.map((item) => (
              <div key={item.key} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                <ProductImage
                  image={item.product?.image}
                  productName={item.product?.productName ?? 'Selected product'}
                  size="summary"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">
                    {item.product?.productName ?? 'No product selected'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {item.product
                      ? `${item.product.productCode} · ${item.product.packagingType} · ${item.product.uom}`
                      : 'Select product to continue'}
                  </p>
                  <p className="mt-2 text-xs font-bold text-[#54247a]">
                    Qty: {item.quantity || '0'} {item.product?.uom ?? ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {validationErrors.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              {validationErrors.slice(0, 4).map((message) => (
                <li key={message}>• {message}</li>
              ))}
            </ul>
          )}

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={() => void submitQuotation()}
              disabled={saving || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#462064] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
              {submitting ? 'Submitting...' : 'Submit Quotation'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

const fieldClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10';

function ProductLine({
  item,
  index,
  products,
  productsLoading,
  productSearch,
  canRemove,
  onSearchChange,
  onChange,
  onRemove,
}: {
  item: FormItem;
  index: number;
  products: CustomerProduct[];
  productsLoading: boolean;
  productSearch: string;
  canRemove: boolean;
  onSearchChange: (value: string) => void;
  onChange: (patch: Partial<FormItem>) => void;
  onRemove: () => void;
}) {
  const isBagProduct = item.product?.packagingType.toLowerCase().includes('bag') ?? false;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-950">Product {index + 1}</h3>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div>
          <input
            value={productSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search product name or code"
            className={fieldClass}
          />
          <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
            {productsLoading ? (
              <div className="flex items-center gap-2 p-3 text-sm font-semibold text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <p className="p-3 text-sm font-semibold text-slate-500">No active products found.</p>
            ) : (
              products.map((product) => {
                const selected = item.product?.id === product.id;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        product,
                        palletRequired: product.packagingType.toLowerCase().includes('bag')
                          ? item.palletRequired
                          : false,
                      })
                    }
                    className={`flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-b-0 hover:bg-[#fdfafd] ${
                      selected ? 'bg-[#f6f2fa]' : 'bg-white'
                    }`}
                  >
                    <ProductImage
                      image={product.image}
                      productName={product.productName}
                      size="thumbnail"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-950">
                        {product.productName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
                        {product.productCode} · {product.packagingType} · {product.uom}
                      </span>
                    </span>
                    {selected && <ChevronRight className="ml-auto h-4 w-4 text-[#54247a]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Quantity">
            <input
              type="number"
              min="0"
              step="0.001"
              value={item.quantity}
              onChange={(event) => onChange({ quantity: event.target.value })}
              placeholder={item.product?.uom ?? 'Qty'}
              className={fieldClass}
            />
          </Field>
          <ReadOnlyMeta label="Packaging" value={item.product?.packagingType ?? 'Auto'} />
          <ReadOnlyMeta label="UOM" value={item.product?.uom ?? 'Auto'} />
        </div>
      </div>

      {isBagProduct && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <input
              type="checkbox"
              checked={item.palletRequired}
              onChange={(event) => onChange({ palletRequired: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-[#54247a] focus:ring-[#54247a]"
            />
            Pallet Required
          </label>
          {item.palletRequired && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={item.palletType}
                onChange={(event) => onChange({ palletType: event.target.value })}
                placeholder="Pallet type"
                className={fieldClass}
              />
              <input
                type="number"
                min="1"
                value={item.palletQuantity}
                onChange={(event) => onChange({ palletQuantity: event.target.value })}
                placeholder="Pallet quantity"
                className={fieldClass}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SegmentButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-[#54247a] bg-[#f6f2fa] text-[#54247a] shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-bold">
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-xs font-semibold text-slate-500">{description}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-900">{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="text-right font-bold text-slate-900">{value}</dd>
    </div>
  );
}

function InlineAlert({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const isError = tone === 'error';
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
        isError
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {isError ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
      {message}
    </div>
  );
}

function validateForm(form: FormState) {
  const errors: string[] = [];

  if (form.fulfilmentType === 'PICKUP' && !form.pickupLocationId) {
    errors.push('Pickup location is required.');
  }
  if (!form.shipToLocationId) errors.push('Ship-to location is required.');
  if (!form.requestedDate) errors.push('Requested date is required.');
  if (form.requestedDate && form.requestedDate < today) {
    errors.push('Requested date cannot be in the past.');
  }

  form.items.forEach((item, index) => {
    const label = `Product ${index + 1}`;
    if (!item.product) errors.push(`${label} is required.`);
    if (!item.quantity || Number(item.quantity) <= 0) {
      errors.push(`${label} quantity must be greater than zero.`);
    }
    if (item.palletRequired && !item.palletType.trim()) {
      errors.push(`${label} pallet type is required.`);
    }
    if (item.palletRequired && (!item.palletQuantity || Number(item.palletQuantity) <= 0)) {
      errors.push(`${label} pallet quantity is required.`);
    }
  });

  if (form.notes.length > 1000) errors.push('Notes must be 1000 characters or fewer.');

  return errors;
}

function toPayload(form: FormState): CustomerQuotationPayload {
  const payload: CustomerQuotationPayload = {
    fulfilmentType: form.fulfilmentType,
    shipToLocationId: form.shipToLocationId,
    requestedDate: form.requestedDate,
    items: form.items.map((item) => ({
      productId: item.product?.id ?? '',
      quantity: Number(item.quantity),
      palletRequired: item.palletRequired,
    })),
  };

  if (form.fulfilmentType === 'PICKUP') {
    Object.assign(payload, { pickupLocationId: form.pickupLocationId });
  }

  const notes = form.notes.trim();
  if (notes) {
    Object.assign(payload, { notes });
  }

  payload.items = form.items.map((item) => {
    const line: CustomerQuotationPayload['items'][number] = {
      productId: item.product?.id ?? '',
      quantity: Number(item.quantity),
      palletRequired: item.palletRequired,
    };

    if (!item.palletRequired) return line;

    return {
      ...line,
      palletType: item.palletType.trim(),
      palletQuantity: Number(item.palletQuantity),
    };
  });

  return payload;
}

function fromQuotation(quotation: CustomerQuotation): FormState {
  return {
    fulfilmentType: quotation.fulfilmentType,
    pickupLocationId: quotation.pickupLocationId ?? '',
    shipToLocationId: quotation.shipToLocationId ?? '',
    requestedDate: quotation.requestedDate ?? '',
    notes: quotation.notes ?? '',
    items: quotation.items.map((item) => ({
      key: item.id,
      product: {
        ...item.product,
        displayOrder: 0,
        isActive: true,
        createdAt: quotation.createdAt,
        updatedAt: quotation.updatedAt,
      },
      quantity: String(item.quantity),
      palletRequired: item.palletRequired,
      palletType: item.palletType ?? '',
      palletQuantity: item.palletQuantity ? String(item.palletQuantity) : '',
    })),
  };
}
