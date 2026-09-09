import { ArrowLeft, PackageCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DetailField } from '../../components/customer-detail/DetailField';
import { DetailSection } from '../../components/customer-detail/DetailSection';
import { CommercialTonInput } from '../../components/ui/CommercialTonInput';
import { Button, Input, Label } from '../../components/ui/shadcn';
import { useSalesAuth } from '../../context/SalesAuthContext';
import {
  createShipment,
  getDeliveryRequest,
  type DeliveryRequest,
} from '../../services/haderDeliveryService';
import { createClientId } from '../../utils/createClientId';
import { wholeTonQuantityMessage } from '../../utils/commercialQuantity';
import { formatTonQuantity } from '../../utils/quantity';

const shipmentCreationRoles = ['HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER'];

export function HaderShipmentCreate() {
  const [params] = useSearchParams();
  const requestId = params.get('requestId');
  const clientRequestId = useRef(createClientId());
  const navigate = useNavigate();
  const { user } = useSalesAuth();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState<DeliveryRequest | null>(null);
  const [quantity, setQuantity] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setError('A delivery request is required to create a shipment.');
      return;
    }
    getDeliveryRequest(requestId)
      .then(setItem)
      .catch(() => setError('Unable to load delivery request.'));
  }, [requestId]);

  const allowedRole = Boolean(user && shipmentCreationRoles.includes(user.role));
  const allowedStatus = Boolean(
    item && ['APPROVED', 'CONVERTED_TO_SHIPMENT'].includes(item.status),
  );
  const canCreate = Boolean(allowedRole && allowedStatus && item && item.remainingTon > 0);

  const submit = async () => {
    if (!requestId || !item || !canCreate) return;
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError(wholeTonQuantityMessage);
      return;
    }
    if (amount > item.remainingTon) {
      setError(`Shipment quantity cannot exceed ${formatTonQuantity(item.remainingTon)}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createShipment(requestId, {
        clientRequestId: clientRequestId.current,
        quantityTon: amount,
        ...(scheduledDate ? { scheduledDate } : {}),
      });
      navigate(`/hader/delivery-requests/${requestId}`, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create shipment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <Link
          to={requestId ? `/hader/delivery-requests/${requestId}` : '/hader/delivery-requests'}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--customer-primary)]"
        >
          <ArrowLeft size={16} /> Back to request
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--customer-text)]">Create Shipment</h1>
        <p className="mt-1 text-sm text-[var(--customer-text-muted)]">
          Allocate all or part of the remaining quantity to this shipment. You can create additional
          shipments for any quantity left.
        </p>
      </header>

      {error && (
        <div className="border border-[var(--customer-danger)] bg-[var(--customer-surface)] p-3 text-sm text-[var(--customer-danger)]">
          {error}
        </div>
      )}

      {item ? (
        <>
          <DetailSection title="Shipment Context" contentClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Delivery Request" value={item.requestNumber} />
            <DetailField label="Order" value={item.order.number} />
            <DetailField label="Contract" value={item.contract?.reference} />
            <DetailField label="Customer" value={item.customer.companyName} />
            <DetailField label="Product" value={item.product.name} secondary={item.product.code} />
            <DetailField label="Packaging" value={`${item.product.packaging} / ${item.product.uom}`} />
            <DetailField label="Total Quantity" value={formatTonQuantity(item.quantityTon)} strong />
            <DetailField label="Already Allocated" value={formatTonQuantity(item.shippedTon)} strong />
            <DetailField label="Remaining Quantity" value={formatTonQuantity(item.remainingTon)} strong />
          </DetailSection>

          {item.remainingTon <= 0 ? (
            <p className="border border-[var(--customer-border)] bg-[var(--customer-surface-secondary)] px-4 py-3 text-sm font-medium text-[var(--customer-text-secondary)]">
              All order quantity has been allocated to shipments.
            </p>
          ) : !allowedStatus ? (
            <p className="border border-[var(--customer-border)] bg-[var(--customer-surface-secondary)] px-4 py-3 text-sm font-medium text-[var(--customer-text-secondary)]">
              This delivery request is not available for shipment creation.
            </p>
          ) : !allowedRole ? (
            <p className="border border-[var(--customer-border)] bg-[var(--customer-surface-secondary)] px-4 py-3 text-sm font-medium text-[var(--customer-text-secondary)]">
              Your role does not have permission to create shipments.
            </p>
          ) : (
            <section className="border border-[var(--customer-border)] bg-[var(--customer-surface)] p-5">
              <div className="max-w-2xl">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,280px)_minmax(0,260px)]">
                  <div>
                    <Label htmlFor="shipment-quantity">Shipment Quantity (TON)</Label>
                    <CommercialTonInput
                      id="shipment-quantity"
                      max={item.remainingTon}
                      value={quantity}
                      onValueChange={(value) => {
                        setQuantity(value);
                        setError('');
                      }}
                      onInvalidValue={setError}
                      className="mt-2 h-11 w-full appearance-none rounded-md border border-[var(--customer-border)] bg-[var(--customer-input)] px-3 text-sm text-[var(--customer-text)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--customer-primary)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="mt-1 block text-xs text-[var(--customer-text-muted)]">
                      Remaining to allocate: {formatTonQuantity(item.remainingTon)}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--customer-text-muted)]">
                      Enter less than {formatTonQuantity(item.remainingTon)} to split this delivery
                      into multiple shipments.
                    </span>
                  </div>
                  <div>
                    <Label htmlFor="shipment-scheduled-date">Scheduled Date</Label>
                    <Input
                      ref={dateInputRef}
                      id="shipment-scheduled-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(event) => setScheduledDate(event.target.value)}
                      onClick={() => dateInputRef.current?.showPicker?.()}
                      className="mt-2 h-11"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end sm:max-w-[556px]">
                  <Button type="button" disabled={saving || !quantity} onClick={() => void submit()}>
                    <PackageCheck size={17} />
                    {saving ? 'Creating...' : 'Create Shipment'}
                  </Button>
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        !error && <div className="h-64 animate-pulse bg-[var(--customer-surface-secondary)]" />
      )}
    </div>
  );
}
