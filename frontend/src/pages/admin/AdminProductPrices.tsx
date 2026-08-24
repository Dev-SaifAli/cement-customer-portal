import { AlertCircle, Loader2, MapPin, Save, Truck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AdminPricingApiError,
  getPricingConfiguration,
  saveHaderDeliveryPrice,
  saveProductListPrice,
  setHaderCity,
  type PricingConfiguration,
} from '../../services/adminPricingService';

export function AdminProductPrices() {
  const [data, setData] = useState<PricingConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [productId, setProductId] = useState('');
  const [cityId, setCityId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [deliveryCityId, setDeliveryCityId] = useState('');
  const [standardDeliveryPrice, setStandardDeliveryPrice] = useState('');
  const [whiteCementDeliveryPrice, setWhiteCementDeliveryPrice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await getPricingConfiguration();
      setData(next);
      setProductId((current) => current || next.products[0]?.id || '');
      setCityId((current) =>
        next.cities.some((city) => city.id === current) ? current : next.cities[0]?.id || '',
      );
      setDeliveryCityId((current) =>
        next.haderCities.some((city) => city.id === current)
          ? current
          : next.haderCities[0]?.id || '',
      );
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  const selectedProduct = useMemo(
    () => data?.products.find((product) => product.id === productId) ?? null,
    [data, productId],
  );
  const selectedCity = data?.cities.find((item) => item.id === cityId) ?? null;
  const selectedDeliveryCity = data?.haderCities.find((item) => item.id === deliveryCityId) ?? null;

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProduct || !selectedCity || !positive(listPrice)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveProductListPrice(selectedProduct.id, {
        cityId: selectedCity.id,
        listPrice: Number(listPrice),
      });
      setNotice(`${selectedProduct.productCode} list price saved for ${selectedCity.name}.`);
      setListPrice('');
      await load();
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setSaving(false);
    }
  };

  const saveDelivery = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !selectedDeliveryCity ||
      !nonnegative(standardDeliveryPrice) ||
      !nonnegative(whiteCementDeliveryPrice)
    )
      return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveHaderDeliveryPrice({
        cityId: selectedDeliveryCity.id,
        standardDeliveryPrice: Number(standardDeliveryPrice),
        whiteCementDeliveryPrice: Number(whiteCementDeliveryPrice),
      });
      setNotice(`Hader delivery price saved for ${selectedDeliveryCity.name}.`);
      setStandardDeliveryPrice('');
      setWhiteCementDeliveryPrice('');
      await load();
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Product and Delivery Pricing</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Configure authoritative list prices by product, packaging, and city. Prices are SAR / TON.
        </p>
      </div>

      {error && <Message error>{error}</Message>}
      {notice && <Message>{notice}</Message>}
      {loading ? (
        <div className="flex min-h-52 items-center justify-center text-sm text-[#64748b]">
          <Loader2 className="mr-2 animate-spin" size={17} /> Loading pricing configuration...
        </div>
      ) : (
        <>
          <PricingSection title="Product Price Master">
            <form onSubmit={saveProduct} className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">
              <Field label="Product">
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className={input}
                >
                  {data?.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productCode} — {product.productName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="KSA City">
                <select
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  className={input}
                  required
                >
                  <option value="">Select KSA city</option>
                  {data?.cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="List Price (SAR / TON)">
                <input
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  className={input}
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </Field>
              <button disabled={saving || !selectedProduct} className={`${primaryButton} self-end`}>
                <Save size={15} /> Save Price
              </button>
            </form>
            {selectedProduct && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs text-[#64748b]">
                <span>
                  <strong className="text-[#1a1b23]">{selectedProduct.productCode}</strong>
                </span>
                <span>{selectedProduct.productName}</span>
                <span>
                  Packaging:{' '}
                  <strong className="text-[#1a1b23]">{selectedProduct.packagingType}</strong>
                </span>
                <span>
                  UOM: <strong className="text-[#1a1b23]">{selectedProduct.uom}</strong>
                </span>
              </div>
            )}
            <PriceTable data={data} />
          </PricingSection>

          <PricingSection title="Hader Delivery Price">
            <form onSubmit={saveDelivery} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <Field label="Hader City">
                <select
                  value={deliveryCityId}
                  onChange={(e) => setDeliveryCityId(e.target.value)}
                  className={input}
                  required
                >
                  <option value="">Select Hader city</option>
                  {data?.haderCities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Standard Delivery Price (SAR / TON)">
                <input
                  value={standardDeliveryPrice}
                  onChange={(e) => setStandardDeliveryPrice(e.target.value)}
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </Field>
              <Field label="White Cement Delivery Price (SAR / TON)">
                <input
                  value={whiteCementDeliveryPrice}
                  onChange={(e) => setWhiteCementDeliveryPrice(e.target.value)}
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </Field>
              <button disabled={saving} className={`${primaryButton} self-end`}>
                <Truck size={15} /> Save Delivery Price
              </button>
            </form>
            <DeliveryTable data={data} />
          </PricingSection>

          <PricingSection title="Hader City Configuration">
            <p className="mb-3 text-xs text-[#64748b]">
              Select which active KSA cities are available for Hader delivery pricing.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data?.cities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    setError('');
                    try {
                      await setHaderCity(city.id, !city.isHaderEnabled);
                      await load();
                    } catch (failure) {
                      setError(safeError(failure));
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${city.isHaderEnabled ? 'border-[#54247a] bg-[#f6f2fa] text-[#54247a]' : 'border-[#e3e1e8] bg-white text-[#64748b]'}`}
                >
                  <span className="flex items-center gap-2">
                    <MapPin size={14} />
                    {city.name}
                  </span>
                  <span className="text-xs font-semibold">
                    {city.isHaderEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </button>
              ))}
            </div>
          </PricingSection>
        </>
      )}
    </div>
  );
}

function PricingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e3e1e8] bg-white p-4">
      <h2 className="mb-4 border-b border-[#e3e1e8] pb-3 text-sm font-bold text-[#54247a]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PriceTable({ data }: { data: PricingConfiguration | null }) {
  const [productFilter, setProductFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [packagingFilter, setPackagingFilter] = useState('');
  const [uomFilter, setUomFilter] = useState('');
  const [page, setPage] = useState(1);
  const filtered = useMemo(
    () =>
      (data?.productPrices ?? []).filter((price) => {
        const product = data?.products.find((item) => item.id === price.productId);
        const productText =
          `${product?.productCode ?? ''} ${product?.productName ?? ''}`.toLowerCase();
        return (
          productText.includes(productFilter.toLowerCase()) &&
          (!cityFilter || price.cityId === cityFilter) &&
          (!packagingFilter || price.packagingType === packagingFilter) &&
          (!uomFilter || price.uom === uomFilter)
        );
      }),
    [cityFilter, data, packagingFilter, productFilter, uomFilter],
  );
  useEffect(() => setPage(1), [productFilter, cityFilter, packagingFilter, uomFilter]);
  const visible = filtered.slice((page - 1) * 10, page * 10);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const packaging = Array.from(
    new Set((data?.productPrices ?? []).map((item) => item.packagingType)),
  );
  const uoms = Array.from(new Set((data?.productPrices ?? []).map((item) => item.uom)));
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-[#e3e1e8]">
      <div className="grid gap-2 border-b border-[#e3e1e8] bg-[#f8fafc] p-2 md:grid-cols-4">
        <input
          aria-label="Filter product"
          placeholder="Product"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className={compactInput}
        />
        <select
          aria-label="Filter city"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className={compactInput}
        >
          <option value="">All cities</option>
          {data?.cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter packaging"
          value={packagingFilter}
          onChange={(e) => setPackagingFilter(e.target.value)}
          className={compactInput}
        >
          <option value="">All packaging</option>
          {packaging.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filter UOM"
          value={uomFilter}
          onChange={(e) => setUomFilter(e.target.value)}
          className={compactInput}
        >
          <option value="">All UOM</option>
          {uoms.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[#f8fafc] text-left text-xs text-[#64748b]">
            <tr>
              <th className={cell}>Product</th>
              <th className={cell}>Packaging</th>
              <th className={cell}>City</th>
              <th className={cell}>UOM</th>
              <th className={`${cell} text-right`}>List Price</th>
              <th className={cell}>Updated By</th>
              <th className={cell}>Updated At</th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((price) => {
                const product = data?.products.find((item) => item.id === price.productId);
                return (
                  <tr key={price.id} className="border-t border-[#e3e1e8]">
                    <td className={cell}>
                      <span className="font-bold">{product?.productCode}</span>
                      <span className="ml-2 text-xs text-[#64748b]">{product?.productName}</span>
                    </td>
                    <td className={cell}>{price.packagingType}</td>
                    <td className={cell}>{price.city}</td>
                    <td className={cell}>{price.uom}</td>
                    <td className={`${cell} text-right font-bold`}>{money(price.listPrice)} SAR</td>
                    <td className={cell}>{price.configuredBy}</td>
                    <td className={`${cell} whitespace-nowrap text-xs text-[#64748b]`}>
                      {formatDateTime(price.updatedAt)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#64748b]">
                  No product list prices configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > 10 && (
        <div className="flex items-center justify-between border-t border-[#e3e1e8] px-3 py-2 text-xs text-[#64748b]">
          <span>
            Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              className={pageButton}
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <span className="px-2 py-1">
              {page} / {pageCount}
            </span>
            <button
              className={pageButton}
              disabled={page === pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryTable({ data }: { data: PricingConfiguration | null }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-[#e3e1e8]">
      <table className="w-full min-w-[600px] text-sm">
        <thead className="bg-[#f8fafc] text-left text-xs text-[#64748b]">
          <tr>
            <th className={cell}>Hader City</th>
            <th className={`${cell} text-right`}>Standard SAR / TON</th>
            <th className={`${cell} text-right`}>White Cement SAR / TON</th>
            <th className={cell}>Updated By</th>
            <th className={cell}>Updated At</th>
          </tr>
        </thead>
        <tbody>
          {data?.deliveryPrices.length ? (
            data.deliveryPrices.map((price) => (
              <tr key={price.id} className="border-t border-[#e3e1e8]">
                <td className={cell}>{price.city}</td>
                <td className={`${cell} text-right font-bold`}>
                  {money(price.standardDeliveryPrice)} SAR
                </td>
                <td className={`${cell} text-right font-bold`}>
                  {money(price.whiteCementDeliveryPrice)} SAR
                </td>
                <td className={cell}>{price.configuredBy}</td>
                <td className={`${cell} whitespace-nowrap text-xs text-[#64748b]`}>
                  {formatDateTime(price.updatedAt)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="p-6 text-center text-[#64748b]">
                No Hader delivery prices configured.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}
function Message({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      {children}
    </div>
  );
}
function safeError(error: unknown) {
  return error instanceof AdminPricingApiError
    ? error.message
    : 'Unable to complete the pricing request.';
}
function positive(value: string) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}
function nonnegative(value: string) {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
}
function money(value: number) {
  return new Intl.NumberFormat('en-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
const input =
  'h-10 w-full rounded-lg border border-[#e3e1e8] bg-white px-3 text-sm outline-none focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10';
const cell = 'px-3 py-2.5';
const primaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-50';
const compactInput =
  'h-9 w-full rounded-md border border-[#e3e1e8] bg-white px-2.5 text-xs outline-none focus:border-[#54247a]';
const pageButton =
  'rounded-md border border-[#e3e1e8] bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40';
