import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  MapPin,
  Package,
  PlayCircle,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getSalesOrder,
  startSalesOrderProcessing,
  type SalesOrder,
} from '../../services/salesOrdersService';

export function SalesOrderDetailsPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getSalesOrder(id)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load this order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const startProcessing = async () => {
    if (!id) return;
    setProcessing(true);
    setError('');
    try {
      setOrder(await startSalesOrderProcessing(id));
      setConfirmOpen(false);
    } catch (processingError) {
      setConfirmOpen(false);
      setError(
        processingError instanceof Error
          ? processingError.message
          : 'Unable to start order processing.',
      );
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <State text="Loading order..." loading />;
  if (!order) return <State text={error || 'Order was not found.'} error />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/sales/orders"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748b] hover:text-[#54247a]"
          >
            <ArrowLeft size={16} /> Orders
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1a1b23]">{order.orderNumber}</h1>
            <Status value={order.status} />
          </div>
        </div>
        {order.status === 'SUBMITTED' && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#54247a] px-5 text-sm font-bold text-white hover:bg-[#472066]"
          >
            <PlayCircle size={17} /> Start Processing
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Order Information" icon={<FileText size={17} />}>
          <Field label="Order Number" value={order.orderNumber} />
          <Field
            label="Order Type"
            value={order.orderType === 'DIRECT' ? 'Direct Order' : 'Contract Order'}
          />
          <Field label="Customer" value={order.customer.companyName} />
          <Field label="Created Date" value={dateTime(order.createdAt)} />
          {order.contract && <Field label="Contract Number" value={order.contract.reference} />}
          {order.processing && (
            <Field label="Processing Started" value={dateTime(order.processing.processedAt)} />
          )}
        </Card>

        <Card title="Product" icon={<Package size={17} />}>
          <Field label="Product" value={order.product.name} />
          <Field label="Product Code" value={order.product.code} />
          <Field label="Packaging" value={order.product.packaging} />
          <Field label="Quantity" value={`${number(order.requestedQuantityTons)} TON`} />
          <Field
            label="Equivalent Bags"
            value={
              order.product.equivalentPackagingUnits === null
                ? null
                : `${number(order.product.equivalentPackagingUnits)} Bags`
            }
          />
        </Card>
      </div>

      <Card title="Fulfilment" icon={<MapPin size={17} />} columns="lg:grid-cols-4">
        <Field
          label="Fulfilment"
          value={order.fulfilmentType === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up'}
        />
        {order.fulfilmentType === 'DELIVERY' ? (
          <>
            <Field label="Hader City" value={order.haderCity} />
            <Field label="Ship-to" value={shipTo(order.shipTo)} />
          </>
        ) : (
          <Field label="Pickup Location" value={order.pickupLocation?.name} />
        )}
        <Field
          label="Requested Date"
          value={order.preferredDeliveryDate ? date(order.preferredDeliveryDate) : null}
        />
        <Field label="Customer Notes" value={order.deliveryNotes} />
      </Card>

      <Card title="Commercial Summary" icon={<Lock size={17} />} columns="lg:grid-cols-4">
        <Field label="Customer Rate / TON" value={money(order.customerRatePerTon)} />
        <Field label="Subtotal" value={money(order.subtotal)} />
        <Field label={`VAT (${order.vatRate}%)`} value={money(order.vatAmount)} />
        <Field label="Grand Total" value={money(order.grandTotal)} strong />
      </Card>

      {order.fulfilmentType === 'DELIVERY' && order.deliveryRequest && (
        <Card title="Fulfilment Handoff" icon={<Truck size={17} />}>
          <Field
            label="Delivery Request"
            value={order.deliveryRequest.requestNumber ?? 'Reference pending'}
          />
          <Field label="Status" value={title(order.deliveryRequest.status ?? 'PENDING')} />
        </Card>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-processing-title"
            className="w-full max-w-md rounded-2xl border border-[#e3e1e8] bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="start-processing-title" className="text-lg font-bold text-[#1a1b23]">
                  Start Processing?
                </h2>
                <p className="mt-2 text-sm text-[#64748b]">
                  Confirm that this order has been reviewed and is ready for operational processing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={processing}
                className="rounded-lg p-2 text-[#64748b] hover:bg-[#f6f2fa]"
                aria-label="Close confirmation"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={processing}
                className="h-10 rounded-lg border border-[#e3e1e8] px-4 text-sm font-bold text-[#1a1b23] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void startProcessing()}
                disabled={processing}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#54247a] px-5 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-60"
              >
                {processing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {processing ? 'Starting...' : 'Start Processing'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  columns = 'sm:grid-cols-2',
  children,
}: {
  title: string;
  icon: ReactNode;
  columns?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e3e1e8] bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[#54247a]">
        {icon} {title}
      </h2>
      <div className={`mt-4 grid gap-4 ${columns}`}>{children}</div>
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
      <p className="text-xs text-[#64748b]">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${strong ? 'text-[#54247a]' : 'text-[#1a1b23]'}`}>
        {value || 'Not provided'}
      </p>
    </div>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#1a1b23]">
      <span
        className={`h-2 w-2 rounded-full ${value === 'PROCESSING' ? 'bg-blue-600' : 'bg-amber-500'}`}
      />
      {title(value)}
    </span>
  );
}

function State({
  text,
  error = false,
  loading = false,
}: {
  text: string;
  error?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border border-[#e3e1e8] bg-white p-8 text-sm font-semibold ${error ? 'text-red-600' : 'text-[#64748b]'}`}
    >
      {loading && <Loader2 size={17} className="animate-spin" />} {text}
    </div>
  );
}

function title(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function number(value: number) {
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

function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function shipTo(value: SalesOrder['shipTo']) {
  return value
    ? [value.name, value.streetAddress, value.city, value.region].filter(Boolean).join(', ')
    : 'Not provided';
}
