import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Ellipsis,
  Loader2,
  MapPin,
  PackagePlus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AdminPricingApiError,
  getPricingConfiguration,
  saveHaderDeliveryPrice,
  saveProductListPrice,
  setHaderCity,
  type HaderDeliveryPrice,
  type PricingConfiguration,
  type ProductListPrice,
} from '../../services/adminPricingService';

type Tab = 'product' | 'delivery';
type SortKey = 'product' | 'city' | 'price' | 'updated';
type Filters = { search: string; packaging: string; cityId: string; uom: string };
const emptyFilters: Filters = { search: '', packaging: '', cityId: '', uom: '' };

export function AdminProductPrices({ deliveryOnly = false }: { deliveryOnly?: boolean }) {
  return <AdminProductPricesContent deliveryOnly={deliveryOnly} />;
}

function AdminProductPricesContent({ deliveryOnly }: { deliveryOnly: boolean }) {
  const [tab, setTab] = useState<Tab>(deliveryOnly ? 'delivery' : 'product');
  const [data, setData] = useState<PricingConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [productId, setProductId] = useState('');
  const [cityId, setCityId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [deliveryCityId, setDeliveryCityId] = useState('');
  const [standardPrice, setStandardPrice] = useState('');
  const [whitePrice, setWhitePrice] = useState('');
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<Record<string, string>>({});
  const productForm = useRef<HTMLFormElement>(null);
  const deliveryForm = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getPricingConfiguration();
      setData(result);
      setProductId((value) => value || result.products[0]?.id || '');
      setCityId((value) =>
        result.cities.some((city) => city.id === value) ? value : result.cities[0]?.id || '',
      );
      setDeliveryCityId((value) =>
        result.haderCities.some((city) => city.id === value)
          ? value
          : result.haderCities[0]?.id || '',
      );
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  const product = data?.products.find((item) => item.id === productId);
  const city = data?.cities.find((item) => item.id === cityId);
  const deliveryCity = data?.haderCities.find((item) => item.id === deliveryCityId);

  const saveProduct = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!product) errors.product = 'Select a product.';
    if (!city) errors.city = 'Select a city.';
    if (!positive(listPrice)) errors.price = 'Price must be greater than zero.';
    setProductErrors(errors);
    if (Object.keys(errors).length || !product || !city) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveProductListPrice(product.id, { cityId: city.id, listPrice: Number(listPrice) });
      setNotice('Saved successfully');
      setListPrice('');
      await load();
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setSaving(false);
    }
  }, [city, listPrice, load, product]);

  const saveDelivery = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!deliveryCity) errors.city = 'Select a city.';
    if (!nonnegative(standardPrice)) errors.standard = 'Enter a valid delivery price.';
    if (!nonnegative(whitePrice)) errors.white = 'Enter a valid delivery price.';
    setDeliveryErrors(errors);
    if (Object.keys(errors).length || !deliveryCity) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveHaderDeliveryPrice({
        cityId: deliveryCity.id,
        standardDeliveryPrice: Number(standardPrice),
        whiteCementDeliveryPrice: Number(whitePrice),
      });
      setNotice('Saved successfully');
      setStandardPrice('');
      setWhitePrice('');
      await load();
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setSaving(false);
    }
  }, [deliveryCity, load, standardPrice, whitePrice]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (saving) return;
      if (tab === 'product' && listPrice.trim()) void saveProduct();
      if (tab === 'delivery' && (standardPrice.trim() || whitePrice.trim())) void saveDelivery();
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [listPrice, saveDelivery, saveProduct, saving, standardPrice, tab, whitePrice]);

  const latest = useMemo(() => {
    const rows = tab === 'product' ? data?.productPrices : data?.deliveryPrices;
    return (rows ?? []).reduce<ProductListPrice | HaderDeliveryPrice | null>(
      (current, row) =>
        !current || new Date(row.updatedAt) > new Date(current.updatedAt) ? row : current,
      null,
    );
  }, [data, tab]);

  const editProduct = (price: ProductListPrice) => {
    setProductId(price.productId);
    setCityId(price.cityId);
    setListPrice(String(price.listPrice));
    productForm.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const editDelivery = (price: HaderDeliveryPrice) => {
    setDeliveryCityId(price.cityId);
    setStandardPrice(String(price.standardDeliveryPrice));
    setWhitePrice(String(price.whiteCementDeliveryPrice));
    deliveryForm.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="relative mx-auto max-w-[1500px] space-y-4 overflow-hidden">
      <div className="customer-muted flex items-center gap-1.5 text-xs">
        {!deliveryOnly && (
          <>
            Products <ChevronRight size={13} />
          </>
        )}
        <span className="customer-primary font-semibold">
          {deliveryOnly ? 'Delivery Pricing' : tab === 'product' ? 'Product Pricing' : 'Delivery Pricing'}
        </span>
      </div>
      <div className="customer-border-soft flex flex-col gap-2 border-b sm:flex-row sm:items-end sm:justify-between">
        {!deliveryOnly && <div role="tablist" className="flex gap-1">
          <TabButton
            active={tab === 'product'}
            onClick={() => {
              setTab('product');
              setNotice('');
            }}
          >
            Product Pricing
          </TabButton>
          <TabButton
            active={tab === 'delivery'}
            onClick={() => {
              setTab('delivery');
              setNotice('');
            }}
          >
            Delivery Pricing
          </TabButton>
        </div>}
        <p className="customer-muted pb-2 text-xs">
          {latest ? (
            <>
              Last updated: {formatDateTime(latest.updatedAt)}{' '}
              <strong className="customer-text">by {latest.configuredBy}</strong>
            </>
          ) : (
            'Not updated yet.'
          )}
        </p>
      </div>
      {error && <Message error>{error}</Message>}
      {notice && <Message>{notice}</Message>}
      {loading ? (
        <Loading />
      ) : tab === 'product' ? (
        <div className="space-y-4">
          <PageHeading
            title="Product Pricing"
            subtitle="Manage authoritative product list prices by product, packaging and city."
            action={
              <button
                className={primaryButton}
                onClick={() => productForm.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                <PackagePlus size={16} /> Add Product Price
              </button>
            }
          />
          <Panel>
            <form
              ref={productForm}
              onSubmit={(event) => {
                event.preventDefault();
                void saveProduct();
              }}
              className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]"
            >
              <Field label="Product" error={productErrors.product}>
                <select
                  className={input}
                  value={productId}
                  onChange={(event) => {
                    setProductId(event.target.value);
                    clearField(setProductErrors, 'product');
                  }}
                >
                  <option value="">Select product</option>
                  {data?.products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.productCode} — {item.productName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="KSA City" error={productErrors.city}>
                <select
                  className={input}
                  value={cityId}
                  onChange={(event) => {
                    setCityId(event.target.value);
                    clearField(setProductErrors, 'city');
                  }}
                >
                  <option value="">Select city</option>
                  {data?.cities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="List Price" suffix="SAR / TON" error={productErrors.price}>
                <input
                  className={input}
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={listPrice}
                  onChange={(event) => {
                    setListPrice(event.target.value);
                    if (positive(event.target.value)) clearField(setProductErrors, 'price');
                  }}
                />
              </Field>
              <button className={`${primaryButton} self-end`} disabled={saving}>
                Save Price
              </button>
            </form>
          </Panel>
          <ProductTable data={data} onEdit={editProduct} />
        </div>
      ) : (
        <div className="space-y-4">
          <PageHeading
            title="Hader Delivery Pricing"
            subtitle="Manage delivery rates by Hader city and cement type."
          />
          <Panel>
            <form
              ref={deliveryForm}
              onSubmit={(event) => {
                event.preventDefault();
                void saveDelivery();
              }}
              className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <Field label="Hader City" error={deliveryErrors.city}>
                <select
                  className={input}
                  value={deliveryCityId}
                  onChange={(event) => {
                    setDeliveryCityId(event.target.value);
                    clearField(setDeliveryErrors, 'city');
                  }}
                >
                  <option value="">Select city</option>
                  {data?.haderCities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Standard Delivery Price"
                suffix="SAR / TON"
                error={deliveryErrors.standard}
              >
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={standardPrice}
                  onChange={(event) => {
                    setStandardPrice(event.target.value);
                    if (nonnegative(event.target.value)) clearField(setDeliveryErrors, 'standard');
                  }}
                />
              </Field>
              <Field
                label="White Cement Delivery Price"
                suffix="SAR / TON"
                error={deliveryErrors.white}
              >
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={whitePrice}
                  onChange={(event) => {
                    setWhitePrice(event.target.value);
                    if (nonnegative(event.target.value)) clearField(setDeliveryErrors, 'white');
                  }}
                />
              </Field>
              <button className={`${primaryButton} self-end`} disabled={saving}>
                Save Delivery Price
              </button>
            </form>
          </Panel>
          <DeliveryTable data={data} onEdit={editDelivery} />
          <CityConfiguration
            data={data}
            saving={saving}
            setSaving={setSaving}
            load={load}
            setError={setError}
          />
        </div>
      )}
      <div
        aria-hidden={!saving}
        className={`pointer-events-none absolute inset-0 z-20 flex justify-center rounded-xl bg-black/10 pt-28 backdrop-blur-[1px] transition-opacity duration-200 ${saving ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="customer-card customer-primary flex h-12 items-center gap-2 rounded-lg border px-4 text-sm font-semibold shadow-sm">
          <Loader2 size={17} className="animate-spin" /> Saving changes...
        </div>
      </div>
    </div>
  );
}

function ProductTable({
  data,
  onEdit,
}: {
  data: PricingConfiguration | null;
  onEdit: (row: ProductListPrice) => void;
}) {
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<string | null>(null);
  const pageSize = 10;
  const rows = useMemo(() => {
    const filtered = (data?.productPrices ?? []).filter((row) => {
      const product = data?.products.find((item) => item.id === row.productId);
      return (
        `${product?.productCode ?? ''} ${product?.productName ?? ''}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()) &&
        (!filters.cityId || row.cityId === filters.cityId) &&
        (!filters.packaging || row.packagingType === filters.packaging) &&
        (!filters.uom || row.uom === filters.uom)
      );
    });
    return filtered.sort((a, b) => {
      const ap = data?.products.find((item) => item.id === a.productId)?.productName ?? '';
      const bp = data?.products.find((item) => item.id === b.productId)?.productName ?? '';
      const values = {
        product: [ap, bp],
        city: [a.city, b.city],
        price: [a.listPrice, b.listPrice],
        updated: [new Date(a.updatedAt).getTime(), new Date(b.updatedAt).getTime()],
      }[sortKey];
      const result =
        typeof values[0] === 'number'
          ? Number(values[0]) - Number(values[1])
          : String(values[0]).localeCompare(String(values[1]));
      return ascending ? result : -result;
    });
  }, [ascending, data, filters, sortKey]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  const setSort = (key: SortKey) => {
    if (sortKey === key) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(true);
    }
  };
  const apply = () => {
    setFilters(draft);
    setPage(1);
    setSelected(new Set());
  };
  const clear = () => {
    setDraft(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
    setSelected(new Set());
  };
  const chips = Object.entries(filters).filter(([, value]) => value);
  return (
    <Panel noPadding>
      <div className="border-b border-[#e3e1e8] p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              className={`${compactInput} pl-9`}
              placeholder="Search product name/code"
              value={draft.search}
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && apply()}
            />
          </div>
          <FilterSelect
            label="packaging"
            value={draft.packaging}
            setValue={(value) => setDraft({ ...draft, packaging: value })}
            options={unique((data?.productPrices ?? []).map((row) => row.packagingType))}
          />
          <select
            className={compactInput}
            value={draft.cityId}
            onChange={(event) => setDraft({ ...draft, cityId: event.target.value })}
          >
            <option value="">All cities</option>
            {data?.cities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <FilterSelect
            label="UOM"
            value={draft.uom}
            setValue={(value) => setDraft({ ...draft, uom: value })}
            options={unique((data?.productPrices ?? []).map((row) => row.uom))}
          />
          <button className={secondaryButton} onClick={apply}>
            Apply Filters
          </button>
          <button className={ghostButton} onClick={clear}>
            <RotateCcw size={14} /> Clear
          </button>
        </div>
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map(([key, value]) => (
              <button
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-[#f6f2fa] px-2.5 py-1 text-xs font-medium text-[#54247a]"
                onClick={() => {
                  const next = { ...filters, [key]: '' };
                  setFilters(next);
                  setDraft(next);
                  setPage(1);
                }}
              >
                {filterName(key)}:{' '}
                {key === 'cityId' ? data?.cities.find((item) => item.id === value)?.name : value}
                <X size={12} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  className={checkbox}
                  type="checkbox"
                  checked={visible.length > 0 && visible.every((row) => selected.has(row.id))}
                  onChange={() => {
                    const all = visible.every((row) => selected.has(row.id));
                    const next = new Set(selected);
                    visible.forEach((row) => (all ? next.delete(row.id) : next.add(row.id)));
                    setSelected(next);
                  }}
                />
              </th>
              <th className="w-14 px-2 py-2.5">S.No.</th>
              <SortHead label="Product" onClick={() => setSort('product')} />
              <th className={cell}>Packaging</th>
              <SortHead label="City" onClick={() => setSort('city')} />
              <th className={cell}>UOM</th>
              <SortHead label="List Price (SAR / TON)" onClick={() => setSort('price')} right />
              <SortHead label="Last Updated" onClick={() => setSort('updated')} />
              <th className={cell}>Updated By</th>
              <th className="w-14 px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((row, index) => {
                const product = data?.products.find((item) => item.id === row.productId);
                return (
                  <tr key={row.id} className={tableRow}>
                    <td className={cell}>
                      <input
                        className={checkbox}
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => setSelected(toggleSet(selected, row.id))}
                      />
                    </td>
                    <td className={cell}>{(page - 1) * pageSize + index + 1}</td>
                    <td className={cell}>
                      <strong className="block">{product?.productName}</strong>
                      <span className="text-xs text-[#64748b]">{product?.productCode}</span>
                    </td>
                    <td className={cell}>{row.packagingType}</td>
                    <td className={cell}>{row.city}</td>
                    <td className={cell}>{row.uom}</td>
                    <td className={`${cell} text-right font-bold tabular-nums`}>
                      {money(row.listPrice)}
                    </td>
                    <td className={`${cell} whitespace-nowrap text-xs text-[#64748b]`}>
                      {formatDateTime(row.updatedAt)}
                    </td>
                    <td className={cell}>{row.configuredBy}</td>
                    <td className="relative px-3 py-2.5">
                      <RowMenu
                        open={menu === row.id}
                        toggle={() => setMenu(menu === row.id ? null : row.id)}
                        edit={() => {
                          setMenu(null);
                          onEdit(row);
                        }}
                      />
                    </td>
                  </tr>
                );
              })
            ) : (
              <Empty colSpan={10}>No product prices match the filters.</Empty>
            )}
          </tbody>
        </table>
      </div>
      <Footer
        page={page}
        pageCount={pageCount}
        total={rows.length}
        pageSize={pageSize}
        setPage={setPage}
        selected={selected.size}
      />
    </Panel>
  );
}

function DeliveryTable({
  data,
  onEdit,
}: {
  data: PricingConfiguration | null;
  onEdit: (row: HaderDeliveryPrice) => void;
}) {
  const [cityId, setCityId] = useState('');
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<string | null>(null);
  const pageSize = 10;
  const rows = (data?.deliveryPrices ?? []).filter((row) => !cityId || row.cityId === cityId);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <Panel noPadding>
      <div className="flex flex-col gap-2 border-b border-[#e3e1e8] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold">Configured Delivery Prices</h3>
          <p className="text-xs text-[#64748b]">
            Customer-facing rates only. Transporter costs are not displayed.
          </p>
        </div>
        <select
          className={`${compactInput} sm:w-52`}
          value={cityId}
          onChange={(event) => {
            setCityId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All Hader cities</option>
          {data?.haderCities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className={tableHead}>
            <tr>
              <th className={cell}>S.No.</th>
              <th className={cell}>Hader City</th>
              <th className={`${cell} text-right`}>Standard Delivery (SAR / TON)</th>
              <th className={`${cell} text-right`}>White Cement (SAR / TON)</th>
              <th className={cell}>Last Updated</th>
              <th className={cell}>Updated By</th>
              <th className={cell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((row, index) => (
                <tr key={row.id} className={tableRow}>
                  <td className={cell}>{(page - 1) * pageSize + index + 1}</td>
                  <td className={`${cell} font-semibold`}>{row.city}</td>
                  <td className={`${cell} text-right font-bold`}>
                    {money(row.standardDeliveryPrice)}
                  </td>
                  <td className={`${cell} text-right font-bold`}>
                    {money(row.whiteCementDeliveryPrice)}
                  </td>
                  <td className={`${cell} whitespace-nowrap text-xs text-[#64748b]`}>
                    {formatDateTime(row.updatedAt)}
                  </td>
                  <td className={cell}>{row.configuredBy}</td>
                  <td className="relative px-3 py-2.5">
                    <RowMenu
                      open={menu === row.id}
                      toggle={() => setMenu(menu === row.id ? null : row.id)}
                      edit={() => {
                        setMenu(null);
                        onEdit(row);
                      }}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <Empty colSpan={7}>No delivery prices configured for this city.</Empty>
            )}
          </tbody>
        </table>
      </div>
      <Footer
        page={page}
        pageCount={pageCount}
        total={rows.length}
        pageSize={pageSize}
        setPage={setPage}
      />
    </Panel>
  );
}

function CityConfiguration({
  data,
  saving,
  setSaving,
  load,
  setError,
}: {
  data: PricingConfiguration | null;
  saving: boolean;
  setSaving: (value: boolean) => void;
  load: () => Promise<void>;
  setError: (value: string) => void;
}) {
  return (
    <details className="customer-card rounded-xl border">
      <summary className="customer-primary flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold">
        Hader City Configuration <ChevronDown size={16} />
      </summary>
      <div className="customer-border-soft border-t p-4">
        <p className="customer-muted mb-3 text-xs">
          Select which active KSA cities are available for Hader delivery pricing.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data?.cities.map((city) => (
            <button
              key={city.id}
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await setHaderCity(city.id, !city.isHaderEnabled);
                  await load();
                } catch (failure) {
                  setError(safeError(failure));
                } finally {
                  setSaving(false);
                }
              }}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                city.isHaderEnabled
                  ? 'border-[var(--customer-primary)] bg-[var(--customer-primary-soft)] text-[var(--customer-primary)]'
                  : 'customer-border customer-surface customer-secondary'
              }`}
            >
              <span className="flex items-center gap-2">
                <MapPin size={14} />
                {city.name}
              </span>
              <strong className="text-xs">{city.isHaderEnabled ? 'Enabled' : 'Disabled'}</strong>
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}

function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="customer-text text-2xl font-bold">{title}</h1>
        <p className="customer-muted mt-1 text-sm">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Panel({ children, noPadding = false }: { children: ReactNode; noPadding?: boolean }) {
  return (
    <section
      className={`customer-card rounded-xl border shadow-sm ${noPadding ? 'overflow-visible' : 'p-4'}`}
    >
      {children}
    </section>
  );
}
function Field({
  label,
  suffix,
  error,
  children,
}: {
  label: string;
  suffix?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="customer-text mb-1.5 flex justify-between gap-2 text-xs font-semibold">
        {label}
        {suffix && <span className="customer-muted font-medium">{suffix}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-[#b42318]">{error}</span>}
    </label>
  );
}
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${
        active
          ? 'border-[var(--customer-primary)] text-[var(--customer-primary)]'
          : 'customer-secondary border-transparent hover:text-[var(--customer-text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}
function Message({ error, children }: { error?: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
    >
      {error ? <AlertCircle size={16} /> : <Check size={16} />}
      {children}
    </div>
  );
}
function Loading() {
  return (
    <div className="customer-muted flex min-h-52 items-center justify-center text-sm">
      <Loader2 size={17} className="mr-2 animate-spin" /> Loading pricing configuration...
    </div>
  );
}
function FilterSelect({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      className={compactInput}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    >
      <option value="">All {label.toLowerCase()}</option>
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}
function SortHead({
  label,
  onClick,
  right,
}: {
  label: string;
  onClick: () => void;
  right?: boolean;
}) {
  return (
    <th className={`${cell} ${right ? 'text-right' : ''}`}>
      <button className="inline-flex items-center gap-1 font-semibold" onClick={onClick}>
        {label}
        <ChevronsUpDown size={12} />
      </button>
    </th>
  );
}
function RowMenu({ open, toggle, edit }: { open: boolean; toggle: () => void; edit: () => void }) {
  return (
    <>
      <button
        aria-label="Row actions"
        onClick={toggle}
        className="customer-border customer-secondary inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)]"
      >
        <Ellipsis size={16} />
      </button>
      {open && (
        <div className="customer-card absolute right-3 top-10 z-10 min-w-28 rounded-lg border p-1 shadow-lg">
          <button
            onClick={edit}
            className="w-full rounded-md px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--customer-primary-soft)]"
          >
            Edit price
          </button>
        </div>
      )}
    </>
  );
}
function Empty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="customer-muted p-8 text-center">
        {children}
      </td>
    </tr>
  );
}
function Footer({
  page,
  pageCount,
  total,
  pageSize,
  setPage,
  selected = 0,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  setPage: (page: number) => void;
  selected?: number;
}) {
  return (
    <div className="customer-border-soft customer-muted flex flex-col gap-2 border-t px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span>
        {selected ? `${selected} selected · ` : ''}Showing {total ? (page - 1) * pageSize + 1 : 0}–
        {Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button className={pageButton} disabled={page === 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft size={14} /> Previous
        </button>
        <span className="px-2">
          {page} / {pageCount}
        </span>
        <button
          className={pageButton}
          disabled={page === pageCount}
          onClick={() => setPage(page + 1)}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function safeError(error: unknown) {
  return error instanceof AdminPricingApiError
    ? error.message
    : 'Unable to complete the pricing request.';
}
function positive(value: string) {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
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
function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}
function toggleSet(current: Set<string>, id: string) {
  const next = new Set(current);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}
function filterName(key: string) {
  return (
    (
      { search: 'Product', packaging: 'Packaging', cityId: 'City', uom: 'UOM' } as Record<
        string,
        string
      >
    )[key] ?? key
  );
}
function clearField(
  setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  field: string,
) {
  setter((current) => ({ ...current, [field]: '' }));
}

const input =
  'customer-input customer-border customer-text h-10 w-full rounded-lg border px-3 text-sm outline-none transition placeholder:text-[var(--customer-text-muted)] focus:border-[var(--customer-primary)] focus:ring-2 focus:ring-[var(--customer-primary-soft)]';
const compactInput =
  'customer-input customer-border customer-text h-9 w-full rounded-md border px-2.5 text-xs outline-none transition focus:border-[var(--customer-primary)]';
const primaryButton =
  'customer-primary-bg inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white transition disabled:opacity-50';
const secondaryButton =
  'customer-primary-bg h-9 rounded-md px-3 text-xs font-bold text-white';
const ghostButton =
  'customer-surface customer-border customer-secondary inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold hover:bg-[var(--customer-surface-secondary)]';
const pageButton =
  'customer-surface customer-border customer-text inline-flex items-center gap-1 rounded-md border px-2 py-1.5 font-semibold disabled:opacity-40';
const checkbox = 'h-4 w-4 rounded border-[#cbd5e1] accent-[#54247a]';
const cell = 'px-3 py-2.5';
const tableHead = 'customer-surface-secondary customer-secondary text-left text-xs';
const tableRow = 'customer-border-soft border-t transition-colors hover:bg-[var(--customer-surface-secondary)]';
