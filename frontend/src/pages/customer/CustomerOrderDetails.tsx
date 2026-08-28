import { ArrowLeft, FileText, Lock, MapPin } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCustomerOrder, type CustomerOrder } from '../../services/customerOrdersService';

export function CustomerOrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getCustomerOrder(id)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (loading) return <State text="Loading order..." />;
  if (error || !order) return <State text={error || 'Order was not found.'} error />;
  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/customer/orders"
          className="customer-secondary inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--customer-primary)]"
        >
          <ArrowLeft size={16} /> Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="customer-text text-2xl font-bold">{order.orderNumber}</h1>
          <span className="customer-primary-soft customer-primary inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {title(order.status)}
          </span>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Order Information" icon={<FileText size={17} />}>
          <Field
            label="Order Type"
            value={order.orderType === 'DIRECT' ? 'Direct Order' : 'Contract Order'}
          />
          {order.contract && <Field label="Contract Number" value={order.contract.reference} />}
          <Field label="Product" value={`${order.product.name} (${order.product.code})`} />
          <Field label="Packaging" value={order.product.packaging} />
          <Field label="Quantity" value={`${num(order.requestedQuantityTons)} TON`} />
          {order.orderType === 'DIRECT' && order.product.equivalentPackagingUnits !== null && (
            <Field
              label="Equivalent Bags"
              value={`${num(order.product.equivalentPackagingUnits)} Bags`}
            />
          )}
          <Field
            label="Fulfilment"
            value={order.fulfilmentType === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up'}
          />
          <Field label="Requested Date" value={date(order.submittedAt ?? order.createdAt)} />
        </Card>
        <Card title="Delivery / Pickup" icon={<MapPin size={17} />}>
          <Field
            label={order.fulfilmentType === 'DELIVERY' ? 'Ship-to' : 'Pickup Location'}
            value={
              order.fulfilmentType === 'DELIVERY'
                ? shipTo(order.shipTo)
                : order.pickupLocation?.name
            }
          />
          <Field label="Hader City" value={order.haderCity} />
          <Field
            label="Preferred Delivery Date"
            value={order.preferredDeliveryDate ? date(order.preferredDeliveryDate) : null}
          />
          <Field label="Notes" value={order.deliveryNotes} />
          {order.fulfilmentType === 'PICKUP' && (
            <>
              <Field label="Pickup Truck" value={order.pickupTruck?.plateNumber} />
              <Field
                label="Truck Details"
                value={
                  order.pickupTruck
                    ? `${order.pickupTruck.vehicleType} · ${num(order.pickupTruck.capacityTon)} TON`
                    : null
                }
              />
              <Field label="Driver" value={order.pickupDriver?.name} />
              <Field
                label="Driver Details"
                value={
                  order.pickupDriver
                    ? `${order.pickupDriver.mobile} · ${order.pickupDriver.licenseNumber}`
                    : null
                }
              />
            </>
          )}
        </Card>
      </div>
      <section className="customer-card rounded-2xl border p-5">
        <div className="flex items-center gap-2">
          <Lock size={17} className="customer-primary" />
          <h2 className="customer-primary text-sm font-bold">Commercial Summary</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Customer Rate / TON" value={money(order.customerRatePerTon)} />
          <Field label="Subtotal" value={money(order.subtotal)} />
          <Field label={`VAT (${order.vatRate}%)`} value={money(order.vatAmount)} />
          <Field label="Grand Total" value={money(order.grandTotal)} strong />
          {order.remainingContractQuantityTons !== null && (
            <Field
              label="Remaining Contract Quantity"
              value={`${num(order.remainingContractQuantityTons)} TON`}
            />
          )}
        </div>
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
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function Field({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string | null | undefined;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="customer-muted text-xs">{label}</p>
      <p
        className={`mt-1 text-sm ${strong ? 'customer-primary font-bold' : 'customer-text font-semibold'}`}
      >
        {value || 'Not provided'}
      </p>
    </div>
  );
}
function State({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div
      className={`customer-card rounded-2xl border p-8 text-sm font-semibold ${error ? 'text-red-600' : 'customer-secondary'}`}
    >
      {text}
    </div>
  );
}
function title(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
function num(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function money(value: number) {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}
function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function shipTo(value: CustomerOrder['shipTo']) {
  return value
    ? [value.name, value.streetAddress, value.city, value.region].filter(Boolean).join(', ')
    : 'Not provided';
}
