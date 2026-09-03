import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { CalendarDays, ChevronLeft, ChevronRight, Search, Truck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDispatchFilters,
  getDispatchResources,
  listDeliveryTeam,
  type DeliveryExecutionStatus,
  type DeliveryTeamShipment,
  type DispatchResource,
  type InternalPagination,
} from '../../services/haderDeliveryService';

const statuses: DeliveryExecutionStatus[] = [
  'LOADED',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CLOSED',
];

export function HaderDeliveryTeam() {
  const [items, setItems] = useState<DeliveryTeamShipment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState<InternalPagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<DeliveryExecutionStatus | ''>('');
  const [city, setCity] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [driver, setDriver] = useState('');
  const [truck, setTruck] = useState('');
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);
  const [drivers, setDrivers] = useState<DispatchResource[]>([]);
  const [trucks, setTrucks] = useState<DispatchResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void Promise.all([getDispatchFilters(), getDispatchResources()])
      .then(([filters, resources]) => {
        setCities(filters.cities);
        setDrivers(resources.drivers);
        setTrucks(resources.trucks);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await listDeliveryTeam({
        page,
        search: debouncedSearch,
        status,
        haderCityId: city,
        deliveryDate,
        driverId: driver,
        truckId: truck,
      });
      setItems(result.items);
      setSelectedIds([]);
      setPagination(result.pagination);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [city, debouncedSearch, deliveryDate, driver, page, status, truck]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  const toggleAllVisible = () => {
    setSelectedIds(allVisibleSelected ? [] : items.map((item) => item.id));
  };
  const toggleRow = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="customer-text text-2xl font-bold">Delivery Team</h1>
        <p className="customer-secondary mt-1 text-sm">
          Execute loaded shipments through dispatch, transit, delivery and closure.
        </p>
      </header>

      <section className="customer-card overflow-hidden rounded-2xl border">
        <div className="customer-border-soft grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="customer-input customer-border flex h-10 items-center gap-2 rounded-lg border px-3 xl:col-span-1">
            <Search size={16} className="customer-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Shipment or order"
              className="customer-input customer-text min-w-0 flex-1 text-sm outline-none"
            />
          </label>
          <Filter
            value={status}
            onChange={(value) => {
              setStatus(value as DeliveryExecutionStatus | '');
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </Filter>
          <Filter value={city} onChange={(value) => change(setCity, value)}>
            <option value="">All Hader Cities</option>
            {cities.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name}
              </option>
            ))}
          </Filter>
          <label className="customer-input customer-border flex h-10 items-center gap-2 rounded-lg border px-3">
            <CalendarDays size={16} className="customer-muted" />
            <input
              type="date"
              aria-label="Delivery date"
              value={deliveryDate}
              onChange={(event) => change(setDeliveryDate, event.target.value)}
              className="customer-input customer-text min-w-0 flex-1 text-sm outline-none"
            />
          </label>
          <Filter value={driver} onChange={(value) => change(setDriver, value)}>
            <option value="">All Drivers</option>
            {drivers.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name ?? value.mobile ?? 'Driver'}
              </option>
            ))}
          </Filter>
          <Filter value={truck} onChange={(value) => change(setTruck, value)}>
            <option value="">All Trucks</option>
            {trucks.map((value) => (
              <option key={value.id} value={value.id}>
                {value.plateNumber ?? value.truckNumber ?? 'Truck'}
              </option>
            ))}
          </Filter>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="customer-surface-secondary h-12 animate-pulse rounded-lg"
              />
            ))}
          </div>
        ) : error ? (
          <State
            title="Unable to load Delivery Team shipments."
            action={
              <button onClick={() => void load()} className="customer-primary font-bold">
                Retry
              </button>
            }
          />
        ) : items.length === 0 ? (
          <State
            title="No shipments are ready for delivery execution."
            action={
              <p className="customer-secondary text-sm">
                Completed loading shipments will appear here.
              </p>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1580px] text-left text-sm">
                <thead className="customer-surface-secondary customer-secondary text-xs">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all visible shipments"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="h-4 w-4 accent-[#54247a]"
                      />
                    </th>
                    <th className="w-14 px-3 py-3 font-semibold">S.No.</th>
                    {[
                      'Shipment ID',
                      'Order ID',
                      'Customer',
                      'Product',
                      'Quantity',
                      'Hader City',
                      'Ship-to',
                      'Transporter',
                      'Truck',
                      'Driver',
                      'Scheduled Date/Time',
                      'Status',
                    ].map((heading) => (
                      <th key={heading} className="px-3 py-3 font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="customer-border-soft divide-y">
                  {items.map((shipment, index) => (
                    <tr key={shipment.id} className="customer-row-hover">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select shipment ${shipment.shipmentNumber}`}
                          checked={selectedIds.includes(shipment.id)}
                          onChange={() => toggleRow(shipment.id)}
                          className="h-4 w-4 accent-[#54247a]"
                        />
                      </td>
                      <td className="customer-muted px-3 py-3">
                        {(page - 1) * 10 + index + 1}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/hader/delivery-team/${shipment.id}`}
                          className="customer-primary font-bold hover:underline"
                        >
                          {shipment.shipmentNumber}
                        </Link>
                      </td>
                      <td className="customer-text px-3 py-3 font-semibold">
                        {shipment.order.number}
                      </td>
                      <td className="customer-text px-3 py-3">{shipment.customer.companyName}</td>
                      <td className="px-3 py-3">
                        <p className="customer-text font-semibold">{shipment.product.name}</p>
                        <p className="customer-muted text-xs">{shipment.product.code}</p>
                      </td>
                      <td className="customer-text px-3 py-3">{tons(shipment.quantityTon)}</td>
                      <td className="customer-text px-3 py-3">
                        {shipment.haderCity.name ?? 'Not provided'}
                      </td>
                      <td className="customer-text max-w-48 truncate px-3 py-3">
                        {shipTo(shipment.shipTo)}
                      </td>
                      <td className="customer-text px-3 py-3">
                        {shipment.assignment?.transporter.name ?? 'Not assigned'}
                      </td>
                      <td className="customer-text px-3 py-3">
                        {shipment.assignment?.truck?.plateNumber ?? 'Not assigned'}
                      </td>
                      <td className="customer-text px-3 py-3">
                        {shipment.assignment?.driver?.name ?? 'Not assigned'}
                      </td>
                      <td className="customer-text whitespace-nowrap px-3 py-3">
                        {scheduledDateTime(shipment)}
                      </td>
                      <td className="px-3 py-3">
                        <DeliveryStatus value={shipment.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="customer-border-soft divide-y lg:hidden">
              {items.map((shipment) => (
                <article key={shipment.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to={`/hader/delivery-team/${shipment.id}`}
                      className="customer-primary font-bold"
                    >
                      {shipment.shipmentNumber}
                    </Link>
                    <DeliveryStatus value={shipment.status} />
                  </div>
                  <p className="customer-text text-sm font-semibold">{shipment.product.name}</p>
                  <div className="customer-secondary grid grid-cols-2 gap-2 text-xs">
                    <span>{shipment.order.number}</span>
                    <span>{tons(shipment.quantityTon)}</span>
                    <span>{shipment.assignment?.truck?.plateNumber ?? 'No truck'}</span>
                    <span>{shipment.assignment?.driver?.name ?? 'No driver'}</span>
                  </div>
                </article>
              ))}
            </div>
            <footer className="customer-border-soft flex items-center justify-between border-t px-4 py-3">
              <span className="customer-muted text-xs">
                Showing {pagination?.total ? (page - 1) * 10 + 1 : 0}â€“
                {Math.min(page * 10, pagination?.total ?? 0)} of {pagination?.total ?? 0}
              </span>
              {selectedIds.length > 0 && (
                <span className="customer-primary text-xs font-semibold">
                  {selectedIds.length} selected
                </span>
              )}
              <div className="flex gap-2">
                <PageButton disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={14} /> Previous
                </PageButton>
                <PageButton
                  disabled={page >= (pagination?.totalPages ?? 1)}
                  onClick={() => setPage(page + 1)}
                >
                  Next <ChevronRight size={14} />
                </PageButton>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export function DeliveryStatus({ value }: { value: DeliveryExecutionStatus }) {
  const colors: Record<DeliveryExecutionStatus, string> = {
    LOADED: 'bg-violet-500',
    DISPATCHED: 'bg-blue-500',
    IN_TRANSIT: 'bg-cyan-500',
    DELIVERED: 'bg-emerald-500',
    CLOSED: 'bg-slate-500',
  };
  return (
    <span className="customer-text inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold">
      <span className={`h-2 w-2 rounded-full ${colors[value]}`} />
      {label(value)}
    </span>
  );
}

function Filter({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <NativeTomSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="customer-input customer-border customer-text h-10 rounded-lg border px-3 text-sm"
    >
      {children}
    </NativeTomSelect>
  );
}
function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="customer-border customer-text inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40"
    >
      {children}
    </button>
  );
}
function State({ title, action }: { title: string; action: React.ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <Truck className="customer-muted mx-auto" size={32} />
      <p className="customer-text mt-3 font-semibold">{title}</p>
      <div className="mt-2">{action}</div>
    </div>
  );
}
export function label(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
export function tons(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} TON`;
}
export function date(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not provided';
}
export function shipTo(value: Record<string, unknown> | null) {
  if (!value) return 'Not provided';
  return (
    [value.name, value.streetAddress, value.city, value.region].filter(Boolean).join(', ') ||
    'Not provided'
  );
}

function scheduledDateTime(shipment: DeliveryTeamShipment) {
  if (!shipment.scheduledDate) return 'Not provided';
  return `${date(shipment.scheduledDate)}${
    shipment.scheduledTime ? `, ${shipment.scheduledTime}` : ''
  }`;
}
