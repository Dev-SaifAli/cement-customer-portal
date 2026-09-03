import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listSalesOrders, type SalesOrder } from '../../services/salesOrdersService';
import type { OrderStatus } from '../../services/customerOrdersService';

export function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') setRefreshKey((value) => value + 1);
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let cancelled = false;
      setLoading(true);
      setError('');
      listSalesOrders({ page, search: search.trim(), status })
        .then((data) => {
          if (!cancelled) {
            setOrders(data.items);
            setPagination(data.pagination);
          }
        })
        .catch(() => {
          if (!cancelled) setError('Unable to load orders.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, refreshKey, search, status]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1b23]">Customer Orders</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Review submitted direct and contract orders and start processing.
        </p>
      </div>
      <section className="overflow-hidden rounded-2xl border border-[#e3e1e8] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#eceaf0] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-[#e3e1e8] px-3">
            <Search size={16} className="text-[#64748b]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="min-w-0 flex-1 outline-none"
              placeholder="Order, contract, customer or product"
            />
          </div>
          <div className="flex items-center gap-3">
            <NativeTomSelect
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as OrderStatus | '');
                setPage(1);
              }}
              className="h-10 rounded-lg border border-[#e3e1e8] px-3 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </NativeTomSelect>
            <span className="whitespace-nowrap text-sm font-semibold text-[#64748b]">
              {pagination.total} Orders
            </span>
          </div>
        </div>
        {loading ? (
          <State text="Loading orders..." />
        ) : error ? (
          <State text={error} error />
        ) : !orders.length ? (
          <State text="No customer orders available." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs text-[#64748b]">
                  <tr>
                    <th className="px-4 py-3">Order Number</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Order Type</th>
                    <th className="px-4 py-3">Contract</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Quantity TON</th>
                    <th className="px-4 py-3">Fulfilment</th>
                    <th className="px-4 py-3">Shipment Status</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceaf0]">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-[#faf8fc]">
                      <td className="px-4 py-3 font-bold text-[#54247a]">
                        <Link
                          to={`/sales/orders/${order.id}`}
                          className="hover:text-[#472066] hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1a1b23]">
                        {order.customer.companyName}
                      </td>
                      <td className="px-4 py-3">
                        {order.orderType === 'DIRECT' ? 'Direct' : 'Contract'}
                      </td>
                      <td className="px-4 py-3">{order.contract?.reference ?? 'Direct Order'}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{order.product.name}</p>
                        <p className="text-xs text-[#64748b]">{order.product.code}</p>
                      </td>
                      <td className="px-4 py-3">
                        {order.requestedQuantityTons.toLocaleString(undefined, {
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p>{order.fulfilmentType === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up'}</p>
                        {order.fulfilmentType === 'PICKUP' && (
                          <p className="mt-1 text-xs text-[#64748b]">
                            {order.pickupTruck?.plateNumber ?? 'Truck unavailable'} ·{' '}
                            {order.pickupDriver?.name ?? 'Driver unavailable'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {order.fulfilmentType === 'PICKUP'
                          ? 'Not applicable'
                          : order.shipmentSummary.count
                            ? `${label(order.shipmentSummary.latestStatus ?? 'CREATED')} (${order.shipmentSummary.count})`
                            : 'Not created'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold">
                          <span
                            className={`h-2 w-2 rounded-full ${order.status === 'PROCESSING' ? 'bg-blue-600' : 'bg-amber-500'}`}
                          />
                          {label(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748b]">{date(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#eceaf0] px-4 py-3">
              <span className="text-xs text-[#64748b]">
                Showing {pagination.total ? (page - 1) * 10 + 1 : 0}â€“
                {Math.min(page * 10, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#e3e1e8] px-3 text-xs font-semibold disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#e3e1e8] px-3 text-xs font-semibold disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
function State({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div
      className={`px-6 py-14 text-center text-sm font-semibold ${error ? 'text-red-600' : 'text-[#64748b]'}`}
    >
      {text}
    </div>
  );
}
function label(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
