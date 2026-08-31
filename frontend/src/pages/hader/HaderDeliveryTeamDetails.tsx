import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileSignature,
  FileText,
  LocateFixed,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  Route,
  Truck,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LocationPickerMap } from '../../components/registration/LocationPickerMap';
import { Button, FileUpload, FormField, Input, Modal } from '../../components/ui';
import { type Coordinates, mapConfig } from '../../config/map';
import { useSalesAuth } from '../../context/SalesAuthContext';
import {
  closeDeliveryShipment,
  createShipmentPod,
  getDeliveryTeamShipment,
  getShipmentPod,
  getShipmentPodDocumentBlob,
  markShipmentDelivered,
  startShipmentDelivery,
  updateShipmentPod,
  uploadShipmentPodDocument,
  type DeliveryTeamShipment,
  type ShipmentPod,
  type ShipmentPodDocument,
  type ShipmentPodDocumentType,
} from '../../services/haderDeliveryService';
import { date, DeliveryStatus, label, shipTo, tons } from './HaderDeliveryTeam';

export function HaderDeliveryTeamDetails() {
  const { shipmentId } = useParams();
  const { user } = useSalesAuth();
  const [shipment, setShipment] = useState<DeliveryTeamShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pod, setPod] = useState<ShipmentPod | null>(null);
  const [podLoading, setPodLoading] = useState(false);
  const [podError, setPodError] = useState('');
  const [podModalOpen, setPodModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!shipmentId) return;
    setLoading(true);
    setError('');
    try {
      const loadedShipment = await getDeliveryTeamShipment(shipmentId);
      setShipment(loadedShipment);
      setPod(null);
      setPodError('');
      if (loadedShipment.status === 'DELIVERED') {
        setPodLoading(true);
        try {
          setPod(await getShipmentPod(shipmentId));
        } catch {
          setPodError('Unable to load proof of delivery.');
        } finally {
          setPodLoading(false);
        }
      }
    } catch {
      setError('Unable to load Delivery Team shipment.');
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const execute = async () => {
    if (!shipment) return;
    const action = availableAction(shipment.status, pod);
    if (!action || !window.confirm(action.confirmation)) return;
    setSaving(true);
    setError('');
    try {
      await action.execute(shipment.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update shipment status.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="customer-card h-72 animate-pulse rounded-2xl border" />;
  if (!shipment) return <State error={error} retry={() => void load()} />;
  const action = availableAction(shipment.status, pod);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/hader/delivery-team"
            className="customer-secondary inline-flex items-center gap-2 text-sm font-semibold"
          >
            <ArrowLeft size={16} /> Delivery Team
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="customer-text text-2xl font-bold">{shipment.shipmentNumber}</h1>
            <DeliveryStatus value={shipment.status} />
          </div>
          <p className="customer-secondary mt-1 text-sm">Order {shipment.order.number}</p>
        </div>
        {action && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void execute()}
            className="customer-primary-bg inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Route size={17} /> {saving ? 'Updating...' : action.label}
          </button>
        )}
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-4">
        <Card title="Shipment" icon={<PackageCheck size={17} />}>
          <Field label="Shipment Number" value={shipment.shipmentNumber} />
          <Field label="Current Status" value={label(shipment.status)} />
          <Field label="Order Number" value={shipment.order.number} />
          <Field label="Contract Number" value={shipment.contract?.reference ?? 'Direct Order'} />
          <Field label="Quantity" value={tons(shipment.quantityTon)} />
          <Field
            label="Equivalent Bags"
            value={
              shipment.equivalentBags === null
                ? 'Not applicable'
                : shipment.equivalentBags.toLocaleString()
            }
          />
        </Card>
        <Card title="Product & Customer" icon={<Truck size={17} />}>
          <Field label="Customer" value={shipment.customer.companyName} />
          <Field label="Product" value={`${shipment.product.name} (${shipment.product.code})`} />
          <Field label="Packaging" value={shipment.product.packaging} />
          <Field label="UOM" value={shipment.product.uom} />
        </Card>
        <Card title="Delivery" icon={<MapPin size={17} />}>
          <Field label="Hader City" value={shipment.haderCity.name} />
          <Field label="Ship-to" value={shipTo(shipment.shipTo)} />
          <Field label="Requested Date" value={date(shipment.requestedDate)} />
          <Field label="Scheduled" value={scheduled(shipment)} />
        </Card>
        <Card title="Assignment" icon={<Clock3 size={17} />}>
          <Field label="Transporter" value={shipment.assignment?.transporter.name} />
          <Field label="Truck" value={shipment.assignment?.truck?.plateNumber} />
          <Field label="Vehicle Type" value={shipment.assignment?.truck?.vehicleType} />
          <Field label="Driver" value={shipment.assignment?.driver?.name} />
          <Field label="Driver Mobile" value={shipment.assignment?.driver?.mobile} />
        </Card>
      </div>

      {shipment.status === 'DELIVERED' && (
        <ProofOfDeliverySection
          shipmentId={shipment.id}
          pod={pod}
          loading={podLoading}
          error={podError}
          onAdd={() => setPodModalOpen(true)}
          onEdit={() => setPodModalOpen(true)}
          onRefresh={async () => {
            setPodError('');
            try {
              setPod(await getShipmentPod(shipment.id));
            } catch {
              setPodError('Unable to refresh proof of delivery.');
            }
          }}
          onError={setPodError}
        />
      )}

      <section className="customer-card rounded-2xl border p-5">
        <h2 className="customer-primary text-sm font-bold">Shipment History</h2>
        {shipment.history?.length ? (
          <ol className="customer-border-soft mt-4 divide-y">
            {shipment.history.map((event, index) => (
              <li
                key={`${event.eventType}-${event.createdAt}-${index}`}
                className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="customer-text text-sm font-semibold">{label(event.eventType)}</p>
                  <p className="customer-secondary text-xs">{event.actor}</p>
                </div>
                <time className="customer-muted text-xs">
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="customer-secondary mt-3 text-sm">No shipment events available.</p>
        )}
      </section>

      <PodFormModal
        open={podModalOpen}
        shipmentId={shipment.id}
        recordedBy={user?.name ?? 'Authenticated Hader user'}
        existingPod={pod}
        onClose={() => setPodModalOpen(false)}
        onSaved={(savedPod, warning) => {
          setPod(savedPod);
          setPodError(warning ?? '');
          setPodModalOpen(false);
        }}
      />
    </div>
  );
}

function ProofOfDeliverySection({
  shipmentId,
  pod,
  loading,
  error,
  onAdd,
  onEdit,
  onRefresh,
  onError,
}: {
  shipmentId: string;
  pod: ShipmentPod | null;
  loading: boolean;
  error: string;
  onAdd: () => void;
  onEdit: () => void;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState<ShipmentPodDocumentType | null>(null);
  const deliveryPhotoDocument = pod?.documents.find(
    (item) => item.documentType === 'DELIVERY_PHOTO',
  );
  const signedPodDocument = pod?.documents.find((item) => item.documentType === 'SIGNED_POD');

  const upload = async (type: ShipmentPodDocumentType, file: File | undefined) => {
    if (!file) return;
    setUploading(type);
    onError('');
    try {
      await uploadShipmentPodDocument(shipmentId, type, file);
      await onRefresh();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Unable to upload POD document.');
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return <section className="customer-card h-40 animate-pulse rounded-2xl border" />;
  }

  return (
    <section className="customer-card rounded-2xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="customer-primary flex items-center gap-2 text-sm font-bold">
            <FileSignature size={17} /> Proof of Delivery
          </h2>
          {pod && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 size={14} /> Proof of Delivery Recorded
            </p>
          )}
        </div>
        {pod ? (
          <Button type="button" variant="secondary" onClick={onEdit}>
            <span className="inline-flex items-center gap-2">
              <Pencil size={16} /> Edit POD
            </span>
          </Button>
        ) : (
          !error && (
            <Button type="button" onClick={onAdd}>
              <span className="inline-flex items-center gap-2">
                <Plus size={16} /> Add Proof of Delivery
              </span>
            </Button>
          )
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {!pod && !error && (
        <p className="customer-secondary mt-4 text-sm">No proof of delivery recorded.</p>
      )}

      {pod && (
        <>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Recorded By" value={pod.createdBy} />
            <Field label="Receiver" value={pod.receiver} />
            <Field label="Delivered Quantity" value={tons(pod.deliveredQuantityTon)} />
            <Field label="Delivery Time" value={new Date(pod.deliveryTime).toLocaleString()} />
            <Field
              label="Delivery Location"
              value={pod.location ? 'Map location captured' : 'Not provided'}
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Evidence / Notes" value={pod.evidence ?? 'Not provided'} />
            </div>
          </dl>

          <div className="customer-border-soft mt-5 border-t pt-4">
            <h3 className="customer-text text-sm font-bold">POD Documents</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <PodDocumentSlot
                shipmentId={shipmentId}
                type="DELIVERY_PHOTO"
                label="Delivery Photo"
                icon={<Camera size={17} />}
                {...(deliveryPhotoDocument ? { document: deliveryPhotoDocument } : {})}
                uploading={uploading === 'DELIVERY_PHOTO'}
                onUpload={(file) => void upload('DELIVERY_PHOTO', file)}
                onError={onError}
              />
              <PodDocumentSlot
                shipmentId={shipmentId}
                type="SIGNED_POD"
                label="Signed POD"
                icon={<FileText size={17} />}
                {...(signedPodDocument ? { document: signedPodDocument } : {})}
                uploading={uploading === 'SIGNED_POD'}
                onUpload={(file) => void upload('SIGNED_POD', file)}
                onError={onError}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function PodDocumentSlot({
  shipmentId,
  type,
  label: title,
  icon,
  document,
  uploading,
  onUpload,
  onError,
}: {
  shipmentId: string;
  type: ShipmentPodDocumentType;
  label: string;
  icon: ReactNode;
  document?: ShipmentPodDocument;
  uploading: boolean;
  onUpload: (file: File | undefined) => void;
  onError: (message: string) => void;
}) {
  const openDocument = async (download: boolean) => {
    if (!document) return;
    onError('');
    try {
      const blob = await getShipmentPodDocumentBlob(shipmentId, document.id);
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = document.fileName;
        anchor.click();
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Unable to open POD document.');
    }
  };

  return (
    <div className="customer-border rounded-xl border p-4">
      <div className="customer-text flex items-center gap-2 text-sm font-bold">
        {icon} {title}
      </div>
      {document ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="customer-text truncate text-sm font-semibold">{document.fileName}</p>
            <p className="customer-muted mt-0.5 text-xs">
              {document.mimeType} | {formatFileSize(document.fileSize)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void openDocument(false)}
            className="customer-secondary inline-flex h-9 items-center gap-1.5 rounded-lg border customer-border px-3 text-xs font-bold"
          >
            <Eye size={15} /> View
          </button>
          <button
            type="button"
            onClick={() => void openDocument(true)}
            className="customer-secondary inline-flex h-9 items-center gap-1.5 rounded-lg border customer-border px-3 text-xs font-bold"
          >
            <Download size={15} /> Download
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <FileUpload
            label={uploading ? 'Uploading...' : `Upload ${title}`}
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={uploading}
            onChange={(event) => {
              onUpload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
      )}
      <span className="sr-only">{type}</span>
    </div>
  );
}

function PodFormModal({
  open,
  shipmentId,
  recordedBy,
  existingPod,
  onClose,
  onSaved,
}: {
  open: boolean;
  shipmentId: string;
  recordedBy: string;
  existingPod: ShipmentPod | null;
  onClose: () => void;
  onSaved: (pod: ShipmentPod, warning?: string) => void;
}) {
  const [receiver, setReceiver] = useState('');
  const [quantity, setQuantity] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [evidence, setEvidence] = useState('');
  const [deliveryPhoto, setDeliveryPhoto] = useState<File>();
  const [signedPod, setSignedPod] = useState<File>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const editing = existingPod !== null;
  const existingDeliveryPhoto = existingPod?.documents.find(
    (document) => document.documentType === 'DELIVERY_PHOTO',
  );
  const existingSignedPod = existingPod?.documents.find(
    (document) => document.documentType === 'SIGNED_POD',
  );

  useEffect(() => {
    if (!open) return;
    setReceiver(existingPod?.receiver ?? '');
    setQuantity(existingPod ? String(existingPod.deliveredQuantityTon) : '');
    setDeliveryTime(existingPod ? toDateTimeLocalValue(existingPod.deliveryTime) : '');
    setCoordinates(existingPod?.location ?? null);
    setEvidence(existingPod?.evidence ?? '');
    setDeliveryPhoto(undefined);
    setSignedPod(undefined);
    setErrors({});
    setSubmitError('');
    setLocationError('');
  }, [existingPod, open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validatePodForm({
      receiver,
      quantity,
      deliveryTime,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        receiver: receiver.trim(),
        deliveredQuantityTon: Number(quantity),
        deliveryTime: new Date(deliveryTime).toISOString(),
        ...(coordinates ?? {}),
        ...(evidence.trim() ? { evidence: evidence.trim() } : {}),
      };
      if (editing) {
        await updateShipmentPod(shipmentId, payload);
      } else {
        await createShipmentPod(shipmentId, payload);
      }

      const documentErrors: string[] = [];
      if (deliveryPhoto) {
        try {
          await uploadShipmentPodDocument(shipmentId, 'DELIVERY_PHOTO', deliveryPhoto);
        } catch (cause) {
          documentErrors.push(
            cause instanceof Error ? cause.message : 'Unable to upload the delivery photo.',
          );
        }
      }
      if (signedPod) {
        try {
          await uploadShipmentPodDocument(shipmentId, 'SIGNED_POD', signedPod);
        } catch (cause) {
          documentErrors.push(
            cause instanceof Error ? cause.message : 'Unable to upload the signed POD.',
          );
        }
      }
      const savedPod = await getShipmentPod(shipmentId);
      if (!savedPod) throw new Error('Proof of delivery was saved but could not be reloaded.');
      onSaved(
        savedPod,
        documentErrors.length
          ? `Proof of delivery was saved, but a document could not be uploaded: ${documentErrors.join(' ')}`
          : undefined,
      );
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Unable to save proof of delivery.');
    } finally {
      setSubmitting(false);
    }
  };

  const useCurrentLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Current location is not available. Select the location on the map.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      () => {
        setLocationError('Unable to access the current location. Select it on the map instead.');
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: mapConfig.geolocation.maximumAge,
        timeout: mapConfig.geolocation.timeout,
      },
    );
  };

  return (
    <Modal
      open={open}
      title={editing ? 'Edit Proof of Delivery' : 'Add Proof of Delivery'}
      onClose={submitting ? () => undefined : onClose}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pod-form" loading={submitting}>
            {editing ? 'Save Changes' : 'Save Proof of Delivery'}
          </Button>
        </>
      }
    >
      <form id="pod-form" className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {submitError}
          </div>
        )}
        <div className="customer-surface-secondary customer-border rounded-xl border px-4 py-3">
          <p className="customer-muted text-xs font-semibold uppercase tracking-wide">Recorded By</p>
          <p className="customer-text mt-1 text-sm font-bold">
            {existingPod?.createdBy ?? recordedBy}
          </p>
          <p className="customer-secondary mt-1 text-xs">
            Current authenticated Hader user
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Receiver *"
            htmlFor="pod-receiver"
            {...(errors.receiver ? { error: errors.receiver } : {})}
          >
            <Input
              id="pod-receiver"
              value={receiver}
              onChange={(event) => setReceiver(event.target.value)}
            />
          </FormField>
          <FormField
            label="Delivered Quantity (TON) *"
            htmlFor="pod-quantity"
            {...(errors.quantity ? { error: errors.quantity } : {})}
          >
            <Input
              id="pod-quantity"
              type="number"
              min="0.001"
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField
              label="Delivery Time *"
              htmlFor="pod-delivery-time"
              {...(errors.deliveryTime ? { error: errors.deliveryTime } : {})}
            >
              <Input
                id="pod-delivery-time"
                type="datetime-local"
                value={deliveryTime}
                onChange={(event) => setDeliveryTime(event.target.value)}
              />
            </FormField>
          </div>
        </div>
        <div className="customer-border rounded-xl border p-4">
          <p className="customer-text text-sm font-semibold">Delivery Location</p>
          <p className="customer-secondary mt-1 text-xs">
            {coordinates ? 'Map location selected.' : 'No delivery location captured.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setMapOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <MapPin size={16} /> Select Location on Map
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={locating}
              onClick={useCurrentLocation}
            >
              <span className="inline-flex items-center gap-2">
                <LocateFixed size={16} />
                {locating ? 'Locating...' : 'Use Current Location'}
              </span>
            </Button>
          </div>
          {locationError && <p className="mt-2 text-xs font-semibold text-red-600">{locationError}</p>}
        </div>
        <FormField label="Evidence / Notes" htmlFor="pod-evidence">
          <textarea
            id="pod-evidence"
            className="ui-control min-h-24 resize-y"
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="customer-text mb-2 text-sm font-semibold">Delivery Photo</p>
            {existingDeliveryPhoto && (
              <p className="customer-secondary mb-2 truncate text-xs">
                Current: {existingDeliveryPhoto.fileName}
              </p>
            )}
            <FileUpload
              label={existingDeliveryPhoto ? 'Replace delivery photo' : 'Choose delivery photo'}
              {...(deliveryPhoto ? { file: deliveryPhoto } : {})}
              onRemove={() => setDeliveryPhoto(undefined)}
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={(event) => setDeliveryPhoto(event.target.files?.[0])}
            />
          </div>
          <div>
            <p className="customer-text mb-2 text-sm font-semibold">Signed POD</p>
            {existingSignedPod && (
              <p className="customer-secondary mb-2 truncate text-xs">
                Current: {existingSignedPod.fileName}
              </p>
            )}
            <FileUpload
              label={existingSignedPod ? 'Replace signed POD' : 'Choose signed POD'}
              {...(signedPod ? { file: signedPod } : {})}
              onRemove={() => setSignedPod(undefined)}
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => setSignedPod(event.target.files?.[0])}
            />
          </div>
        </div>
      </form>
      {mapOpen && (
        <LocationPickerMap
          initialCoordinates={coordinates ?? undefined}
          locationLabel="proof of delivery"
          onCancel={() => setMapOpen(false)}
          onConfirm={(nextCoordinates) => {
            setCoordinates(nextCoordinates);
            setLocationError('');
            setMapOpen(false);
          }}
        />
      )}
    </Modal>
  );
}

function validatePodForm(values: {
  receiver: string;
  quantity: string;
  deliveryTime: string;
}) {
  const errors: Record<string, string> = {};
  if (!values.receiver.trim()) errors.receiver = 'Receiver is required.';
  const quantity = Number(values.quantity);
  if (!values.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity = 'Delivered quantity must be greater than zero.';
  }
  if (!values.deliveryTime || Number.isNaN(new Date(values.deliveryTime).getTime())) {
    errors.deliveryTime = 'A valid delivery time is required.';
  }
  return errors;
}

function toDateTimeLocalValue(value: string) {
  const dateValue = new Date(value);
  const localValue = new Date(dateValue.getTime() - dateValue.getTimezoneOffset() * 60_000);
  return localValue.toISOString().slice(0, 16);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
function Field({ label: title, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="customer-muted text-xs">{title}</dt>
      <dd className="customer-text mt-1 text-sm font-semibold">{value || 'Not provided'}</dd>
    </div>
  );
}
function State({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="customer-card rounded-2xl border p-8 text-center">
      <p className="text-sm font-semibold text-red-600">{error}</p>
      <button onClick={retry} className="customer-primary mt-3 text-sm font-bold">
        Retry
      </button>
    </div>
  );
}
function availableAction(status: DeliveryTeamShipment['status'], pod: ShipmentPod | null) {
  const actions = {
    DISPATCHED: {
      label: 'Start Delivery',
      confirmation: 'Start delivery for this shipment?',
      execute: startShipmentDelivery,
    },
    IN_TRANSIT: {
      label: 'Mark Delivered',
      confirmation: 'Mark this shipment as delivered?',
      execute: markShipmentDelivered,
    },
  } satisfies Partial<
    Record<
      DeliveryTeamShipment['status'],
      { label: string; confirmation: string; execute: (id: string) => Promise<unknown> }
    >
  >;
  if (status === 'DELIVERED' && pod) {
    return {
      label: 'Close Shipment',
      confirmation: 'Close this delivered shipment?',
      execute: closeDeliveryShipment,
    };
  }
  return actions[status as keyof typeof actions];
}
function scheduled(shipment: DeliveryTeamShipment) {
  return shipment.scheduledDate
    ? `${date(shipment.scheduledDate)}${shipment.scheduledTime ? ` at ${shipment.scheduledTime}` : ''}`
    : 'Not provided';
}
