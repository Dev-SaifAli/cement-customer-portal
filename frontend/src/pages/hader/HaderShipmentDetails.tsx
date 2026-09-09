import { Ban } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DetailBreadcrumb } from '../../components/customer-detail/DetailBreadcrumb';
import { DocumentHeader } from '../../components/customer-detail/DocumentHeader';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '../../components/ui/shadcn';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { cancelShipment, getShipment, type Shipment } from '../../services/haderDeliveryService';
import { formatTonQuantity } from '../../utils/quantity';
import { getSalesLandingPath } from '../../utils/salesRouting';
import { Status, date, text } from './HaderDeliveryRequests';

export function HaderShipmentDetails({ audience = 'hader' }: { audience?: 'hader' | 'sales' }) {
  const { id } = useParams();
  const { user } = useSalesAuth();
  const [item, setItem] = useState<Shipment | null>(null);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const load = useCallback(async () => {
    if (!id) return;
    try {
      setItem(await getShipment(id, audience));
      setError('');
    } catch {
      setError('Unable to load shipment.');
    }
  }, [audience, id]);
  useEffect(() => {
    void load();
  }, [load]);
  const base = audience === 'hader' ? '/hader/shipments' : '/sales/shipments';
  if (!item)
    return (
      <div className="h-72 animate-pulse rounded-xl bg-white">
        {error && <p className="p-6 text-red-600">{error}</p>}
      </div>
    );
  const request = item.deliveryRequest;
  const allowedRole = user?.role === 'HADER_MANAGER' || user?.role === 'HADER_OPERATIONS';
  const eligibleStatus =
    item.status === 'CREATED' ||
    (item.status === 'ASSIGNED' &&
      ['WAITING', 'NOTIFIED', 'AT_GATE'].includes(item.loadingStatus ?? ''));
  const canCancel = audience === 'hader' && allowedRole && eligibleStatus;

  const submitCancellation = async () => {
    if (!id) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError('Cancellation reason is required.');
      return;
    }
    setCancelling(true);
    setCancelError('');
    try {
      setItem(await cancelShipment(id, reason));
      setCancelOpen(false);
      setCancelReason('');
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : 'Unable to cancel shipment.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      <DetailBreadcrumb
        homePath={user ? getSalesLandingPath(user.role) : audience === 'sales' ? '/sales' : '/hader'}
        listLabel="Shipments"
        listPath={base}
        current={item.shipmentNumber}
      />
      <DocumentHeader
        number={item.shipmentNumber}
        status={<Status value={item.status} />}
        description={`Created from ${request.requestNumber}`}
        actions={canCancel ? (
          <Button type="button" variant="destructive" onClick={() => setCancelOpen(true)}>
            <Ban size={16} />
            Cancel Shipment
          </Button>
        ) : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Shipment">
          <Info label="Quantity" value={formatTonQuantity(item.quantityTon)} />
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
      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          if (cancelling) return;
          setCancelOpen(open);
          if (!open) setCancelError('');
        }}
      >
        <DialogContent showCloseButton={!cancelling}>
          <DialogHeader>
            <DialogTitle>Cancel Shipment?</DialogTitle>
            <DialogDescription>
              This keeps the shipment in history and restores its quantity for a replacement
              shipment. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="shipment-cancellation-reason" className="text-sm font-semibold">
              Cancellation reason
            </label>
            <Textarea
              id="shipment-cancellation-reason"
              value={cancelReason}
              maxLength={1000}
              disabled={cancelling}
              aria-invalid={Boolean(cancelError)}
              onChange={(event) => {
                setCancelReason(event.target.value);
                if (cancelError) setCancelError('');
              }}
            />
            {cancelError && (
              <p className="text-sm text-[var(--customer-danger,var(--color-danger,#b42318))]">
                {cancelError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={cancelling}
              onClick={() => setCancelOpen(false)}
            >
              Keep Shipment
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling || !cancelReason.trim()}
              onClick={() => void submitCancellation()}
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
