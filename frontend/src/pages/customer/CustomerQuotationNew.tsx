import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
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
  const [showValidation, setShowValidation] = useState(false);

  const selectedShipTo = deliveryLocations.find(
    (location) => location.id === form.shipToLocationId,
  );
  const hasCoordinates =
    typeof selectedShipTo?.latitude === 'number' && typeof selectedShipTo.longitude === 'number';

  const validationErrors = useMemo(() => validateForm(form), [form]);
  const itemTotals = useMemo(() => getItemTotals(form.items), [form.items]);
  const requestedDateError = showValidation ? getRequestedDateError(form) : '';
  const shipToError =
    showValidation && !form.shipToLocationId ? 'Delivery location is required.' : '';
  const pickupError =
    showValidation && form.fulfilmentType === 'PICKUP' && !form.pickupLocationId
      ? 'Pickup location is required.'
      : '';
  const isValid = validationErrors.length === 0;
  const isSubmitted = quotation?.status === 'PENDING_SALES_REVIEW';
  const documentTitle = quotation?.reference ?? 'New Quotation';
  const statusLabel = isSubmitted ? 'Pending Sales Review' : 'Draft';

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
        <div className="mt-5 h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const saveDraft = async () => {
    setError('');
    setSuccess('');
    setShowValidation(true);

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
    setShowValidation(true);

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
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <span>Quotation</span>
              <span className="text-slate-300">/</span>
              <span className="text-[#7c3b7e]">{documentTitle}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-xl font-bold text-slate-950">{documentTitle}</h1>
              <StatusIndicator status={statusLabel} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSubmitted ? (
              <Link
                to="/customer/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={saving || submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => void submitQuotation()}
                  disabled={saving || submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#462064] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 px-4 pt-4 sm:px-5">
          {error && <InlineAlert tone="error" message={error} />}
          {success && <InlineAlert tone="success" message={success} />}
          {isSubmitted && (
            <InlineAlert
              tone="success"
              message="This quotation has been submitted for Sales review and is now read-only."
            />
          )}
        </div>

        <section className="space-y-5 p-4 sm:p-5">
          <div>
            <h2 className="text-base font-bold text-slate-950">Details</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Select fulfilment, delivery location, products, and requested delivery date.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-950">Fulfilment</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <SegmentButton
                active={form.fulfilmentType === 'PICKUP'}
                icon={<Warehouse size={17} />}
                title="Pick-Up"
                description="Use your own truck to collect."
                disabled={isSubmitted}
                onClick={() => setForm((current) => ({ ...current, fulfilmentType: 'PICKUP' }))}
              />
              <SegmentButton
                active={form.fulfilmentType === 'DELIVERY'}
                icon={<Truck size={17} />}
                title="Delivery (Hader)"
                description="AlSafwa ships to your site."
                disabled={isSubmitted}
                onClick={() => setForm((current) => ({ ...current, fulfilmentType: 'DELIVERY' }))}
              />
            </div>
          </div>

          {form.fulfilmentType === 'PICKUP' && (
            <Field label="Pickup From">
              <select
                value={form.pickupLocationId}
                disabled={isSubmitted}
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
              {pickupError && <FieldError message={pickupError} />}
            </Field>
          )}

          <Field
            label={form.fulfilmentType === 'PICKUP' ? 'Ship-To / Destination' : 'Delivery Location'}
          >
            <select
              value={form.shipToLocationId}
              disabled={isSubmitted}
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
            {shipToError && <FieldError message={shipToError} />}
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
                disabled={isSubmitted}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={15} />
                Add Product
              </button>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
              <div className="hidden grid-cols-[44px_minmax(260px,1fr)_120px_120px_90px_190px_52px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500 xl:grid">
                <span>#</span>
                <span>Product</span>
                <span>Quantity</span>
                <span>Packaging</span>
                <span>UOM</span>
                <span>Pallet</span>
                <span></span>
              </div>
              {form.items.map((item, index) => (
                <ProductLine
                  key={item.key}
                  item={item}
                  index={index}
                  products={productResults}
                  productsLoading={productsLoading}
                  productSearch={productSearch}
                  canRemove={form.items.length > 1 && !isSubmitted}
                  readOnly={isSubmitted}
                  errors={showValidation ? getItemErrors(item, index) : {}}
                  onSearchChange={setProductSearch}
                  onChange={(patch) => updateItem(item.key, patch)}
                  onRemove={() => removeItem(item.key)}
                />
              ))}
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>Total Items: {form.items.length}</span>
                <span>{itemTotals.length > 0 ? itemTotals.join(' · ') : 'Total Quantity: 0'}</span>
              </div>
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
                  disabled={isSubmitted}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, requestedDate: event.target.value }))
                  }
                  className={`${fieldClass} pl-10`}
                />
              </div>
              {requestedDateError && <FieldError message={requestedDateError} />}
            </Field>
            <Field label="Notes">
              <input
                value={form.notes}
                maxLength={1000}
                disabled={isSubmitted}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional instructions"
                className={fieldClass}
              />
            </Field>
          </div>
        </section>
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
  readOnly,
  errors,
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
  readOnly: boolean;
  errors: Partial<Record<'product' | 'quantity' | 'palletType' | 'palletQuantity', string>>;
  onSearchChange: (value: string) => void;
  onChange: (patch: Partial<FormItem>) => void;
  onRemove: () => void;
}) {
  const isBagProduct = item.product?.packagingType.toLowerCase().includes('bag') ?? false;
  const [pickerOpen, setPickerOpen] = useState(!item.product);

  return (
    <div className="grid gap-3 border-b border-slate-100 bg-white px-4 py-4 last:border-b-0 xl:grid-cols-[44px_minmax(260px,1fr)_120px_120px_90px_190px_52px] xl:items-start">
      <div className="flex items-center justify-between gap-3 xl:block xl:pt-3">
        <h3 className="text-sm font-bold text-slate-500 xl:text-slate-500">{index + 1}</h3>
        {canRemove && !readOnly && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 xl:hidden"
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
      </div>

      <div className="grid gap-3 xl:contents">
        <div className="min-w-0">
          {item.product && !pickerOpen ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <ProductImage
                image={item.product.image}
                productName={item.product.productName}
                size="thumbnail"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-950">
                  {item.product.productName}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                  {item.product.productCode}
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-[#54247a] hover:bg-white"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <input
                value={productSearch}
                disabled={readOnly}
                onChange={(event) => {
                  onSearchChange(event.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                placeholder="Search product name or code"
                className={fieldClass}
              />
              {!readOnly && (
                <div className="absolute left-0 right-0 top-12 z-20 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
                  {productsLoading ? (
                    <div className="flex items-center gap-2 p-3 text-sm font-semibold text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading products...
                    </div>
                  ) : products.length === 0 ? (
                    <p className="p-3 text-sm font-semibold text-slate-500">
                      No active products found.
                    </p>
                  ) : (
                    products.map((product) => {
                      const selected = item.product?.id === product.id;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            onChange({
                              product,
                              palletRequired: product.packagingType.toLowerCase().includes('bag')
                                ? item.palletRequired
                                : false,
                            });
                            setPickerOpen(false);
                          }}
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
                          {selected && <CheckCircle2 className="ml-auto h-4 w-4 text-[#54247a]" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
          {errors.product && <FieldError message={errors.product} />}
        </div>

        <div className="grid gap-3 xl:contents">
          <Field label="Quantity">
            <input
              type="number"
              min="0"
              step="0.001"
              value={item.quantity}
              disabled={readOnly}
              onChange={(event) => onChange({ quantity: event.target.value })}
              placeholder="0"
              className={fieldClass}
            />
            {errors.quantity && <FieldError message={errors.quantity} />}
          </Field>
          <ReadOnlyMeta label="Packaging" value={item.product?.packagingType ?? 'Auto'} />
          <ReadOnlyMeta label="UOM" value={item.product?.uom ?? 'Auto'} />
        </div>
      </div>

      {isBagProduct && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <input
              type="checkbox"
              checked={item.palletRequired}
              disabled={readOnly}
              onChange={(event) => onChange({ palletRequired: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-[#54247a] focus:ring-[#54247a]"
            />
            Pallet Required
          </label>
          {item.palletRequired && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={item.palletType}
                disabled={readOnly}
                onChange={(event) => onChange({ palletType: event.target.value })}
                placeholder="Pallet type"
                className={fieldClass}
              />
              <input
                type="number"
                min="1"
                value={item.palletQuantity}
                disabled={readOnly}
                onChange={(event) => onChange({ palletQuantity: event.target.value })}
                placeholder="Pallet quantity"
                className={fieldClass}
              />
            </div>
          )}
          {(errors.palletType || errors.palletQuantity) && (
            <FieldError message={errors.palletType ?? errors.palletQuantity ?? ''} />
          )}
        </div>
      )}
      {!isBagProduct && (
        <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-400">
          Not applicable
        </div>
      )}
      <div className="hidden justify-end pt-1 xl:flex">
        {canRemove && !readOnly && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
            aria-label={`Remove product ${index + 1}`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  icon,
  title,
  description,
  disabled = false,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-[#54247a] bg-[#f6f2fa] text-[#54247a] shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      } disabled:cursor-not-allowed disabled:opacity-60`}
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
    <div className="flex min-h-11 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold text-slate-400 xl:hidden">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const submitted = status === 'Pending Sales Review';

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
      <span className={`h-2 w-2 rounded-full ${submitted ? 'bg-amber-500' : 'bg-slate-400'}`} />
      {status}
    </span>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="mt-1.5 text-xs font-semibold text-red-600">{message}</p>;
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

function getRequestedDateError(form: FormState) {
  if (!form.requestedDate) return 'Requested delivery date is required.';
  if (form.requestedDate < today) return 'Requested delivery date cannot be in the past.';
  return '';
}

function getItemErrors(item: FormItem, index: number) {
  const label = `Product ${index + 1}`;
  const errors: Partial<Record<'product' | 'quantity' | 'palletType' | 'palletQuantity', string>> =
    {};

  if (!item.product) errors.product = `${label} is required.`;
  if (!item.quantity || Number(item.quantity) <= 0) {
    errors.quantity = 'Quantity must be greater than zero.';
  }
  if (item.palletRequired && !item.palletType.trim()) {
    errors.palletType = 'Pallet type is required.';
  }
  if (item.palletRequired && (!item.palletQuantity || Number(item.palletQuantity) <= 0)) {
    errors.palletQuantity = 'Pallet quantity must be greater than zero.';
  }

  return errors;
}

function getItemTotals(items: FormItem[]) {
  const totals = new Map<string, number>();

  items.forEach((item) => {
    if (!item.product || !item.quantity || Number(item.quantity) <= 0) return;

    const current = totals.get(item.product.uom) ?? 0;
    totals.set(item.product.uom, current + Number(item.quantity));
  });

  return [...totals.entries()].map(([uom, total]) => `${total.toLocaleString()} ${uom}`);
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
