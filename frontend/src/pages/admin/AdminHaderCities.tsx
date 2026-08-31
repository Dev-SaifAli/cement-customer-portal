import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  MapPinned,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { HaderBoundaryMap } from '../../components/admin/HaderBoundaryMap';
import { useSalesAuth } from '../../context/SalesAuthContext';
import {
  getPricingConfiguration,
  type HaderDeliveryPrice,
} from '../../services/adminPricingService';
import {
  clearHaderBoundary,
  listHaderBoundaryCities,
  saveHaderBoundary,
  type GeoJsonPolygon,
  type HaderBoundaryCity,
} from '../../services/haderZoneService';

const PAGE_SIZE = 10;
type SortField = 'city' | 'boundary' | 'updated';

export function AdminHaderCities() {
  const { user } = useSalesAuth();
  const [cities, setCities] = useState<HaderBoundaryCity[]>([]);
  const [prices, setPrices] = useState<HaderDeliveryPrice[]>([]);
  const [selected, setSelected] = useState<HaderBoundaryCity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [boundary, setBoundary] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [delivery, setDelivery] = useState('ALL');
  const [sort, setSort] = useState<SortField>('city');
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const canEdit = ['PRICING_ADMIN', 'HADER_MANAGER', 'HADER_OPERATIONS'].includes(user?.role ?? '');
  const canViewPricing = user?.role === 'PRICING_ADMIN';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cityData, pricing] = await Promise.all([
        listHaderBoundaryCities(),
        canViewPricing ? getPricingConfiguration().catch(() => null) : Promise.resolve(null),
      ]);
      setCities(cityData);
      setPrices(pricing?.deliveryPrices ?? []);
    } catch {
      setError('Unable to load Hader cities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => void load(), [canViewPricing]);
  useEffect(() => setPage(1), [search, boundary, status, delivery, sort, ascending]);

  const priceByCity = useMemo(
    () => new Map(prices.map((price) => [price.cityId, price])),
    [prices],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cities
      .filter((city) => !query || city.name.toLowerCase().includes(query))
      .filter((city) => boundary === 'ALL' || city.boundaryStatus === boundary)
      .filter((city) => status === 'ALL' || city.isActive === (status === 'ACTIVE'))
      .filter((city) => delivery === 'ALL' || city.isHaderEnabled === (delivery === 'ENABLED'))
      .sort((a, b) => {
        const result = sortValue(a, sort).localeCompare(sortValue(b, sort), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        return ascending ? result : -result;
      });
  }, [cities, search, boundary, status, delivery, sort, ascending]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const configured = cities.filter((city) => city.boundaryStatus === 'CONFIGURED').length;
  const activeZones = cities.filter((city) => city.isActive && city.isHaderEnabled).length;

  const replace = (city: HaderBoundaryCity) => {
    setCities((current) => current.map((item) => (item.id === city.id ? city : item)));
    setSelected(city);
  };
  const save = async (polygon: GeoJsonPolygon) => {
    if (!selected || !window.confirm(`Save delivery boundary for ${selected.name}?`)) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const city = await saveHaderBoundary(selected.id, polygon);
      replace(city);
      setSuccess(`${city.name} delivery boundary saved.`);
    } catch {
      setError('Unable to save the delivery boundary.');
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    if (
      !selected ||
      !window.confirm(
        `Clear the saved delivery boundary for ${selected.name}?\n\nThis removes only the boundary. City and pricing data remain unchanged.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const city = await clearHaderBoundary(selected.id);
      replace(city);
      setSuccess(`${city.name} delivery boundary cleared.`);
    } catch {
      setError('Unable to clear the delivery boundary.');
    } finally {
      setBusy(false);
    }
  };
  const changeSort = (field: SortField) => {
    if (field === sort) setAscending((value) => !value);
    else {
      setSort(field);
      setAscending(true);
    }
  };
  const reset = () => {
    setSearch('');
    setBoundary('ALL');
    setStatus('ALL');
    setDelivery('ALL');
    setSort('city');
    setAscending(true);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hader Cities</h1>
          <p className="mt-1 text-sm text-[#64748b]">
            Manage Hader delivery zones, pricing coverage and boundaries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e3e1e8] bg-white px-3 text-sm font-semibold text-[#54247a] hover:bg-[#f6f2fa] disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <Notice error message={error} />}
      {success && <Notice message={success} />}

      <div className="grid overflow-hidden rounded-xl border border-[#e3e1e8] bg-white sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Total Cities" value={cities.length} detail="All city records" />
        <Summary
          label="Configured Boundaries"
          value={configured}
          detail="Active boundaries"
          tone="success"
        />
        <Summary
          label="Pending Boundaries"
          value={cities.length - configured}
          detail="Pending setup"
          tone="warning"
        />
        <Summary label="Active Hader Zones" value={activeZones} detail="Delivery enabled" />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e3e1e8] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e3e1e8] p-3">
          <label className="relative min-w-[190px] flex-1 lg:max-w-xs">
            <span className="sr-only">Search city</span>
            <MapPinned
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search city"
              className="h-10 w-full rounded-lg border border-[#e3e1e8] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/15"
            />
          </label>
          <Filter
            value={boundary}
            label="Boundary"
            onChange={setBoundary}
            options={[
              ['ALL', 'Boundary: All'],
              ['CONFIGURED', 'Configured'],
              ['NOT_CONFIGURED', 'Not Configured'],
            ]}
          />
          <Filter
            value={status}
            label="Status"
            onChange={setStatus}
            options={[
              ['ALL', 'Status: All'],
              ['ACTIVE', 'Active'],
              ['INACTIVE', 'Inactive'],
            ]}
          />
          <Filter
            value={delivery}
            label="Hader Delivery"
            onChange={setDelivery}
            options={[
              ['ALL', 'Hader Delivery: All'],
              ['ENABLED', 'Enabled'],
              ['DISABLED', 'Disabled'],
            ]}
          />
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#54247a] hover:bg-[#f6f2fa]"
          >
            <RotateCcw size={15} /> Reset
          </button>
        </div>

        <div className="divide-y divide-[#e3e1e8] md:hidden">
          {!loading &&
            rows.map((city, index) => (
              <article key={city.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelected(city)}
                    className="text-left font-semibold hover:text-[#54247a] hover:underline"
                  >
                    {city.name}
                  </button>
                  <span className="text-xs font-semibold text-[#64748b]">
                    #{(currentPage - 1) * PAGE_SIZE + index + 1}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <Dot
                    active={city.boundaryStatus === 'CONFIGURED'}
                    yes="Configured"
                    no="Not Configured"
                    warning
                  />
                  <Dot active={city.isActive} yes="Active" no="Inactive" />
                </div>
                {city.boundaryUpdatedAt && (
                  <p className="text-xs text-[#64748b]">
                    Updated {date(city.boundaryUpdatedAt)}, {time(city.boundaryUpdatedAt)}
                  </p>
                )}
              </article>
            ))}
          {loading && (
            <div className="p-4">
              <div className="h-20 animate-pulse rounded bg-slate-100" />
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="w-16 px-4 py-3">S.No.</th>
                <SortHeader label="City" field="city" active={sort} onSort={changeSort} />
                <th className="px-4 py-3">Standard Delivery</th>
                <th className="px-4 py-3">White Cement</th>
                <SortHeader label="Boundary" field="boundary" active={sort} onSort={changeSort} />
                <th className="px-4 py-3">Status</th>
                <SortHeader label="Updated" field="updated" active={sort} onSort={changeSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e1e8]">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)
                : rows.map((city, index) => {
                    const price = priceByCity.get(city.id);
                    return (
                      <tr key={city.id} className="hover:bg-[#faf8fc]">
                        <td className="px-4 py-3 text-[#64748b]">
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelected(city)}
                            className="font-semibold hover:text-[#54247a] hover:underline"
                          >
                            {city.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[#475569]">
                          {price ? `${money(price.standardDeliveryPrice)} SAR / TON` : '—'}
                        </td>
                        <td className="px-4 py-3 text-[#475569]">
                          {price ? `${money(price.whiteCementDeliveryPrice)} SAR / TON` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Dot
                            active={city.boundaryStatus === 'CONFIGURED'}
                            yes="Configured"
                            no="Not Configured"
                            warning
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Dot active={city.isActive} yes="Active" no="Inactive" />
                        </td>
                        <td className="px-4 py-3 text-xs leading-5 text-[#64748b]">
                          {city.boundaryUpdatedAt ? (
                            <>
                              <span className="block">{date(city.boundaryUpdatedAt)}</span>
                              <span className="block">{time(city.boundaryUpdatedAt)}</span>
                            </>
                          ) : (
                            'Not configured'
                          )}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-[#64748b]">
            No cities match the selected filters.
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e1e8] px-4 py-3 text-sm text-[#64748b]">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}â€“
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Pager
                label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft size={16} />
              </Pager>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setPage(number)}
                  aria-current={number === currentPage ? 'page' : undefined}
                  className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold ${number === currentPage ? 'border-[#54247a] bg-[#f6f2fa] text-[#54247a]' : 'border-[#e3e1e8] bg-white text-[#64748b] hover:bg-[#f8fafc]'}`}
                >
                  {number}
                </button>
              ))}
              <Pager
                label="Next page"
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                <ChevronRight size={16} />
              </Pager>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <HaderBoundaryMap
          key={`${selected.id}-${selected.boundaryUpdatedAt ?? 'new'}`}
          cityName={selected.name}
          initialBoundary={selected.boundary}
          updatedAt={selected.boundaryUpdatedAt}
          updatedBy={selected.boundaryUpdatedBy}
          canEdit={canEdit}
          busy={busy}
          onSave={(polygon) => void save(polygon)}
          onClear={() => void clear()}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function Summary({
  label,
  value,
  detail,
  tone = 'primary',
}: {
  label: string;
  value: number;
  detail: string;
  tone?: 'primary' | 'success' | 'warning';
}) {
  const classes =
    tone === 'success'
      ? 'bg-emerald-50 text-[#0f8b5f]'
      : tone === 'warning'
        ? 'bg-amber-50 text-[#b45309]'
        : 'bg-[#f6f2fa] text-[#54247a]';
  return (
    <div className="flex min-h-24 items-center gap-3 border-b border-[#e3e1e8] px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${classes}`}>
        {tone === 'success' ? (
          <CheckCircle2 size={19} />
        ) : tone === 'warning' ? (
          <AlertCircle size={19} />
        ) : (
          <MapPinned size={19} />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-[#64748b]">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        <p className="truncate text-xs text-[#64748b]">{detail}</p>
      </div>
    </div>
  );
}

function Notice({ error = false, message }: { error?: boolean; message: string }) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-[#b42318]' : 'border-emerald-200 bg-emerald-50 text-[#0f8b5f]'}`}
    >
      {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      {message}
    </div>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative min-w-[155px]">
      <span className="sr-only">{label}</span>
      <NativeTomSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-[#e3e1e8] bg-white py-0 pl-3 pr-9 text-sm outline-none focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/15"
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </NativeTomSelect>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b]"
      />
    </label>
  );
}

function SortHeader({
  label,
  field,
  active,
  onSort,
}: {
  label: string;
  field: SortField;
  active: SortField;
  onSort: (field: SortField) => void;
}) {
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-[#54247a]"
      >
        {label}
        <ChevronsUpDown size={14} className={active === field ? 'text-[#54247a]' : ''} />
      </button>
    </th>
  );
}

function Dot({
  active,
  yes,
  no,
  warning = false,
}: {
  active: boolean;
  yes: string;
  no: string;
  warning?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[#475569]">
      <span
        className={`h-2 w-2 rounded-full ${active ? 'bg-[#0f8b5f]' : warning ? 'bg-amber-500' : 'bg-slate-400'}`}
      />
      {active ? yes : no}
    </span>
  );
}

function Skeleton() {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-3">
        <div className="h-6 animate-pulse rounded bg-slate-100" />
      </td>
    </tr>
  );
}
function Pager({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-grid h-9 w-9 place-items-center rounded-lg border border-[#e3e1e8] bg-white hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
function sortValue(city: HaderBoundaryCity, field: SortField) {
  return field === 'city'
    ? city.name
    : field === 'boundary'
      ? city.boundaryStatus
      : (city.boundaryUpdatedAt ?? '');
}
function money(value: number) {
  return new Intl.NumberFormat('en-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
function date(value: string) {
  return new Intl.DateTimeFormat('en-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}
function time(value: string) {
  return new Intl.DateTimeFormat('en-SA', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(value),
  );
}
