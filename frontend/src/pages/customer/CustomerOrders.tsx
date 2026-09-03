import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { ChevronLeft, ChevronRight, PackageOpen, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listCustomerOrders,
  type CustomerOrdersList,
  type OrderStatus,
} from '../../services/customerOrdersService';

export function CustomerOrders() {
  const [result, setResult] = useState<CustomerOrdersList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState<'DIRECT' | 'CONTRACT' | ''>('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let cancelled = false;
      setLoading(true);
      listCustomerOrders({ page, search: search.trim(), orderType, status })
        .then((data) => {
          if (!cancelled) setResult(data);
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
  }, [orderType, page, search, status]);

  const pagination = result?.pagination;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="customer-text text-2xl font-bold">Orders</h1>
        <p className="customer-secondary mt-1 text-sm">
          Track direct orders and orders placed against your active contracts.
        </p>
      </div>
      <section className="customer-card overflow-hidden rounded-2xl border">
        <div className="customer-border-soft flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="customer-input customer-border flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border px-3">
            <Search size={16} className="customer-muted" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="customer-input customer-text min-w-0 flex-1 outline-none"
              placeholder="Order, contract or product"
            />
          </div>
          <div className="flex items-center gap-3">
            <NativeTomSelect
              value={orderType}
              onChange={(event) => {
                setOrderType(event.target.value as 'DIRECT' | 'CONTRACT' | '');
                setPage(1);
              }}
              className="customer-input customer-border customer-text h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All Order Types</option>
              <option value="DIRECT">Direct</option>
              <option value="CONTRACT">Contract</option>
            </NativeTomSelect>
            <NativeTomSelect
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as OrderStatus | '');
                setPage(1);
              }}
              className="customer-input customer-border customer-text h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </NativeTomSelect>
            <span className="customer-secondary whitespace-nowrap text-sm font-semibold">
              {pagination?.total ?? 0} Orders
            </span>
          </div>
        </div>
        {loading ? (
          <TableState text="Loading orders..." />
        ) : error ? (
          <TableState text={error} error />
        ) : !result?.items.length ? (
          <div className="px-6 py-14 text-center">
            <PackageOpen size={34} className="customer-muted mx-auto" />
            <h2 className="customer-text mt-3 font-bold">No orders yet</h2>
            <p className="customer-secondary mt-1 text-sm">
              Create a direct order or place an order from an active contract.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="customer-surface-secondary customer-secondary text-xs">
                  <tr>
                    <th className="px-4 py-3">Order Number</th>
                    <th className="px-4 py-3">Order Type</th>
                    <th className="px-4 py-3">Contract Number</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Quantity TON</th>
                    <th className="px-4 py-3">Fulfilment</th>
                    <th className="px-4 py-3">Created Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="customer-border-soft divide-y">
                  {result.items.map((order) => (
                    <tr key={order.id} className="customer-row-hover">
                      <td className="px-4 py-3">
                        <Link
                          to={`/customer/orders/${order.id}`}
                          className="customer-primary font-bold hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="customer-text px-4 py-3 font-semibold">
                        {order.orderType === 'DIRECT' ? 'Direct' : 'Contract'}
                      </td>
                      <td className="customer-text px-4 py-3 font-semibold">
                        {order.contract?.reference ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="customer-text font-semibold">{order.product.name}</p>
                        <p className="customer-muted text-xs">{order.product.code}</p>
                      </td>
                      <td className="customer-text px-4 py-3">
                        {formatTons(order.requestedQuantityTons)}
                      </td>
                      <td className="customer-text px-4 py-3">
                        {order.fulfilmentType === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up'}
                      </td>
                      <td className="customer-text px-4 py-3">{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Status value={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="customer-border-soft flex items-center justify-between border-t px-4 py-3">
              <span className="customer-muted text-xs">
                Showing {pagination?.total ? (page - 1) * 10 + 1 : 0}â€“
                {Math.min(page * 10, pagination?.total ?? 0)} of {pagination?.total ?? 0}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="customer-border customer-surface customer-text inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="customer-primary-soft customer-primary flex h-9 min-w-9 items-center justify-center rounded-lg text-xs font-bold">
                  {page}
                </span>
                <button
                  disabled={page >= (pagination?.totalPages ?? 1)}
                  onClick={() => setPage((current) => current + 1)}
                  className="customer-border customer-surface customer-text inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40"
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

function TableState({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div
      className={`px-6 py-14 text-center text-sm font-semibold ${error ? 'text-red-600' : 'customer-secondary'}`}
    >
      {text}
    </div>
  );
}
function Status({ value }: { value: OrderStatus }) {
  const colors: Record<OrderStatus, string> = {
    DRAFT: 'bg-slate-400',
    SUBMITTED: 'bg-amber-500',
    PROCESSING: 'bg-blue-500',
    COMPLETED: 'bg-emerald-500',
    CANCELLED: 'bg-red-500',
  };
  return (
    <span className="customer-text inline-flex items-center gap-2 text-xs font-semibold">
      <span className={`h-2 w-2 rounded-full ${colors[value]}`} />
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
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
