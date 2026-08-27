import { ArrowLeft, CheckCircle2, PackagePlus, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  approveDeliveryRequest,
  getDeliveryRequest,
  rejectDeliveryRequest,
  type DeliveryRequest,
} from '../../services/haderDeliveryService';
import { Status, date, text } from './HaderDeliveryRequests';

export function HaderDeliveryRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<DeliveryRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setItem(await getDeliveryRequest(id));
    } catch {
      setError('Unable to load delivery request.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [id]);
  const approve = async () => {
    if (!id) return;
    setBusy(true);
    try {
      setItem(await approveDeliveryRequest(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to approve request.');
    } finally {
      setBusy(false);
    }
  };
  const reject = async () => {
    if (!id || !reason.trim()) return;
    setBusy(true);
    try {
      setItem(await rejectDeliveryRequest(id, reason.trim()));
      setRejecting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to reject request.');
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <div className="h-72 animate-pulse rounded-xl bg-white" />;
  if (!item)
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-red-600">
        {error || 'Delivery request was not found.'}
      </div>
    );
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/hader/delivery-requests"
            className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#54247a]"
          >
            <ArrowLeft size={16} />
            Delivery Requests
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{item.requestNumber}</h1>
            <Status value={item.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Order {item.order.number} · Contract {item.contract.reference ?? 'Not provided'}
          </p>
        </div>
        <div className="flex gap-2">
          {['PENDING', 'UNDER_REVIEW'].includes(item.status) && (
            <>
              <button
                disabled={busy}
                onClick={() => setRejecting(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <XCircle size={16} />
                Reject Request
              </button>
              <button
                disabled={busy}
                onClick={() => void approve()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#54247a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#472066]"
              >
                <CheckCircle2 size={16} />
                Approve Request
              </button>
            </>
          )}
          {['APPROVED', 'CONVERTED_TO_SHIPMENT'].includes(item.status) && item.remainingTon > 0 && (
            <button
              onClick={() => navigate(`/hader/shipments/create?requestId=${item.id}`)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#54247a] px-4 py-2 text-sm font-semibold text-white"
            >
              <PackagePlus size={16} />
              Create Shipment
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Customer Information">
          <Info label="Company Name" value={item.customer.companyName} />
          <Info label="Contact" value={item.customer.contact} />
          <Info label="Phone" value={item.customer.phone} />
        </Card>
        <Card title="Order Information">
          <Info label="Product" value={`${item.product.name} (${item.product.code})`} />
          <Info label="Packaging / UOM" value={`${item.product.packaging} · ${item.product.uom}`} />
          <Info label="Quantity" value={`${item.quantityTon.toFixed(3)} TON`} />
          <Info label="Equivalent Bags" value={item.equivalentBags?.toLocaleString() ?? 'N/A'} />
          <Info
            label="Customer Rate"
            value={`${item.customerRatePerTon.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR / TON`}
          />
          <Info
            label="Total Amount"
            value={`${item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`}
          />
          <Info label="Fulfilment" value="Delivery" />
          <Info label="Hader City" value={item.haderCity.name} />
        </Card>
        <Card title="Delivery Information">
          <Info label="Ship-to" value={text(item.shipTo, 'name')} />
          <Info
            label="City / Region"
            value={[text(item.shipTo, 'city'), text(item.shipTo, 'region')]
              .filter(Boolean)
              .join(', ')}
          />
          <Info label="Requested Date" value={date(item.requestedDate)} />
          <Info label="Customer Notes" value={item.notes} />
        </Card>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-[#54247a]">Shipment Allocation</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Metric label="Requested" value={item.quantityTon} />
          <Metric label="Created" value={item.shippedTon} />
          <Metric label="Remaining" value={item.remainingTon} />
        </div>
      </section>
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">Reject Delivery Request</h2>
            <p className="mt-1 text-sm text-slate-500">Provide a reason for the audit history.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-4 min-h-28 w-full rounded-lg border border-slate-200 p-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRejecting(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={!reason.trim() || busy}
                onClick={() => void reject()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="border-b border-slate-100 pb-3 font-bold text-[#54247a]">{title}</h2>
      <dl className="mt-3 space-y-3">{children}</dl>
    </section>
  );
}
function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value || 'Not provided'}</dd>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value.toFixed(3)} TON</p>
    </div>
  );
}
