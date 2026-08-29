import { ArrowLeft, CalendarClock, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  dispatchShipment,
  getDispatchShipment,
  scheduleShipment,
  type DispatchShipment,
} from '../../services/haderDeliveryService';
import { Status, date, label, text } from './HaderDeliveryRequests';

export function HaderDispatchDetails() {
  const { id } = useParams();
  const [shipment, setShipment] = useState<DispatchShipment | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!id) return;
    getDispatchShipment(id)
      .then((value) => {
        setShipment(value);
        setScheduledDate(value.scheduledDate ?? '');
        setScheduledTime(value.scheduledTime ?? '');
      })
      .catch(() => setError('Unable to load dispatch details.'));
  }, [id]);
  const schedule = async () => {
    if (!id || !scheduledDate || !scheduledTime) {
      setError('Scheduled date and time are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      setShipment(await scheduleShipment(id, { scheduledDate, scheduledTime }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to schedule shipment.');
    } finally {
      setSaving(false);
    }
  };
  const dispatch = async () => {
    if (!id || !window.confirm('Dispatch this shipment now?')) return;
    setSaving(true);
    setError('');
    try {
      setShipment(await dispatchShipment(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to dispatch shipment.');
    } finally {
      setSaving(false);
    }
  };
  if (!shipment)
    return <div className="h-72 animate-pulse rounded-xl bg-white p-6 text-red-600">{error}</div>;
  const request = shipment.deliveryRequest;
  return (
    <div className="space-y-4">
      <header>
        <Link
          to="/hader/dispatch"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#54247a]"
        >
          <ArrowLeft size={16} /> Dispatch Board
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{shipment.shipmentNumber}</h1>
          <Status value={shipment.status} />
        </div>
      </header>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Shipment">
          <Info label="Order" value={request.order.number} />
          <Info label="Contract" value={request.contract?.reference ?? 'Direct Order'} />
          <Info label="Quantity" value={`${shipment.quantityTon.toFixed(3)} TON`} />
          <Info label="Equivalent Bags" value={request.equivalentBags?.toLocaleString()} />
          <Info label="Requested Date" value={date(request.requestedDate)} />
        </Card>
        <Card title="Customer & Product">
          <Info label="Customer" value={request.customer.companyName} />
          <Info label="Product" value={`${request.product.name} (${request.product.code})`} />
          <Info label="Packaging" value={request.product.packaging} />
          <Info label="Hader City" value={request.haderCity.name} />
          <Info label="Ship-to" value={text(request.shipTo, 'name')} />
        </Card>
        <Card title="Assignment">
          <Info label="Transporter" value={shipment.assignment?.transporter.name} />
          <Info label="Truck" value={shipment.assignment?.truck?.plateNumber} />
          <Info label="Driver" value={shipment.assignment?.driver?.name} />
          <Info
            label="Schedule"
            value={
              shipment.scheduledDate
                ? `${date(shipment.scheduledDate)} ${shipment.scheduledTime ?? ''}`
                : null
            }
          />
        </Card>
      </div>
      {shipment.status === 'ASSIGNED' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-bold text-[#54247a]">
            <CalendarClock size={18} /> Schedule & Dispatch
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm font-semibold">
              Scheduled Date
              <input
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
                className="mt-2 block h-10 rounded-lg border border-slate-200 px-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Scheduled Time
              <input
                type="time"
                value={scheduledTime}
                onChange={(event) => setScheduledTime(event.target.value)}
                className="mt-2 block h-10 rounded-lg border border-slate-200 px-3"
              />
            </label>
            <button
              disabled={saving}
              onClick={() => void schedule()}
              className="h-10 rounded-lg border border-[#54247a] px-4 text-sm font-semibold text-[#54247a] disabled:opacity-50"
            >
              Save Schedule
            </button>
            <button
              disabled={saving || !shipment.scheduledDate || !shipment.scheduledTime}
              onClick={() => void dispatch()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Send size={16} /> Dispatch
            </button>
          </div>
        </section>
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-[#54247a]">Status Timeline</h2>
        <ol className="mt-4 space-y-4 border-l border-slate-200 pl-5">
          {shipment.history.map((event, index) => (
            <li key={`${event.createdAt}-${index}`}>
              <p className="text-sm font-semibold">{label(event.eventType)}</p>
              <p className="text-xs text-slate-500">
                {event.actor} · {new Date(event.createdAt).toLocaleString()}
              </p>
              {event.previousStatus && (
                <p className="mt-1 text-xs text-slate-500">
                  {label(event.previousStatus)} → {label(event.newStatus ?? '')}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
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
function Info({
  label: caption,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{caption}</dt>
      <dd className="mt-1 text-sm font-semibold">{value || 'Not provided'}</dd>
    </div>
  );
}
