import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { CalendarDays, ChevronLeft, ChevronRight, PackageOpen, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listCustomerShipments,
  type CustomerShipment,
  type CustomerShipmentsList,
  type CustomerShipmentStatus,
} from '../../services/customerShipmentsService';

const statuses: CustomerShipmentStatus[] = [
  'CREATED',
  'ASSIGNED',
  'LOADING',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CLOSED',
];

export function CustomerShipments() {
  const [result, setResult] = useState<CustomerShipmentsList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<CustomerShipmentStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setResult(
        await listCustomerShipments({ page, search: debouncedSearch, status, dateFrom, dateTo }),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, debouncedSearch, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const pagination = result?.pagination;
  return (
    <div className="space-y-5">
      <header>
        <h1 className="customer-text text-2xl font-bold">My Shipments</h1>
        <p className="customer-secondary mt-1 text-sm">
          Track your cement deliveries and shipment progress.
        </p>
      </header>

      <section className="customer-card overflow-hidden rounded-2xl border">
        <div className="customer-border-soft flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="customer-input customer-border flex h-10 w-full items-center gap-2 rounded-lg border px-3 lg:max-w-sm">
            <Search size={16} className="customer-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Shipment or order number"
              className="customer-input customer-text min-w-0 flex-1 text-sm outline-none"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <NativeTomSelect
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CustomerShipmentStatus | '');
                setPage(1);
              }}
              className="customer-input customer-border customer-text h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All Statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </NativeTomSelect>
            <label className="customer-input customer-border flex h-10 items-center gap-2 rounded-lg border px-3">
              <CalendarDays size={16} className="customer-muted" />
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
                max={dateTo || undefined}
                aria-label="Created from date"
                className="customer-input customer-text text-sm outline-none"
              />
            </label>
            <span className="customer-muted hidden text-xs sm:inline">to</span>
            <label className="customer-input customer-border flex h-10 items-center gap-2 rounded-lg border px-3">
              <CalendarDays size={16} className="customer-muted" />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
                min={dateFrom || undefined}
                aria-label="Created to date"
                className="customer-input customer-text text-sm outline-none"
              />
            </label>
            <span className="customer-secondary whitespace-nowrap text-sm font-semibold">
              {pagination?.total ?? 0} Shipments
            </span>
          </div>
        </div>

        {loading ? (
          <ShipmentSkeleton />
        ) : error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-red-600">
              Unable to load shipments. Please try again.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="customer-primary mt-3 text-sm font-bold hover:underline"
            >
              Retry
            </button>
          </div>
        ) : !result?.items.length ? (
          <div className="px-6 py-14 text-center">
            <PackageOpen size={34} className="customer-muted mx-auto" />
            <h2 className="customer-text mt-3 font-bold">No shipments yet</h2>
            <p className="customer-secondary mt-1 text-sm">
              Your delivery shipments will appear here once they are created.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="customer-surface-secondary customer-secondary text-xs">
                  <tr>
                    {[
                      'Shipment Number',
                      'Order Number',
                      'Contract Number',
                      'Product',
                      'Quantity TON',
                      'Fulfilment',
                      'Ship-to Location',
                      'Status',
                      'Created Date',
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="customer-border-soft divide-y">
                  {result.items.map((shipment) => (
                    <ShipmentRow key={shipment.id} shipment={shipment} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="customer-border-soft divide-y md:hidden">
              {result.items.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
            <Pagination pagination={pagination} page={page} onPage={setPage} />
          </>
        )}
      </section>
    </div>
  );
}

function ShipmentRow({ shipment }: { shipment: CustomerShipment }) {
  return (
    <tr className="customer-row-hover">
      <td className="px-4 py-3">
        <Link
          to={`/customer/shipments/${shipment.id}`}
          className="customer-primary font-bold hover:underline"
        >
          {shipment.shipmentNumber}
        </Link>
      </td>
      <td className="customer-text px-4 py-3 font-semibold">{shipment.order.number}</td>
      <td className="customer-text px-4 py-3">{shipment.contract.reference ?? 'Not provided'}</td>
      <td className="px-4 py-3">
        <p className="customer-text font-semibold">{shipment.product.name}</p>
        <p className="customer-muted text-xs">{shipment.product.code}</p>
      </td>
      <td className="customer-text px-4 py-3">{formatTons(shipment.quantityTon)}</td>
      <td className="customer-text px-4 py-3">{fulfilmentLabel(shipment.fulfilmentType)}</td>
      <td className="customer-text max-w-52 truncate px-4 py-3">{shipToLabel(shipment)}</td>
      <td className="px-4 py-3">
        <ShipmentStatus value={shipment.status} />
      </td>
      <td className="customer-text px-4 py-3">{formatDate(shipment.createdAt)}</td>
    </tr>
  );
}

function ShipmentCard({ shipment }: { shipment: CustomerShipment }) {
  return (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/customer/shipments/${shipment.id}`} className="customer-primary font-bold">
          {shipment.shipmentNumber}
        </Link>
        <ShipmentStatus value={shipment.status} />
      </div>
      <p className="customer-text text-sm font-semibold">{shipment.product.name}</p>
      <div className="customer-secondary grid grid-cols-2 gap-2 text-xs">
        <span>Order: {shipment.order.number}</span>
        <span>{formatTons(shipment.quantityTon)}</span>
        <span>{fulfilmentLabel(shipment.fulfilmentType)}</span>
        <span>{formatDate(shipment.createdAt)}</span>
      </div>
    </article>
  );
}

function Pagination({
  pagination,
  page,
  onPage,
}: {
  pagination: CustomerShipmentsList['pagination'] | undefined;
  page: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="customer-border-soft flex items-center justify-between border-t px-4 py-3">
      <span className="customer-muted text-xs">
        Showing {pagination?.total ? (page - 1) * 10 + 1 : 0}â€“
        {Math.min(page * 10, pagination?.total ?? 0)} of {pagination?.total ?? 0}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="customer-border customer-surface customer-text inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40"
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <span className="customer-primary-soft customer-primary flex h-9 min-w-9 items-center justify-center rounded-lg text-xs font-bold">
          {page}
        </span>
        <button
          type="button"
          disabled={page >= (pagination?.totalPages ?? 1)}
          onClick={() => onPage(page + 1)}
          className="customer-border customer-surface customer-text inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ShipmentSkeleton() {
  return (
    <div className="space-y-1 p-4">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="customer-surface-secondary h-12 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

export function ShipmentStatus({ value }: { value: CustomerShipmentStatus }) {
  const colors: Record<CustomerShipmentStatus, string> = {
    CREATED: 'bg-slate-400',
    ASSIGNED: 'bg-violet-500',
    LOADING: 'bg-amber-500',
    DISPATCHED: 'bg-blue-500',
    IN_TRANSIT: 'bg-cyan-500',
    DELIVERED: 'bg-emerald-500',
    CLOSED: 'bg-slate-500',
  };
  return (
    <span className="customer-text inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold">
      <span className={`h-2 w-2 rounded-full ${colors[value]}`} />
      {statusLabel(value)}
    </span>
  );
}

export function statusLabel(value: CustomerShipmentStatus) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function formatTons(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} TON`;
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function fulfilmentLabel(value: CustomerShipment['fulfilmentType']) {
  return value === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up';
}
function shipToLabel(shipment: CustomerShipment) {
  return shipment.shipTo?.name ?? shipment.shipTo?.city ?? 'Not provided';
}
