import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listShipToVarianceChargeApprovals,
  type ShipToVarianceDecision,
} from '../../services/shipToVarianceService';

export function CommercialDirectorVarianceApprovalsPage() {
  const [items, setItems] = useState<ShipToVarianceDecision[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listShipToVarianceChargeApprovals(page)
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
          setPagination(result.pagination);
        }
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [page]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="customer-text text-2xl font-bold">Ship-to Variance Approvals</h1>
        <p className="customer-secondary mt-1 text-sm">Review extra-charge requests raised by Price Managers.</p>
      </div>
      <section className="customer-card overflow-hidden rounded-xl border">
        <div className="customer-border-soft flex items-center justify-between border-b p-4">
          <span className="customer-text text-sm font-semibold">Pending Approval</span>
          <span className="customer-secondary text-sm">{pagination.total} Requests</span>
        </div>
        {loading ? <State text="Loading approval requests..." /> : error ? <State text="Unable to load approval requests." /> : items.length === 0 ? <State text="No pending extra-charge approvals." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1720px] text-left text-sm">
              <thead className="customer-surface-secondary customer-secondary text-xs"><tr>
                <th className="px-4 py-3">Shipment ID</th>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Ordered City</th>
                <th className="px-4 py-3">Actual City</th>
                <th className="px-4 py-3">Ordered Price</th>
                <th className="px-4 py-3">Actual Price</th>
                <th className="px-4 py-3">Difference / TON</th>
                <th className="px-4 py-3">Extra Charge</th>
                <th className="px-4 py-3">Raised By</th>
                <th className="px-4 py-3">Raised At</th>
                <th className="px-4 py-3">Status</th>
              </tr></thead>
              <tbody className="customer-divide divide-y">{items.map((item) => <tr key={item.id} className="customer-table-row">
                <td className="px-4 py-3 font-semibold"><Link className="customer-primary hover:underline" to={`/sales/ship-to-variance-approvals/${item.id}`}>{item.shipment.number}</Link></td>
                <td className="px-4 py-3">{item.order.number}</td>
                <td className="px-4 py-3">{item.customer.companyName}</td>
                <td className="px-4 py-3">{item.product.name}</td>
                <td className="px-4 py-3">{number(item.quantityTon)} TON</td>
                <td className="px-4 py-3">{item.orderedCity.name}</td>
                <td className="px-4 py-3">{item.actualCity.name}</td>
                <td className="px-4 py-3">{money(item.orderedPricePerTon)}</td>
                <td className="px-4 py-3">{money(item.actualPricePerTon)}</td>
                <td className="px-4 py-3">{money(item.differencePerTon)}</td>
                <td className="px-4 py-3 font-semibold">{money(item.extraCharge)}</td>
                <td className="px-4 py-3">{item.raisedOrDismissedBy}</td>
                <td className="px-4 py-3">{dateTime(item.createdAt)}</td>
                <td className="px-4 py-3"><Status value={item.status} /></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="customer-border-soft flex justify-end gap-2 border-t p-3">
          <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="customer-border rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="customer-border rounded-lg border p-2 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      </section>
    </div>
  );
}

function State({ text }: { text: string }) { return <div className="customer-secondary flex min-h-48 items-center justify-center p-8 text-sm">{text}</div>; }
function money(value: number) { return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`; }
function number(value: number) { return value.toLocaleString(undefined, { maximumFractionDigits: 3 }); }
function dateTime(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
function Status({ value }: { value: ShipToVarianceDecision['status'] }) {
  return <span className="inline-flex items-center gap-2 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-amber-500" />{value === 'PENDING_APPROVAL' ? 'Pending Approval' : value}</span>;
}
