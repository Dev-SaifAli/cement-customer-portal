import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import {
  listLoadingControl,
  type InternalPagination,
  type LoadingBoardItem,
} from '../../services/haderDeliveryService';
import { Pager, Skeleton, State, Status, label } from './HaderDeliveryRequests';

const empty = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
export function HaderLoadingControl() {
  const [items, setItems] = useState<LoadingBoardItem[]>([]);
  const [pagination, setPagination] = useState<InternalPagination>(empty);
  const [counters, setCounters] = useState({
    waiting: 0,
    notified: 0,
    atGate: 0,
    loading: 0,
    completed: 0,
  });
  const [products, setProducts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [product, setProduct] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listLoadingControl(page, status, product);
      setItems(data.items);
      setPagination(data.pagination);
      setCounters(data.counters);
      setProducts(data.products);
    } catch {
      setError('Unable to load Loading Control.');
    } finally {
      setLoading(false);
    }
  }, [page, status, product]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Loading Control</h1>
        <p className="mt-1 text-sm text-slate-500">Manage trucks arriving for plant loading.</p>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Object.entries({
          Waiting: counters.waiting,
          Notified: counters.notified,
          'At Gate': counters.atGate,
          Loading: counters.loading,
          Completed: counters.completed,
        }).map(([name, total]) => (
          <div key={name} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{name}</p>
            <p className="mt-1 text-xl font-bold">{total}</p>
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {['WAITING', 'NOTIFIED', 'AT_GATE', 'LOADING', 'LOADED'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setPage(1);
            }}
            className="h-10 min-w-64 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <State message={error} action={() => void load()} />
        ) : loading ? (
          <Skeleton />
        ) : items.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1150px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      'Queue #',
                      'Shipment Number',
                      'Order Number',
                      'Customer',
                      'Product',
                      'Quantity TON',
                      'Truck',
                      'Driver',
                      'Status',
                      'Loading Point',
                      'Arrival Time',
                      'Action',
                    ].map((h) => (
                      <th key={h} className="px-3 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-bold">#{item.queuePosition ?? '—'}</td>
                      <td className="px-3 py-3 font-semibold text-[#54247a]">
                        {item.shipmentNumber}
                      </td>
                      <td className="px-3 py-3">{item.orderNumber}</td>
                      <td className="px-3 py-3">{item.customer}</td>
                      <td className="px-3 py-3">
                        <span className="font-medium">{item.product.name}</span>
                        <span className="block text-xs text-slate-500">{item.product.code}</span>
                      </td>
                      <td className="px-3 py-3 font-semibold">{item.quantityTon.toFixed(3)}</td>
                      <td className="px-3 py-3">{item.truck ?? 'Not assigned'}</td>
                      <td className="px-3 py-3">{item.driver ?? 'Not assigned'}</td>
                      <td className="px-3 py-3">
                        <Status value={item.loadingStatus} />
                      </td>
                      <td className="px-3 py-3">{item.loadingPoint?.name ?? 'Unassigned'}</td>
                      <td className="px-3 py-3">
                        {item.arrivedAt
                          ? new Date(item.arrivedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Not arrived'}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/hader/loading-control/${item.id}`}
                          className="font-semibold text-[#54247a]"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {items.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex justify-between gap-2">
                    <Link
                      to={`/hader/loading-control/${item.id}`}
                      className="font-bold text-[#54247a]"
                    >
                      {item.shipmentNumber}
                    </Link>
                    <Status value={item.loadingStatus} />
                  </div>
                  <p className="mt-2 text-sm font-semibold">
                    Queue #{item.queuePosition ?? '—'} · {item.product.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {item.truck ?? 'Truck not assigned'} · {item.quantityTon.toFixed(3)} TON
                  </p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <State message="No shipments are currently in Loading Control." />
        )}
        <Pager pagination={pagination} onPage={setPage} />
      </section>
    </div>
  );
}

export function LoadingStatus({ value }: { value: string }) {
  return <span>{label(value)}</span>;
}
