import { ArrowLeft, Bell, CircleParking, Factory, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  assignLoadingPoint,
  completeShipmentLoading,
  getLoadingShipment,
  notifyLoadingDriver,
  recordLoadingArrival,
  startShipmentLoading,
  type LoadingDetail,
} from '../../services/haderDeliveryService';
import { Status, date } from './HaderDeliveryRequests';

export function HaderLoadingDetails() {
  const { id } = useParams();
  const [item, setItem] = useState<LoadingDetail | null>(null);
  const [point, setPoint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () => {
    if (id)
      getLoadingShipment(id)
        .then((v) => {
          setItem(v);
          setPoint(v.loading.loadingPoint?.id ?? '');
        })
        .catch(() => setError('Unable to load loading details.'));
  };
  useEffect(load, [id]);
  const act = async (work: () => Promise<LoadingDetail>) => {
    setBusy(true);
    setError('');
    try {
      setItem(await work());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update loading status.');
    } finally {
      setBusy(false);
    }
  };
  if (!item)
    return <div className="h-72 animate-pulse rounded-xl bg-white p-6 text-red-600">{error}</div>;
  const l = item.loading;
  return (
    <div className="space-y-4">
      <header>
        <Link
          to="/hader/loading-control"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#54247a]"
        >
          <ArrowLeft size={16} />
          Loading Control
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{item.shipmentNumber}</h1>
          <Status value={l.loadingStatus} />
        </div>
      </header>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Shipment">
          <Info label="Order" value={item.deliveryRequest.order.number} />
          <Info label="Customer" value={item.deliveryRequest.customer.companyName} />
          <Info label="Quantity" value={`${item.quantityTon.toFixed(3)} TON`} />
          <Info label="Equivalent Bags" value={item.deliveryRequest.equivalentBags} />
        </Card>
        <Card title="Product & Queue">
          <Info label="Product" value={item.deliveryRequest.product.name} />
          <Info label="Packaging" value={item.deliveryRequest.product.packaging} />
          <Info label="Product Queue" value={`#${l.queuePosition ?? '—'}`} />
          <Info
            label="Scheduled"
            value={`${date(item.scheduledDate)} ${item.scheduledTime ?? ''}`}
          />
        </Card>
        <Card title="Truck & Driver">
          <Info label="Truck" value={item.assignment?.truck?.plateNumber} />
          <Info label="Driver" value={item.assignment?.driver?.name} />
          <Info label="Loading Point" value={l.loadingPoint?.name} />
          <Info
            label="Arrival"
            value={l.arrivedAt ? new Date(l.arrivedAt).toLocaleString() : null}
          />
        </Card>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-[#54247a]">Loading Actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {l.loadingStatus === 'WAITING' && (
            <Button disabled={busy} onClick={() => void act(() => notifyLoadingDriver(item.id))}>
              <Bell size={16} />
              Notify Driver
            </Button>
          )}
          {l.loadingStatus === 'NOTIFIED' && (
            <>
              <Button
                disabled={busy}
                secondary
                onClick={() => void act(() => notifyLoadingDriver(item.id, true))}
              >
                <RefreshCw size={16} />
                Remind Driver
              </Button>
              {!l.arrivedAt ? (
                <Button
                  disabled={busy}
                  onClick={() => void act(() => recordLoadingArrival(item.id, 'PARKING'))}
                >
                  <CircleParking size={16} />
                  Mark Arrived at Parking
                </Button>
              ) : (
                <Button
                  disabled={busy}
                  onClick={() => void act(() => recordLoadingArrival(item.id, 'GATE'))}
                >
                  Mark At Gate
                </Button>
              )}
            </>
          )}
          {l.loadingStatus === 'AT_GATE' && (
            <>
              <select
                value={point}
                onChange={(e) => setPoint(e.target.value)}
                className="h-10 min-w-64 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Select compatible loading point</option>
                {item.compatibleLoadingPoints.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                    {p.type === 'BAGGING_LINE' && p.capacityTonPerHour
                      ? ` · ${p.capacityTonPerHour} TON/hour · ${p.maxTrucks} trucks`
                      : p.capacityTon
                        ? ` · ${p.capacityTon} TON`
                        : ''}
                  </option>
                ))}
              </select>
              {!item.compatibleLoadingPoints.length && (
                <span className="self-center text-sm text-amber-700">
                  No compatible loading points configured.
                </span>
              )}
              <Button
                disabled={busy || !point}
                secondary
                onClick={() => void act(() => assignLoadingPoint(item.id, point))}
              >
                Assign Point
              </Button>
              <Button
                disabled={busy || !l.loadingPoint}
                onClick={() => void act(() => startShipmentLoading(item.id))}
              >
                <Factory size={16} />
                Start Loading
              </Button>
            </>
          )}
          {l.loadingStatus === 'LOADING' && (
            <Button
              disabled={busy}
              onClick={() => void act(() => completeShipmentLoading(item.id))}
            >
              Complete Loading
            </Button>
          )}
          {l.loadingStatus === 'LOADED' && (
            <p className="text-sm font-semibold text-emerald-700">
              Loading completed. Shipment is ready for Dispatch.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
function Button({
  children,
  onClick,
  disabled,
  secondary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-50 ${secondary ? 'border border-[#54247a] text-[#54247a]' : 'bg-[#54247a] text-white'}`}
    >
      {children}
    </button>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="border-b border-slate-200 pb-3 font-bold text-[#54247a]">{title}</h2>
      <dl className="mt-3 space-y-3">{children}</dl>
    </section>
  );
}
function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value || 'Not provided'}</dd>
    </div>
  );
}
