import { CheckCircle2, PackagePlus, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DetailField } from '../../components/customer-detail/DetailField';
import { DetailSection } from '../../components/customer-detail/DetailSection';
import { DetailBreadcrumb } from '../../components/customer-detail/DetailBreadcrumb';
import { DocumentHeader } from '../../components/customer-detail/DocumentHeader';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '../../components/ui/shadcn';
import { useSalesAuth } from '../../context/SalesAuthContext';
import {
  approveDeliveryRequest,
  getDeliveryRequest,
  rejectDeliveryRequest,
  type DeliveryRequest,
  type DeliveryRequestShipment,
} from '../../services/haderDeliveryService';
import { formatTonQuantity } from '../../utils/quantity';
import { getSalesLandingPath } from '../../utils/salesRouting';
import { Status, date, text } from './HaderDeliveryRequests';

const shipmentCreationRoles = ['HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER'];

export function HaderDeliveryRequestDetails() {
  const { id } = useParams();
  const { user } = useSalesAuth();
  const [item, setItem] = useState<DeliveryRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setItem(await getDeliveryRequest(id));
    } catch {
      setError('Unable to load delivery request.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async () => {
    if (!id) return;
    setBusy(true);
    try {
      setItem(await approveDeliveryRequest(id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to approve request.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!id || !reason.trim()) return;
    setBusy(true);
    try {
      setItem(await rejectDeliveryRequest(id, reason.trim()));
      setRejecting(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to reject request.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="h-72 animate-pulse bg-[var(--customer-surface-secondary)]" />;
  }
  if (!item) {
    return (
      <div className="border border-[var(--customer-border)] bg-[var(--customer-surface)] p-8 text-center text-[var(--customer-danger)]">
        {error || 'Delivery request was not found.'}
      </div>
    );
  }

  const mayCreateShipment = Boolean(user && shipmentCreationRoles.includes(user.role));
  const creationStatusAllowed = ['APPROVED', 'CONVERTED_TO_SHIPMENT'].includes(item.status);
  const canCreateShipment = mayCreateShipment && creationStatusAllowed && item.remainingTon > 0;
  const shipments = item.shipments ?? [];

  return (
    <div className="space-y-5">
      <DetailBreadcrumb
        homePath={user ? getSalesLandingPath(user.role) : '/hader'}
        listLabel="Delivery Requests"
        listPath="/hader/delivery-requests"
        current={item.requestNumber}
      />
      <DocumentHeader
        number={item.requestNumber}
        status={<Status value={item.status} />}
        description={
          <p>
            Order {item.order.number} / Contract {item.contract?.reference ?? 'Not provided'}
          </p>
        }
        actions={
          <>
          {['PENDING', 'UNDER_REVIEW'].includes(item.status) && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setRejecting(true)}
                className="text-[var(--customer-danger)]"
              >
                <XCircle size={16} /> Reject Request
              </Button>
              <Button type="button" disabled={busy} onClick={() => void approve()}>
                <CheckCircle2 size={16} /> Approve Request
              </Button>
            </>
          )}
          </>
        }
      />

      {error && (
        <div className="border border-[var(--customer-danger)] bg-[var(--customer-surface)] p-3 text-sm text-[var(--customer-danger)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <DetailSection title="Delivery Request" contentClassName="space-y-4">
          <DetailField label="Delivery Request" value={item.requestNumber} />
          <DetailField label="Order" value={item.order.number} />
          <DetailField label="Contract" value={item.contract?.reference} />
          <DetailField label="Requested Delivery Date" value={date(item.requestedDate)} />
        </DetailSection>
        <DetailSection title="Customer and Product" contentClassName="space-y-4">
          <DetailField label="Customer" value={item.customer.companyName} />
          <DetailField label="Product" value={`${item.product.name} (${item.product.code})`} />
          <DetailField label="Packaging" value={`${item.product.packaging} / ${item.product.uom}`} />
          <DetailField label="Contact" value={item.customer.contact} secondary={item.customer.phone} />
        </DetailSection>
        <DetailSection title="Delivery" contentClassName="space-y-4">
          <DetailField label="Delivery Location" value={text(item.shipTo, 'name')} />
          <DetailField
            label="City / Region"
            value={[text(item.shipTo, 'city'), text(item.shipTo, 'region')]
              .filter(Boolean)
              .join(', ')}
          />
          <DetailField label="Hader City" value={item.haderCity.name} />
          <DetailField label="Customer Notes" value={item.notes} />
        </DetailSection>
      </div>

      <DetailSection title="Shipment Allocation" contentClassName="grid gap-4 sm:grid-cols-3">
        <DetailField label="Total Quantity" value={formatTonQuantity(item.quantityTon)} strong />
        <DetailField label="Allocated to Shipments" value={formatTonQuantity(item.shippedTon)} strong />
        <DetailField label="Remaining to Allocate" value={formatTonQuantity(item.remainingTon)} strong />
      </DetailSection>

      <ShipmentTable
        requestId={item.id}
        shipments={shipments}
        remainingTon={item.remainingTon}
        canCreate={canCreateShipment}
        allocationComplete={creationStatusAllowed && item.remainingTon <= 0}
      />

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-[var(--customer-border)] bg-[var(--customer-surface)] p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--customer-text)]">
              Reject Delivery Request
            </h2>
            <p className="mt-1 text-sm text-[var(--customer-text-muted)]">
              Provide a reason for the audit history.
            </p>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-4 min-h-28"
              aria-label="Rejection reason"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!reason.trim() || busy}
                onClick={() => void reject()}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShipmentTable({
  requestId,
  shipments,
  remainingTon,
  canCreate,
  allocationComplete,
}: {
  requestId: string;
  shipments: DeliveryRequestShipment[];
  remainingTon: number;
  canCreate: boolean;
  allocationComplete: boolean;
}) {
  const createLabel = shipments.length > 0 ? 'Create Another Shipment' : 'Create Shipment';
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--customer-text)]">Shipments</h2>
          {shipments.length > 0 && remainingTon > 0 && (
            <p className="mt-1 text-sm text-[var(--customer-text-muted)]">
              {formatTonQuantity(remainingTon)} remains available for another shipment.
            </p>
          )}
        </div>
        {canCreate && (
          <Button asChild>
            <Link to={`/hader/shipments/create?requestId=${requestId}`}>
              <PackagePlus size={16} /> {createLabel}
            </Link>
          </Button>
        )}
      </div>
      {allocationComplete && (
        <p className="border border-[var(--customer-border)] bg-[var(--customer-surface-secondary)] px-4 py-3 text-sm font-medium text-[var(--customer-text-secondary)]">
          All delivery quantity has been allocated to shipments.
        </p>
      )}
      {shipments.length === 0 ? (
        <div className="border border-[var(--customer-border)] bg-[var(--customer-surface)] px-4 py-8 text-center text-sm text-[var(--customer-text-muted)]">
          <p>No shipments have been created yet.</p>
          <p className="mt-1">You can allocate the delivery across one or multiple shipments.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {['Shipment', 'Quantity', 'Transporter', 'Truck', 'Driver', 'Scheduled Date', 'Status'].map(
                (heading) => (
                  <TableHead key={heading} className="whitespace-nowrap normal-case tracking-normal">
                    {heading}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.map((shipment) => (
              <TableRow key={shipment.id}>
                <TableCell>
                  <Link
                    to={`/hader/shipments/${shipment.id}`}
                    className="font-semibold text-[var(--customer-primary)] hover:underline"
                  >
                    {shipment.shipmentNumber}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap font-semibold">
                  {formatTonQuantity(shipment.quantityTon)}
                </TableCell>
                <TableCell>{shipment.assignment.transporter?.name ?? '-'}</TableCell>
                <TableCell>
                  {shipment.assignment.truck?.plateNumber ?? shipment.assignment.truck?.number ?? '-'}
                </TableCell>
                <TableCell>{shipment.assignment.driver?.name ?? '-'}</TableCell>
                <TableCell className="whitespace-nowrap">{date(shipment.scheduledDate)}</TableCell>
                <TableCell><Status value={shipment.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
