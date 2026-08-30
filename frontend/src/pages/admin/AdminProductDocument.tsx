import {
  Check,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AsyncCreatableTomSelect,
  type AsyncSelectOption,
} from '../../components/ui/AsyncCreatableTomSelect';
import {
  AdminProductsApiError,
  createAdminBagSize,
  createAdminProduct,
  getAdminProduct,
  listAdminBagSizes,
  saveAdminProductPrice,
  updateAdminProduct,
  type AdminProduct,
  type ProductCity,
  type ProductInput,
  type ProductPrice,
} from '../../services/adminProductsService';

interface ProductForm {
  productCode: string;
  productName: string;
  description: string;
  image: string;
  packaging: string;
  uom: string;
  unitWeightKg: string;
  isWhiteCement: boolean;
  isActive: boolean;
  displayOrder: string;
}

const emptyForm: ProductForm = {
  productCode: '',
  productName: '',
  description: '',
  image: '',
  packaging: 'Bag',
  uom: '50KG_BAG',
  unitWeightKg: '50',
  isWhiteCement: false,
  isActive: true,
  displayOrder: '0',
};

export function AdminProductDocument() {
  const { id } = useParams();
  const creating = !id || id === 'create';
  const navigate = useNavigate();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [cities, setCities] = useState<ProductCity[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [loading, setLoading] = useState(!creating);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceCityId, setPriceCityId] = useState('');
  const [priceValue, setPriceValue] = useState('');
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const load = useCallback(async () => {
    if (creating || !id) return;
    setLoading(true);
    setError('');
    try {
      const result = await getAdminProduct(id);
      setProduct(result.product);
      setPrices(result.prices);
      setCities(result.cities);
      setPriceCityId((current) => current || result.cities[0]?.id || '');
      setForm(toForm(result.product));
      setImagePreviewUrl('');
      setDirty(false);
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setLoading(false);
    }
  }, [creating, id]);

  useEffect(() => void load(), [load]);

  const change = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setDirty(true);
    setNotice('');
  };

  const persist = useCallback(async () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const payload: ProductInput = {
      ...(creating ? {} : { productCode: form.productCode.trim() }),
      productName: form.productName.trim(),
      description: form.description.trim() || null,
      image: form.image.trim() || null,
      productType: deriveProductType(form),
      packaging: form.packaging,
      uom: form.uom,
      unitWeightKg: Number(form.unitWeightKg),
      isWhiteCement: form.isWhiteCement,
      isActive: form.isActive,
      displayOrder: Number(form.displayOrder || 0),
    };
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (creating) {
        const created = await createAdminProduct(payload);
        setNotice('Saved successfully');
        navigate(`/admin/products/${created.id}`, { replace: true });
      } else if (id) {
        const updated = await updateAdminProduct(id, payload);
        setProduct(updated);
        setForm(toForm(updated));
        setImagePreviewUrl('');
        setDirty(false);
        setNotice('Saved successfully');
      }
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setSaving(false);
    }
  }, [creating, form, id, navigate]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (!saving && (creating || dirty)) void persist();
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [creating, dirty, persist, saving]);

  const savePrice = async () => {
    const nextErrors: Record<string, string> = {};
    if (!priceCityId) nextErrors.city = 'Select a city.';
    if (!positive(priceValue)) nextErrors.price = 'Price must be greater than zero.';
    setPriceErrors(nextErrors);
    if (Object.keys(nextErrors).length || !id) return;
    setSaving(true);
    setError('');
    try {
      await saveAdminProductPrice(id, priceCityId, Number(priceValue));
      setPriceValue('');
      setPriceOpen(false);
      setNotice('Saved successfully');
      await load();
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((current) => ({ ...current, image: 'Use a JPG, PNG or WebP image.' }));
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(file));
    change('image', `/products/${safeProductImageFilename(file.name)}`);
  };

  const removeImage = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl('');
    change('image', '');
  };

  const title = creating ? 'New Product' : product?.productName ?? 'Product';
  const status = creating ? 'Draft' : product?.isActive ? 'Active' : 'Inactive';

  if (loading) {
    return (
      <div className="customer-muted flex min-h-64 items-center justify-center text-sm">
        <Loader2 size={18} className="mr-2 animate-spin" /> Loading product...
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-[1400px] space-y-4 overflow-hidden">
      <Breadcrumb productName={creating ? undefined : product?.productName} creating={creating} />

      <div className="customer-border-soft flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="customer-text text-2xl font-bold">{title}</h1>
            <Status value={status} />
          </div>
          {product && (
            <div className="customer-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span>
                Product code: <strong className="customer-text">{product.productCode}</strong>
              </span>
              <span aria-hidden="true">•</span>
              <span>
                Last updated: {dateTime(product.updatedAt)} by{' '}
                <strong className="customer-text">{product.updatedBy}</strong>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void persist()}
            disabled={saving || (!creating && !dirty)}
            className={primaryButton}
          >
            Save
          </button>
        </div>
      </div>

      {error && <Message error>{error}</Message>}
      {notice && <Message>{notice}</Message>}

      <section className={section}>
        <SectionTitle title="Product Information" />
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,800px)]">
          <div>
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              className="customer-surface-secondary customer-border group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border text-left transition hover:border-[var(--customer-primary)] hover:bg-[var(--customer-primary-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary-soft)]"
            >
              {imagePreviewUrl || form.image ? (
                <img
                  src={imagePreviewUrl || form.image}
                  alt={form.productName || 'Product'}
                  className="h-full w-full object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="flex flex-col items-center gap-2 text-center">
                  <span className="customer-surface customer-border flex h-14 w-14 items-center justify-center rounded-xl border">
                    <ImageIcon size={26} className="customer-muted" />
                  </span>
                  <span className="customer-text text-sm font-semibold">Click to upload product image</span>
                  <span className="customer-muted text-xs">JPG, PNG or WebP</span>
                </span>
              )}
              {form.image && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Remove product image"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeImage();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    event.stopPropagation();
                    removeImage();
                  }}
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-black/60 text-white opacity-90 shadow-sm transition hover:bg-[var(--customer-danger)]"
                >
                  <X size={16} />
                </span>
              )}
            </button>
            <p className="customer-muted mt-2 text-xs">
              Click the image area to upload or replace. The image is saved as a product asset
              reference.
            </p>
            {errors.image && (
              <p className="mt-1 text-xs font-medium text-[var(--customer-danger)]">{errors.image}</p>
            )}
            <input
              ref={uploadRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                handleImageUpload(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </div>

          <div className="grid content-start gap-4 md:grid-cols-[minmax(160px,220px)_minmax(180px,260px)_minmax(150px,200px)]">
            <div className="max-w-[640px] md:col-span-3">
              <Field label="Product Name" required error={errors.productName}>
                <input
                  className={input}
                  value={form.productName}
                  onChange={(event) => change('productName', event.target.value)}
                />
              </Field>
            </div>
            <Field label="Packaging" required error={errors.packaging}>
              <select
                className={input}
                value={form.packaging}
                onChange={(event) => {
                  const packaging = event.target.value;
                  change('packaging', packaging);
                  if (packaging.toLowerCase().includes('bulk')) {
                    change('uom', 'TON');
                    change('unitWeightKg', '1000');
                  }
                }}
              >
                <option value="Bag">Bag</option>
                <option value="Bulk">Bulk</option>
              </select>
            </Field>
            {isBagPackaging(form.packaging) && (
              <Field label="Bag Size" required error={errors.unitWeightKg}>
                <AsyncCreatableTomSelect
                  value={form.unitWeightKg}
                  placeholder="Select or create bag size"
                  loadOptions={loadBagSizeOptions}
                  normalizeCreate={normalizeBagSizeOption}
                  createOption={persistBagSizeOption}
                  onChange={(weight) => {
                    change('unitWeightKg', weight);
                    if (weight) change('uom', `${trimNumber(weight)}KG_BAG`);
                  }}
                />
              </Field>
            )}
            <Field label="Commercial UOM">
              <input className={`${input} customer-muted`} value="TON" readOnly />
            </Field>
            <div className="customer-surface-secondary customer-border-soft flex flex-wrap gap-x-8 gap-y-3 rounded-lg border p-3 md:col-span-3">
              <CheckboxField
                checked={form.isWhiteCement}
                label="White Cement"
                description="Use the white-cement delivery pricing category."
                onChange={(checked) => change('isWhiteCement', checked)}
              />
              <CheckboxField
                checked={form.isActive}
                label="Active product"
                description="Available to customers and operational modules."
                onChange={(checked) => change('isActive', checked)}
              />
            </div>
            <p className="customer-muted md:col-span-3 text-xs">
              Commercial quantity and pricing remain SAR / TON. Bag size is used internally for
              loading compatibility and equivalent bag calculations.
            </p>
          </div>
        </div>
      </section>

      <section className={section}>
        <SectionTitle title="Description" />
        <Field label="Product Description">
          <textarea
            className={`${input} min-h-36 resize-y py-3`}
            value={form.description}
            maxLength={2000}
            placeholder="Describe the product, its intended use, and key customer-facing details."
            onChange={(event) => change('description', event.target.value)}
          />
        </Field>
        <p className="customer-muted mt-2 text-right text-xs">{form.description.length} / 2000</p>
      </section>

      <section className={section}>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle title="Pricing" noMargin />
          <button disabled={creating} onClick={() => setPriceOpen(true)} className={secondaryButton}>
            <Plus size={15} /> Add Price
          </button>
        </div>
        {creating ? (
          <p className="customer-surface-secondary customer-muted mt-4 rounded-lg p-4 text-sm">
            Save the product before adding city pricing.
          </p>
        ) : (
          <>
            <p className="customer-muted mt-2 text-xs">
              Product list price is customer-facing cement pricing in SAR / TON. Delivery pricing
              remains separate.
            </p>
            {priceOpen && (
              <div className="customer-surface-secondary customer-border mt-4 grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_auto_auto]">
                <Field label="City" error={priceErrors.city}>
                  <select
                    className={input}
                    value={priceCityId}
                    onChange={(event) => {
                      setPriceCityId(event.target.value);
                      setPriceErrors((current) => ({ ...current, city: '' }));
                    }}
                  >
                    <option value="">Select city</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="List Price" suffix="SAR / TON" error={priceErrors.price}>
                  <input
                    className={input}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={priceValue}
                    onChange={(event) => {
                      setPriceValue(event.target.value);
                      if (positive(event.target.value)) {
                        setPriceErrors((current) => ({ ...current, price: '' }));
                      }
                    }}
                  />
                </Field>
                <button onClick={() => void savePrice()} className={`${primaryButton} self-end`}>
                  Save Price
                </button>
                <button onClick={() => setPriceOpen(false)} className={`${iconButton} self-end`}>
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="customer-border mt-4 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="customer-surface-secondary customer-secondary text-left text-xs">
                  <tr>
                    <th className={cell}>S.No.</th>
                    <th className={cell}>City</th>
                    <th className={`${cell} text-right`}>List Price (SAR / TON)</th>
                    <th className={cell}>Status</th>
                    <th className={cell}>Last Updated</th>
                    <th className={cell}>Updated By</th>
                    <th className={cell}>Actions</th>
                  </tr>
                </thead>
                <tbody className="customer-border-soft divide-y">
                  {prices.length ? (
                    prices.map((price, index) => (
                      <tr key={price.id} className="hover:bg-[var(--customer-surface-secondary)]">
                        <td className={cell}>{index + 1}</td>
                        <td className={`${cell} font-semibold`}>{price.city}</td>
                        <td className={`${cell} text-right font-bold`}>{money(price.listPrice)}</td>
                        <td className={cell}>
                          <Status value={price.isActive ? 'Active' : 'Inactive'} />
                        </td>
                        <td className={`${cell} customer-muted text-xs`}>
                          {dateTime(price.updatedAt)}
                        </td>
                        <td className={cell}>{price.updatedBy}</td>
                        <td className={cell}>
                          <button
                            onClick={() => {
                              setPriceCityId(price.cityId);
                              setPriceValue(String(price.listPrice));
                              setPriceOpen(true);
                            }}
                            className="customer-primary text-xs font-semibold hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="customer-muted p-8 text-center">
                        No city prices configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div
        aria-hidden={!saving}
        className={`pointer-events-none absolute inset-0 z-30 flex justify-center bg-black/10 pt-32 backdrop-blur-[1px] transition-opacity ${
          saving ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="customer-card flex h-12 items-center gap-2 rounded-lg border px-4 text-sm font-semibold">
          <Loader2 size={17} className="customer-primary animate-spin" /> Saving changes...
        </div>
      </div>
    </div>
  );
}

function Breadcrumb({ productName, creating }: { productName: string | undefined; creating: boolean }) {
  return (
    <nav className="customer-muted flex items-center gap-1.5 text-xs">
      <Link to="/admin/products" className="hover:text-[var(--customer-primary)]">
        Products
      </Link>
      <ChevronRight size={13} />
      <span className="customer-primary font-semibold">{creating ? 'New Product' : productName}</span>
    </nav>
  );
}
function SectionTitle({ title, noMargin }: { title: string; noMargin?: boolean }) {
  return (
    <h2
      className={`${noMargin ? '' : 'customer-border-soft mb-4 border-b pb-3'} customer-primary text-sm font-bold`}
    >
      {title}
    </h2>
  );
}
function Field({
  label,
  required,
  suffix,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  suffix?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label>
      {label && (
        <span className="customer-text mb-1.5 flex justify-between text-xs font-semibold">
          <span>
            {label}
            {required && <span className="ml-1 text-[var(--customer-danger)]">*</span>}
          </span>
          {suffix && <span className="customer-muted font-medium">{suffix}</span>}
        </span>
      )}
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-[var(--customer-danger)]">{error}</span>}
    </label>
  );
}
function CheckboxField({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-w-[220px] flex-1 cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#54247a]"
      />
      <span>
        <span className="customer-text block text-sm font-semibold">{label}</span>
        <span className="customer-muted mt-0.5 block text-xs font-normal">{description}</span>
      </span>
    </label>
  );
}
function Status({ value }: { value: 'Draft' | 'Active' | 'Inactive' }) {
  const style =
    value === 'Active'
      ? 'text-[var(--customer-success)]'
      : value === 'Draft'
        ? 'text-[var(--customer-warning)]'
        : 'customer-muted';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {value}
    </span>
  );
}
function Message({ error, children }: { error?: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
        error
          ? 'border-red-200 bg-red-50 text-[#b42318]'
          : 'border-emerald-200 bg-emerald-50 text-[#0f8b5f]'
      }`}
    >
      {error ? <X size={16} /> : <Check size={16} />}
      {children}
    </div>
  );
}
function validate(form: ProductForm) {
  const errors: Record<string, string> = {};
  if (!form.productName.trim()) errors.productName = 'Product name is required.';
  if (!form.packaging) errors.packaging = 'Packaging is required.';
  if (!positive(form.unitWeightKg)) {
    errors.unitWeightKg =
      form.packaging === 'Bag'
        ? 'Bag size is required for bagged products.'
        : 'Unit weight must be greater than zero.';
  }
  return errors;
}
function toForm(product: AdminProduct): ProductForm {
  return {
    productCode: product.productCode,
    productName: product.productName,
    description: product.description ?? '',
    image: product.image ?? '',
    packaging: product.packaging,
    uom: product.uom,
    unitWeightKg: String(product.unitWeightKg),
    isWhiteCement: product.isWhiteCement,
    isActive: product.isActive,
    displayOrder: String(product.displayOrder),
  };
}
function deriveProductType(form: ProductForm) {
  if (form.isWhiteCement) return 'White Cement';
  return form.packaging === 'Bulk' ? 'Bulk Cement' : 'Bag Cement';
}
function safeError(error: unknown) {
  return error instanceof AdminProductsApiError
    ? error.message
    : 'Unable to complete the product request.';
}
function positive(value: string) {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
}
function isBagPackaging(packaging: string) {
  return packaging.toLowerCase().includes('bag');
}
function normalizeBagSizeOption(input: string): AsyncSelectOption | null {
  const match = input.match(/^\s*(\d+(?:\.\d{1,3})?)\s*(?:kg)?\s*$/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const value = trimNumber(String(parsed));
  return { value, label: `${value} KG` };
}
async function loadBagSizeOptions(query: string, signal: AbortSignal) {
  const bagSizes = await listAdminBagSizes(query, signal);
  return bagSizes.map((bagSize) => ({
    value: trimNumber(String(bagSize.unitWeightKg)),
    label: bagSize.label,
  }));
}
async function persistBagSizeOption(option: AsyncSelectOption) {
  const bagSize = await createAdminBagSize(Number(option.value));
  return {
    value: trimNumber(String(bagSize.unitWeightKg)),
    label: bagSize.label,
  };
}
function trimNumber(value: string) {
  return String(Number(value));
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
function money(value: number) {
  return new Intl.NumberFormat('en-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
function safeProductImageFilename(fileName: string) {
  const safeName = fileName
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
  return safeName || 'product-image.png';
}
const section = 'customer-card rounded-xl border p-4';
const input =
  'customer-input customer-border customer-text h-10 w-full rounded-lg border px-3 text-sm outline-none transition placeholder:text-[var(--customer-text-muted)] focus:border-[var(--customer-primary)] focus:ring-2 focus:ring-[var(--customer-primary-soft)]';
const primaryButton =
  'customer-primary-bg inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButton =
  'customer-surface customer-border customer-secondary inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition hover:bg-[var(--customer-surface-secondary)] hover:text-[var(--customer-primary)] disabled:opacity-40';
const iconButton =
  'customer-surface customer-border customer-secondary inline-flex h-10 w-10 items-center justify-center rounded-lg border transition hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)]';
const cell = 'px-3 py-2.5';
