import { ArrowLeft, Check, Circle, FileText, MapPin, PackageCheck } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getCustomerShipment,
  type CustomerShipment,
} from '../../services/customerShipmentsService';
import { ShipmentStatus, statusLabel } from './CustomerShipments';

export function CustomerShipmentDetails() {
  const { id } = useParams();
  const [shipment, setShipment] = useState<CustomerShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      setShipment(await getCustomerShipment(id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading) return <div className="customer-card h-72 animate-pulse rounded-2xl border" />;
  if (error || !shipment) return <State onRetry={() => void load()} />;

  return (
    <div className="space-y-5">
      <header>
        <Link
          to="/customer/shipments"
          className="customer-secondary inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--customer-primary)]"
        >
          <ArrowLeft size={16} /> My Shipments
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="customer-text text-2xl font-bold">{shipment.shipmentNumber}</h1>
          <ShipmentStatus value={shipment.status} />
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Shipment Information" icon={<PackageCheck size={17} />}>
          <Field label="Shipment Number" value={shipment.shipmentNumber} />
          <Field label="Status" value={statusLabel(shipment.status)} />
          <Field label="Created Date" value={dateTime(shipment.createdAt)} />
        </Card>
        <Card title="Order Information" icon={<FileText size={17} />}>
          <Field label="Order Number" value={shipment.order.number} />
          <Field label="Contract Number" value={shipment.contract.reference} />
          <Field label="Product" value={`${shipment.product.name} (${shipment.product.code})`} />
          <Field label="Packaging" value={shipment.product.packaging} />
          <Field label="Quantity" value={`${number(shipment.quantityTon)} TON`} />
          <Field
            label="Equivalent Bags"
            value={
              shipment.equivalentBags === null ? 'Not applicable' : number(shipment.equivalentBags)
            }
          />
        </Card>
        <Card title="Delivery Information" icon={<MapPin size={17} />}>
          <Field
            label="Fulfilment"
            value={shipment.fulfilmentType === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up'}
          />
          <Field label="Hader City" value={shipment.haderCity} />
          <Field label="Ship-to Address" value={shipToAddress(shipment)} />
          <Field
            label="Requested Date"
            value={shipment.requestedDate ? date(shipment.requestedDate) : null}
          />
        </Card>
      </div>

      <section className="customer-card rounded-2xl border p-5">
        <h2 className="customer-primary text-sm font-bold">Shipment Timeline</h2>
        {shipment.events?.length ? (
          <ol className="customer-border-soft mt-4 space-y-0 border-l">
            {shipment.events.map((event) => (
              <li key={event.id} className="relative pb-5 pl-6 last:pb-0">
                <span
                  className={`absolute -left-3 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${
                    event.newStatus === shipment.status
                      ? 'customer-primary-bg border-[var(--customer-primary)] text-white'
                      : 'customer-primary-soft customer-primary border-[var(--customer-primary)]'
                  }`}
                >
                  {event.newStatus === shipment.status ? (
                    <Circle size={8} fill="currentColor" />
                  ) : (
                    <Check size={13} />
                  )}
                </span>
                <p
                  className={`text-sm font-semibold ${event.newStatus === shipment.status ? 'customer-primary' : 'customer-text'}`}
                >
                  {event.newStatus ? statusLabel(event.newStatus) : eventLabel(event.eventType)}
                </p>
                <p className="customer-muted mt-1 text-xs">{dateTime(event.createdAt)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="customer-secondary mt-3 text-sm">No shipment events available yet.</p>
        )}
      </section>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="customer-card rounded-2xl border p-5">
      <h2 className="customer-primary flex items-center gap-2 text-sm font-bold">
        {icon}
        {title}
      </h2>
      <dl className="mt-4 space-y-3">{children}</dl>
    </section>
  );
}
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="customer-muted text-xs">{label}</dt>
      <dd className="customer-text mt-1 text-sm font-semibold">{value || 'Not provided'}</dd>
    </div>
  );
}
function State({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="customer-card rounded-2xl border p-8 text-center">
      <p className="text-sm font-semibold text-red-600">Unable to load shipment.</p>
      <button
        type="button"
        onClick={onRetry}
        className="customer-primary mt-3 text-sm font-bold hover:underline"
      >
        Retry
      </button>
    </div>
  );
}
function number(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function shipToAddress(shipment: CustomerShipment) {
  return shipment.shipTo
    ? [
        shipment.shipTo.name,
        shipment.shipTo.streetAddress,
        shipment.shipTo.city,
        shipment.shipTo.region,
        shipment.shipTo.country,
      ]
        .filter(Boolean)
        .join(', ')
    : 'Not provided';
}
function eventLabel(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
