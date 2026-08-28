import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getShipment, type Shipment } from '../../services/haderDeliveryService';
import { Status, date, text } from './HaderDeliveryRequests';

export function HaderShipmentDetails({ audience = 'hader' }: { audience?: 'hader' | 'sales' }) {
  const { id } = useParams();
  const [item, setItem] = useState<Shipment | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (id)
      getShipment(id, audience)
        .then(setItem)
        .catch(() => setError('Unable to load shipment.'));
  }, [audience, id]);
  const base = audience === 'hader' ? '/hader/shipments' : '/sales/shipments';
  if (!item)
    return (
      <div className="h-72 animate-pulse rounded-xl bg-white">
        {error && <p className="p-6 text-red-600">{error}</p>}
      </div>
    );
  const request = item.deliveryRequest;
  return (
    <div className="space-y-4">
      <header>
        <Link
          to={base}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#54247a]"
        >
          <ArrowLeft size={16} />
          Shipments
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{item.shipmentNumber}</h1>
          <Status value={item.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">Created from {request.requestNumber}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Shipment">
          <Info label="Quantity" value={`${item.quantityTon.toFixed(3)} TON`} />
          <Info label="Scheduled Date" value={date(item.scheduledDate)} />
          <Info label="Created At" value={new Date(item.createdAt).toLocaleString()} />
        </Card>
        <Card title="Order">
          <Info label="Order Number" value={request.order.number} />
          <Info label="Contract" value={request.contract?.reference ?? 'Direct Order'} />
          <Info label="Product" value={`${request.product.name} (${request.product.code})`} />
          <Info label="Packaging" value={request.product.packaging} />
        </Card>
        <Card title="Delivery">
          <Info label="Customer" value={request.customer.companyName} />
          <Info label="Hader City" value={request.haderCity.name} />
          <Info label="Ship-to" value={text(request.shipTo, 'name')} />
          <Info label="Requested Date" value={date(request.requestedDate)} />
        </Card>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-[#54247a]">Status Foundation</h2>
        <p className="mt-2 text-sm text-slate-500">
          Dispatch, loading and live tracking actions will be implemented in a later module.
        </p>
      </section>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="border-b pb-3 font-bold text-[#54247a]">{title}</h2>
      <dl className="mt-3 space-y-3">{children}</dl>
    </section>
  );
}
function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value || 'Not provided'}</dd>
    </div>
  );
}
