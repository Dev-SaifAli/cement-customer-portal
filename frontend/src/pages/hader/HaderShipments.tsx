import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listShipments,
  type InternalPagination,
  type Shipment,
} from '../../services/haderDeliveryService';
import { Pager, Skeleton, State, Status, date } from './HaderDeliveryRequests';

export function HaderShipments({ audience = 'hader' }: { audience?: 'hader' | 'sales' }) {
  const [items, setItems] = useState<Shipment[]>([]);
  const [pagination, setPagination] = useState<InternalPagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listShipments(page, query, status, audience);
      setItems(data.items);
      setPagination(data.pagination);
    } catch {
      setError('Unable to load shipments.');
    } finally {
      setLoading(false);
    }
  }, [audience, page, query, status]);
  useEffect(() => {
    void load();
  }, [load]);
  const base = audience === 'hader' ? '/hader/shipments' : '/sales/shipments';
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Shipments</h1>
        <p className="mt-1 text-sm text-slate-500">
          {audience === 'sales'
            ? 'Read-only customer shipment visibility.'
            : 'Review created shipment allocations.'}
        </p>
      </header>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shipment, order, customer or product"
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          >
            <option value="">All statuses</option>
            {[
              'CREATED',
              'ASSIGNED',
              'LOADING',
              'DISPATCHED',
              'IN_TRANSIT',
              'DELIVERED',
              'CLOSED',
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        {error ? (
          <State message={error} action={() => void load()} />
        ) : loading ? (
          <Skeleton />
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    'Shipment Number',
                    'Order',
                    'Customer',
                    'Product',
                    'Quantity TON',
                    'Scheduled Date',
                    'Status',
                  ].map((h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`${base}/${s.id}`}
                        className="font-semibold text-[#54247a] hover:underline"
                      >
                        {s.shipmentNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{s.deliveryRequest.order.number}</td>
                    <td className="px-4 py-3 font-medium">
                      {s.deliveryRequest.customer.companyName}
                    </td>
                    <td className="px-4 py-3">{s.deliveryRequest.product.name}</td>
                    <td className="px-4 py-3 font-semibold">{s.quantityTon.toFixed(3)}</td>
                    <td className="px-4 py-3">{date(s.scheduledDate)}</td>
                    <td className="px-4 py-3">
                      <Status value={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <State message="No shipments available." />
        )}
        <Pager pagination={pagination} onPage={setPage} />
      </section>
    </div>
  );
}
