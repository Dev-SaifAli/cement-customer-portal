import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listDeliveryRequests,
  type DeliveryRequest,
  type InternalPagination,
} from '../../services/haderDeliveryService';

const empty = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
export function HaderDeliveryRequests() {
  const [items, setItems] = useState<DeliveryRequest[]>([]);
  const [pagination, setPagination] = useState<InternalPagination>(empty);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listDeliveryRequests(page, query, status);
      setItems(data.items);
      setPagination(data.pagination);
    } catch {
      setError('Unable to load delivery requests.');
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Delivery Requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review submitted customer delivery orders and create shipments.
        </p>
      </header>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search request, order, customer or product"
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#54247a]"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            >
              <option value="">All statuses</option>
              {['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED_TO_SHIPMENT'].map(
                (v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ),
              )}
            </select>
            <span className="text-sm font-semibold text-slate-600">
              {pagination.total} Requests
            </span>
          </div>
        </div>
        {error ? (
          <State message={error} action={() => void load()} />
        ) : loading ? (
          <Skeleton />
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    'Request Number',
                    'Order Number',
                    'Customer',
                    'Product',
                    'Quantity TON',
                    'Hader City',
                    'Boundary',
                    'Ship-to Location',
                    'Requested Date',
                    'Status',
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/hader/delivery-requests/${item.id}`}
                        className="font-semibold text-[#54247a] hover:underline"
                      >
                        {item.requestNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{item.order.number}</td>
                    <td className="px-4 py-3 font-medium">{item.customer.companyName}</td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{item.product.name}</span>
                      <span className="text-xs text-slate-500">{item.product.code}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{item.quantityTon.toFixed(3)}</td>
                    <td className="px-4 py-3">{item.haderCity.name ?? 'Not configured'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 whitespace-nowrap font-medium ${item.haderZoneStatus === 'WITHIN_HADER_ZONE' ? 'text-emerald-700' : item.haderZoneStatus === 'OUTSIDE_HADER_ZONE' ? 'text-red-700' : 'text-slate-500'}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${item.haderZoneStatus === 'WITHIN_HADER_ZONE' ? 'bg-emerald-500' : item.haderZoneStatus === 'OUTSIDE_HADER_ZONE' ? 'bg-red-500' : 'bg-slate-400'}`}
                        />
                        {item.haderZoneStatus === 'WITHIN_HADER_ZONE'
                          ? 'Within Zone'
                          : item.haderZoneStatus === 'OUTSIDE_HADER_ZONE'
                            ? 'Outside Zone'
                            : 'Not evaluated'}
                      </span>
                    </td>
                    <td className="max-w-52 truncate px-4 py-3">
                      {text(item.shipTo, 'name') || 'Not provided'}
                    </td>
                    <td className="px-4 py-3">{date(item.requestedDate)}</td>
                    <td className="px-4 py-3">
                      <Status value={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <State message="No delivery requests available." />
        )}
        <Pager pagination={pagination} onPage={setPage} />
      </section>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-500',
    UNDER_REVIEW: 'bg-blue-500',
    APPROVED: 'bg-emerald-500',
    REJECTED: 'bg-red-500',
    CONVERTED_TO_SHIPMENT: 'bg-purple-500',
    CREATED: 'bg-purple-500',
    ASSIGNED: 'bg-blue-500',
    WAITING: 'bg-slate-400',
    NOTIFIED: 'bg-violet-500',
    AT_GATE: 'bg-cyan-500',
    LOADING: 'bg-amber-500',
    LOADED: 'bg-emerald-500',
    DISPATCHED: 'bg-indigo-500',
    IN_TRANSIT: 'bg-cyan-500',
    DELIVERED: 'bg-emerald-500',
    CLOSED: 'bg-slate-500',
  };
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium">
      <span className={`h-2 w-2 rounded-full ${colors[value] ?? 'bg-slate-400'}`} />
      {label(value)}
    </span>
  );
}
export function Pager({
  pagination,
  onPage,
}: {
  pagination: InternalPagination;
  onPage: (p: number) => void;
}) {
  if (!pagination.total) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
      <span>
        Showing {(pagination.page - 1) * 10 + 1}–{Math.min(pagination.page * 10, pagination.total)}{' '}
        of {pagination.total}
      </span>
      <div className="flex gap-2">
        <button
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="rounded-md border p-2 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="rounded-md border border-[#54247a] px-3 py-2 font-semibold text-[#54247a]">
          {pagination.page}
        </span>
        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
          className="rounded-md border p-2 disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function State({ message, action }: { message: string; action?: () => void }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center p-8 text-sm text-slate-500">
      <p>{message}</p>
      {action && (
        <button onClick={action} className="mt-3 font-semibold text-[#54247a]">
          Retry
        </button>
      )}
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-11 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  );
}
export function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
export function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(`${value}T00:00:00`),
      )
    : 'Not provided';
}
export function text(value: Record<string, unknown> | null, key: string) {
  const item = value?.[key];
  return typeof item === 'string' ? item : '';
}
