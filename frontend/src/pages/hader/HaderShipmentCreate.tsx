import { ArrowLeft, PackageCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  createShipment,
  getDeliveryRequest,
  type DeliveryRequest,
} from '../../services/haderDeliveryService';

export function HaderShipmentCreate() {
  const [params] = useSearchParams();
  const requestId = params.get('requestId');
  const navigate = useNavigate();
  const [item, setItem] = useState<DeliveryRequest | null>(null);
  const [quantity, setQuantity] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (requestId)
      getDeliveryRequest(requestId)
        .then(setItem)
        .catch(() => setError('Unable to load delivery request.'));
  }, [requestId]);
  const submit = async () => {
    if (!requestId || !item) return;
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0 || amount > item.remainingTon) {
      setError(`Enter a quantity between 0 and ${item.remainingTon.toFixed(3)} TON.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const shipment = await createShipment(requestId, {
        quantityTon: amount,
        ...(scheduledDate ? { scheduledDate } : {}),
      });
      navigate(`/hader/shipments/${shipment.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create shipment.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <Link
          to={requestId ? `/hader/delivery-requests/${requestId}` : '/hader/delivery-requests'}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#54247a]"
        >
          <ArrowLeft size={16} />
          Back to request
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Create Shipment</h1>
        <p className="mt-1 text-sm text-slate-500">
          Shipment data is inherited from the approved delivery request.
        </p>
      </header>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {item ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
            <Summary label="Request" value={item.requestNumber} />
            <Summary label="Order" value={item.order.number} />
            <Summary label="Customer" value={item.customer.companyName} />
            <Summary label="Product" value={item.product.name} />
            <Summary label="Hader City" value={item.haderCity.name ?? 'Not configured'} />
            <Summary label="Ship-to" value={String(item.shipTo?.name ?? 'Not provided')} />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Shipment Quantity (TON) *
              <input
                type="number"
                min="0.001"
                max={item.remainingTon}
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Remaining: {item.remainingTon.toFixed(3)} TON
              </span>
            </label>
            <label className="text-sm font-semibold">
              Scheduled Date
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3"
              />
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              disabled={saving}
              onClick={() => void submit()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#54247a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <PackageCheck size={17} />
              {saving ? 'Creating...' : 'Create Shipment'}
            </button>
          </div>
        </section>
      ) : (
        !error && <div className="h-64 animate-pulse rounded-xl bg-white" />
      )}
    </div>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
