import { FileText, Loader2, MapPin, PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DetailBreadcrumb } from '../../components/customer-detail/DetailBreadcrumb';
import { DetailField } from '../../components/customer-detail/DetailField';
import { DetailSection } from '../../components/customer-detail/DetailSection';
import { DocumentHeader, DocumentStatusBadge } from '../../components/customer-detail/DocumentHeader';
import { DocumentReference } from '../../components/customer-detail/DocumentReference';
import { ProductDisplay } from '../../components/customer-detail/ProductDisplay';
import { Button } from '../../components/ui/shadcn';
import type { OrderStatus } from '../../services/customerOrdersService';
import {
  getOperationalOrder,
  startOperationalOrderProcessing,
  type OperationalOrder,
} from '../../services/operationalOrdersService';
import { formatOrderCreator } from '../../utils/orderCreator';
import { formatTonQuantity } from '../../utils/quantity';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { getOperationalPortalPresentation } from '../../utils/operationalPortal';
import { getSalesLandingPath } from '../../utils/salesRouting';

export function HaderOrderDetails() {
  const { id } = useParams();
  const { user } = useSalesAuth();
  const { basePath, ordersLabel } = getOperationalPortalPresentation(user?.role);
  const [order, setOrder] = useState<OperationalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void getOperationalOrder(id, controller.signal)
      .then(setOrder)
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Unable to load order.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  if (loading) return <State text="Loading order..." />;
  if (!order) return <State text={error || 'Order was not found.'} error />;

  const canStartProcessing =
    (user?.role === 'HADER_MANAGER' || user?.role === 'HADER_OPERATIONS') &&
    order.fulfilmentType === 'DELIVERY' &&
    Boolean(order.contract) &&
    (order.status === 'SUBMITTED' || order.status === 'APPROVED');

  const startProcessing = async () => {
    setProcessing(true);
    setError('');
    try {
      setOrder(await startOperationalOrderProcessing(order.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start order processing.');
    } finally {
      setProcessing(false);
    }
  };

  return <div className="space-y-5">
    <DetailBreadcrumb homePath={user ? getSalesLandingPath(user.role) : basePath} listLabel={ordersLabel} listPath={`${basePath}/orders`} current={order.orderNumber} />
    <DocumentHeader
      number={order.orderNumber}
      status={<DocumentStatusBadge label={label(order.status)} tone={tone(order.status)} />}
      actions={canStartProcessing ? (
        <Button type="button" onClick={() => void startProcessing()} disabled={processing}>
          {processing ? <Loader2 className="animate-spin" /> : <PlayCircle />}
          {processing ? 'Starting...' : 'Start Processing'}
        </Button>
      ) : undefined}
    />
    {error && <p className="text-sm font-semibold text-[var(--customer-danger)]">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <DetailSection title="Order Information" icon={<FileText size={17} />}>
        <DetailField label="Customer" value={order.customer.companyName} />
        <DetailField label="Contract" value={<DocumentReference reference={order.contract?.reference} entityId={order.contract?.id} routeBase={`${basePath}/contracts`} />} />
        <DetailField label="Product" value={<ProductDisplay name={order.product.name} code={order.product.code} />} className="sm:col-span-2" />
        <DetailField label="Quantity" value={formatTonQuantity(order.requestedQuantityTons)} />
        <DetailField label="Pallet Required" value={order.palletRequired ? 'Yes' : 'No'} />
        <DetailField label="Pallet Type" value={order.palletType} />
        <DetailField label="Pallet Quantity" value={order.palletQuantity == null ? null : String(order.palletQuantity)} />
        <DetailField label="Fulfilment" value={order.fulfilmentType === 'PICKUP' ? 'Pick-Up' : 'Delivery'} />
        <DetailField label="Status" value={label(order.status)} />
        <DetailField label="Created By" value={formatOrderCreator(order.creator)} />
        <DetailField label="Created At" value={dateTime(order.createdAt)} />
      </DetailSection>
      {order.fulfilmentType === 'PICKUP' ? (
        <DetailSection title="Pickup" icon={<MapPin size={17} />}>
          <DetailField label="Pickup Location" value={order.pickupLocation?.name} />
          <DetailField label="Customer Truck" value={order.pickupTruck?.plateNumber} />
          <DetailField label="Truck Type" value={order.pickupTruck?.vehicleType} />
          <DetailField label="Customer Driver" value={order.pickupDriver?.name} />
        </DetailSection>
      ) : (
        <DetailSection title="Delivery" icon={<MapPin size={17} />}>
          <DetailField label="Delivery Location" value={formatShipTo(order.shipTo)} />
          <DetailField label="Preferred Delivery Date" value={date(order.preferredDeliveryDate)} />
          {order.deliveryRequest && (
            <DetailField
              label="Delivery Request"
              value={
                <DocumentReference
                  reference={order.deliveryRequest.requestNumber}
                  entityId={order.deliveryRequest.id}
                  routeBase="/hader/delivery-requests"
                />
              }
            />
          )}
        </DetailSection>
      )}
    </div>
  </div>;
}

function State({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={`border border-[var(--customer-border)] bg-[var(--customer-surface)] p-8 text-sm font-semibold ${error ? 'text-[var(--customer-danger)]' : 'text-[var(--customer-text-muted)]'}`}>{text}</div>;
}
function label(value: string) { return value.split('_').map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(' '); }
function tone(status: OrderStatus) { if (status === 'CANCELLED' || status === 'REJECTED') return 'destructive' as const; if (status === 'COMPLETED' || status === 'APPROVED') return 'success' as const; if (status === 'SUBMITTED' || status === 'PENDING_APPROVAL') return 'warning' as const; return 'secondary' as const; }
function dateTime(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function date(value: string | null) { return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : '\u2014'; }
function formatShipTo(shipTo: OperationalOrder['shipTo']) { return shipTo ? [shipTo.name, shipTo.streetAddress, shipTo.city, shipTo.region].filter(Boolean).join(' - ') : '\u2014'; }
