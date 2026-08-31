import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  listShipToVariances,
  type ShipToVariance,
  type ShipToVarianceStatus,
} from '../../services/shipToVarianceService';

type ListStatus = Exclude<ShipToVarianceStatus, 'NO_VARIANCE'> | '';

export function PriceManagerShipToVariancesPage() {
  const [items, setItems] = useState<ShipToVariance[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListStatus>('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let cancelled = false;
      setLoading(true);
      setError(false);
      listShipToVariances({ page, search: search.trim(), status })
        .then((data) => {
          if (!cancelled) {
            setItems(data.items);
            setPagination(data.pagination);
            setSelected([]);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
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

  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="customer-text text-2xl font-bold">Ship-to Variance</h1>
        <p className="customer-secondary mt-1 text-sm">
          Review delivered shipments whose actual delivery city differs from the priced city.
        </p>
      </div>

      <section className="customer-card overflow-hidden rounded-xl border">
        <div className="customer-border-soft flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="customer-input flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border px-3">
            <Search size={16} className="customer-muted" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="customer-text min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Shipment, order, customer, product or city"
            />
          </div>
          <div className="flex items-center gap-3">
            <NativeTomSelect
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ListStatus);
                setPage(1);
              }}
              className="customer-input h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="VARIANCE_DETECTED">Variance detected</option>
              <option value="PRICING_NOT_CONFIGURED">Pricing not configured</option>
            </NativeTomSelect>
            <span className="customer-secondary whitespace-nowrap text-sm font-semibold">
              {pagination.total} Variances
            </span>
          </div>
        </div>

        {loading ? (
          <PageState text="Loading ship-to variances..." />
        ) : error ? (
          <PageState
            text="Unable to load ship-to variances."
            action={<button onClick={() => setRefreshKey((value) => value + 1)}>Retry</button>}
          />
        ) : items.length === 0 ? (
          <PageState text="No ship-to variances found." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1410px] w-full text-left text-sm">
                <thead className="customer-surface-secondary customer-secondary text-xs">
                  <tr>
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))}
                        aria-label="Select visible variances"
                      />
                    </th>
                    <th className="px-3 py-3">S.No.</th>
                    <th className="px-3 py-3">Shipment ID</th>
                    <th className="px-3 py-3">Order ID</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">Quantity</th>
                    <th className="px-3 py-3">Ordered City</th>
                    <th className="px-3 py-3">Actual City</th>
                    <th className="px-3 py-3">Ordered Price</th>
                    <th className="px-3 py-3">Actual Price</th>
                    <th className="px-3 py-3">Difference / TON</th>
                    <th className="px-3 py-3">Extra Charge</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="customer-divide divide-y">
                  {items.map((item, index) => (
                    <tr key={item.id} className="customer-table-row">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          onChange={() =>
                            setSelected((current) =>
                              current.includes(item.id)
                                ? current.filter((id) => id !== item.id)
                                : [...current, item.id],
                            )
                          }
                          aria-label={`Select ${item.shipment.number}`}
                        />
                      </td>
                      <td className="customer-muted px-3 py-3">{(page - 1) * 10 + index + 1}</td>
                      <td className="px-3 py-3 font-semibold">
                        <Link
                          className="customer-primary rounded-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
                          to={`/sales/ship-to-variance/${item.shipment.id}`}
                        >
                          {item.shipment.number}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{item.order.number}</td>
                      <td className="px-3 py-3 font-semibold">{item.customer.companyName}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{item.product.name}</p>
                        <p className="customer-muted text-xs">{item.product.code}</p>
                      </td>
                      <td className="px-3 py-3">{quantity(item.quantityTon)} TON</td>
                      <td className="px-3 py-3">{item.orderedCity.name}</td>
                      <td className="px-3 py-3 font-semibold">{item.actualCity.name}</td>
                      <td className="px-3 py-3">{money(item.orderedPricePerTon)}</td>
                      <td className="px-3 py-3">{nullableMoney(item.actualPricePerTon)}</td>
                      <td className="px-3 py-3">{nullableMoney(item.differencePerTon)}</td>
                      <td className="px-3 py-3 font-semibold">{nullableMoney(item.extraCharge)}</td>
                      <td className="px-3 py-3"><VarianceStatus status={item.status} /></td>
                      <td className="customer-secondary px-3 py-3">{dateTime(item.lastUpdated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="customer-border-soft flex items-center justify-between border-t px-4 py-3">
              <span className="customer-secondary text-xs">
                {selected.length ? `${selected.length} selected · ` : ''}Showing{' '}
                {pagination.total ? (page - 1) * 10 + 1 : 0}â€“{Math.min(page * 10, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-2">
                <PaginationButton disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  <ChevronLeft size={14} /> Previous
                </PaginationButton>
                <PaginationButton disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>
                  Next <ChevronRight size={14} />
                </PaginationButton>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function VarianceStatus({ status }: { status: ShipToVarianceStatus }) {
  const warning = status === 'PRICING_NOT_CONFIGURED';
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold">
      <span className={`h-2 w-2 rounded-full ${warning ? 'bg-amber-500' : 'bg-red-500'}`} />
      {warning ? 'Pricing not configured' : 'Variance detected'}
    </span>
  );
}

function PageState({ text, action }: { text: string; action?: ReactNode }) {
  return <div className="customer-secondary flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-sm font-semibold">{text}{action}</div>;
}

function PaginationButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className="customer-border customer-secondary inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40">{children}</button>;
}

function money(value: number) {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function nullableMoney(value: number | null) {
  return value === null ? 'Not configured' : money(value);
}

function quantity(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
