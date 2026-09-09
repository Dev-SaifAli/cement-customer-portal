import { FileText, Lock, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DetailBreadcrumb } from '../../components/customer-detail/DetailBreadcrumb';
import { DetailField } from '../../components/customer-detail/DetailField';
import { DetailSection } from '../../components/customer-detail/DetailSection';
import {
  DocumentHeader,
  DocumentStatusBadge,
} from '../../components/customer-detail/DocumentHeader';
import { DocumentReference } from '../../components/customer-detail/DocumentReference';
import { ProductDisplay } from '../../components/customer-detail/ProductDisplay';
import {
  getCustomerOrder,
  type CustomerOrder,
  type OrderStatus,
} from '../../services/customerOrdersService';
import { formatCommercialTons } from '../../utils/commercialQuantity';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { formatOrderCreator } from '../../utils/orderCreator';

export function CustomerOrderDetails({ context }: { context: 'DIRECT' | 'CONTRACT' }) {
  const { user } = useCustomerAuth();
  const { id } = useParams();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void getCustomerOrder(id)
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

  const isDirectOrder = context === 'DIRECT';
  const listPath = isDirectOrder ? '/customer/direct-orders' : '/customer/orders';
  const listLabel = isDirectOrder ? 'Direct Orders' : 'Orders';
  const submittedDate = order.submittedAt ?? order.createdAt;
  const submittedDateLabel = order.submittedAt ? 'Submitted On' : 'Created Date';

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-5">
      <DetailBreadcrumb
        listLabel={listLabel}
        listPath={listPath}
        current={order.orderNumber}
      />

      <DocumentHeader
        number={order.orderNumber}
        status={
          <DocumentStatusBadge
            label={formatStatus(order.status)}
            tone={statusTone(order.status)}
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title="Order Information" icon={<FileText size={17} />}>
          <DetailField
            label="Product"
            value={<ProductDisplay name={order.product.name} code={order.product.code} />}
            className="sm:col-span-2"
          />
          <DetailField label="Quantity" value={formatCommercialTons(order.requestedQuantityTons)} />
          <DetailField label="Packaging" value={order.product.packaging} />
          <DetailField label="Pallet Required" value={order.palletRequired ? 'Yes' : 'No'} />
          <DetailField label="Pallet Type" value={order.palletType} />
          <DetailField
            label="Pallet Quantity"
            value={order.palletQuantity == null ? null : String(order.palletQuantity)}
          />
          {isDirectOrder && order.product.equivalentPackagingUnits !== null && (
            <DetailField
              label="Equivalent Bags"
              value={`${formatNumber(order.product.equivalentPackagingUnits)} Bags`}
            />
          )}
          <DetailField
            label="Fulfilment"
            value={order.fulfilmentType === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up'}
          />
          <DetailField label={submittedDateLabel} value={formatDate(submittedDate)} />
          <DetailField label="Created By" value={formatOrderCreator(order.creator, user?.id)} />
          <DetailField
            label="Contract"
            value={
              <DocumentReference
                reference={order.contract?.reference}
                entityId={order.contract?.id}
                routeBase="/customer/contracts"
                ariaLabel={
                  order.contract?.reference
                    ? `Open contract ${order.contract.reference}`
                    : 'Contract not available'
                }
              />
            }
          />
        </DetailSection>

        <DetailSection title="Delivery / Pickup" icon={<MapPin size={17} />}>
          {order.fulfilmentType === 'DELIVERY' ? (
            <>
              <DetailField label="Ship-to" value={order.shipTo?.name} />
              <DetailField label="Address" value={formatAddress(order.shipTo)} />
              <DetailField label="Hader City" value={order.haderCity} />
              <DetailField
                label="Preferred Delivery Date"
                value={order.preferredDeliveryDate ? formatDate(order.preferredDeliveryDate) : null}
              />
              <DetailField label="Notes" value={order.deliveryNotes} className="sm:col-span-2" />
            </>
          ) : (
            <>
              <DetailField label="Pickup Location" value={order.pickupLocation?.name} />
              {order.preferredDeliveryDate && (
                <DetailField
                  label="Preferred Delivery Date"
                  value={formatDate(order.preferredDeliveryDate)}
                />
              )}
              <DetailField label="Pickup Truck" value={order.pickupTruck?.plateNumber} />
              <DetailField
                label="Truck Details"
                value={
                  order.pickupTruck
                    ? `${order.pickupTruck.vehicleType} / ${formatNumber(order.pickupTruck.capacityTon)} TON`
                    : null
                }
              />
              <DetailField label="Driver" value={order.pickupDriver?.name} />
              <DetailField
                label="Driver Details"
                value={
                  order.pickupDriver
                    ? `${order.pickupDriver.mobile} / ${order.pickupDriver.licenseNumber}`
                    : null
                }
              />
              <DetailField label="Notes" value={order.deliveryNotes} className="sm:col-span-2" />
            </>
          )}
        </DetailSection>
      </div>

      <DetailSection
        title="Commercial Summary"
        icon={<Lock size={17} />}
        contentClassName="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <DetailField label="Customer Rate / TON" value={formatMoney(order.customerRatePerTon)} />
        <DetailField label="Subtotal" value={formatMoney(order.subtotal)} />
        <DetailField label={`VAT (${order.vatRate}%)`} value={formatMoney(order.vatAmount)} />
        <DetailField label="Grand Total" value={formatMoney(order.grandTotal)} strong />
        {!isDirectOrder && order.remainingContractQuantityTons !== null && (
          <DetailField
            label="Remaining Contract Quantity"
            value={formatCommercialTons(order.remainingContractQuantityTons)}
          />
        )}
      </DetailSection>
    </div>
  );
}

function State({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div
      className={`border border-[var(--customer-border)] bg-[var(--customer-surface)] p-8 text-sm font-semibold ${
        error ? 'text-[var(--customer-danger)]' : 'text-[var(--customer-text-muted)]'
      }`}
    >
      {text}
    </div>
  );
}

function statusTone(status: OrderStatus) {
  if (status === 'REJECTED' || status === 'CANCELLED') return 'destructive' as const;
  if (status === 'PENDING_APPROVAL' || status === 'SUBMITTED') return 'warning' as const;
  if (status === 'APPROVED' || status === 'COMPLETED') return 'success' as const;
  return 'secondary' as const;
}

function formatStatus(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatMoney(value: number) {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} SAR`;
}

function formatDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatAddress(value: CustomerOrder['shipTo']) {
  if (!value) return null;
  return [value.streetAddress, value.city, value.region].filter(Boolean).join(', ') || null;
}
