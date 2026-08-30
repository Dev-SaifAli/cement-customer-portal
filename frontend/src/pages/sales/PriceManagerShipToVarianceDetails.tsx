import { ArrowLeft, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import {
  dismissShipToVariance,
  getShipToVariance,
  raiseShipToVarianceCharge,
  type ShipToVariance,
} from '../../services/shipToVarianceService';

export function PriceManagerShipToVarianceDetailsPage() {
  const { id = '' } = useParams();
  const [variance, setVariance] = useState<ShipToVariance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'dismiss' | 'raise' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setVariance(await getShipToVariance(id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load variance.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <State text="Loading ship-to variance..." />;
  if (error || !variance) return <State text={error || 'Ship-to variance was not found.'} />;
  const sameCity = variance.status === 'NO_VARIANCE';
  const pricing = variance.decision ?? variance;
  const canRaise =
    !variance.decision &&
    variance.status === 'VARIANCE_DETECTED' &&
    (variance.extraCharge ?? 0) > 0;

  const confirmAction = async () => {
    if (!action) return;
    setSubmitting(true);
    setError('');
    try {
      if (action === 'dismiss') await dismissShipToVariance(variance.shipment.id);
      else await raiseShipToVarianceCharge(variance.shipment.id);
      setAction(null);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to record decision.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/sales/ship-to-variance" className="customer-secondary inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--customer-primary)]">
        <ArrowLeft size={16} /> Back to Ship-to Variance
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="customer-text text-2xl font-bold">Ship-to Variance</h1>
          <p className="customer-secondary mt-1 text-sm">{variance.shipment.number} · {variance.order.number}</p>
        </div>
        <span className="customer-secondary text-sm">Updated {dateTime(variance.lastUpdated)}</span>
      </div>

      <section className="customer-card rounded-xl border p-5">
        <h2 className="customer-primary text-sm font-bold uppercase tracking-wide">Delivery Summary</h2>
        <div className="customer-border-soft mt-4 grid gap-5 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Value label="Shipment" value={variance.shipment.number} />
          <Value label="Order" value={variance.order.number} />
          <Value label="Customer" value={variance.customer.companyName} />
          <Value label="Quantity" value={`${quantity(variance.quantityTon)} TON`} />
          <Value label="Product" value={variance.product.name} supporting={variance.product.code} />
          <Value label="Packaging" value={variance.product.packaging} />
          <Value label="Ordered City" value={variance.orderedCity.name} />
          <Value label="Actual City" value={variance.actualCity.name} />
        </div>
      </section>

      {sameCity ? (
        <section className="customer-card rounded-xl border p-5">
          <div className="flex items-center gap-3 text-[var(--customer-success)]">
            <MapPin size={20} />
            <p className="font-semibold">Same city — no extra charge.</p>
          </div>
        </section>
      ) : (
        <section className="customer-card rounded-xl border p-5">
          <h2 className="customer-primary text-sm font-bold uppercase tracking-wide">Variance Calculation</h2>
          <div className="customer-border-soft mt-4 grid gap-5 border-t pt-4 sm:grid-cols-2 lg:grid-cols-5">
            <Value label="Ordered Price / TON" value={money(pricing.orderedPricePerTon)} />
            <Value label="Actual Price / TON" value={nullableMoney(pricing.actualPricePerTon)} />
            <Value label="Difference / TON" value={nullableMoney(pricing.differencePerTon)} />
            <Value label="Quantity" value={`${quantity(pricing.quantityTon)} TON`} />
            <Value label="Extra Charge" value={nullableMoney(pricing.extraCharge)} emphasized />
          </div>
          {variance.status === 'PRICING_NOT_CONFIGURED' && (
            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Actual-city product or delivery pricing is not configured. No charge can be calculated.
            </p>
          )}
        </section>
      )}

      <section className="customer-card rounded-xl border p-5">
        <h2 className="customer-primary text-sm font-bold uppercase tracking-wide">Current Variance Status</h2>
        <p className="customer-text mt-3 font-semibold">
          {variance.decision ? decisionLabel(variance.decision.status) : statusLabel(variance.status)}
        </p>
        {variance.decision ? (
          <div className="customer-secondary mt-2 space-y-1 text-sm">
            <p>Recorded by {variance.decision.raisedOrDismissedBy} on {dateTime(variance.decision.createdAt)}</p>
            {variance.decision.decidedBy && variance.decision.decidedAt && (
              <p>{decisionLabel(variance.decision.status)} by {variance.decision.decidedBy} on {dateTime(variance.decision.decidedAt)}</p>
            )}
            {variance.decision.rejectionReason && <p>Reason: {variance.decision.rejectionReason}</p>}
          </div>
        ) : canRaise ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="customer-border customer-secondary rounded-lg border px-4 py-2 text-sm font-semibold" onClick={() => setAction('dismiss')}>Dismiss</button>
            <button className="customer-primary-bg rounded-lg px-4 py-2 text-sm font-semibold text-white" onClick={() => setAction('raise')}>Raise Extra Charge</button>
          </div>
        ) : (
          <p className="customer-secondary mt-1 text-sm">No additional charge.</p>
        )}
      </section>

      <Modal
        open={action !== null}
        title={action === 'dismiss' ? 'Dismiss variance?' : 'Raise extra charge?'}
        onClose={() => !submitting && setAction(null)}
        footer={
          <>
            <button className="customer-border customer-secondary rounded-lg border px-4 py-2 text-sm font-semibold" disabled={submitting} onClick={() => setAction(null)}>Cancel</button>
            <button className="customer-primary-bg rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={submitting} onClick={() => void confirmAction()}>
              {submitting ? 'Saving...' : action === 'dismiss' ? 'Confirm Dismissal' : 'Raise Extra Charge'}
            </button>
          </>
        }
      >
        {action === 'dismiss' ? (
          <p className="customer-secondary text-sm">No charge will be created and the original order and shipment pricing will remain unchanged.</p>
        ) : (
          <div className="customer-secondary grid gap-3 text-sm sm:grid-cols-2">
            <Value label="Ordered Price / TON" value={money(variance.orderedPricePerTon)} />
            <Value label="Actual Price / TON" value={nullableMoney(variance.actualPricePerTon)} />
            <Value label="Difference / TON" value={nullableMoney(variance.differencePerTon)} />
            <Value label="Extra Charge" value={nullableMoney(variance.extraCharge)} emphasized />
            <p className="sm:col-span-2">This request will be sent to the Commercial Director for approval.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Value({ label, value, supporting, emphasized = false }: { label: string; value: string; supporting?: string; emphasized?: boolean }) {
  return <div><p className="customer-muted text-xs font-semibold">{label}</p><p className={`mt-1 font-semibold ${emphasized ? 'customer-primary text-lg' : 'customer-text text-sm'}`}>{value}</p>{supporting && <p className="customer-secondary mt-0.5 text-xs">{supporting}</p>}</div>;
}

function State({ text }: { text: string }) {
  return <div className="customer-card customer-secondary flex min-h-56 items-center justify-center rounded-xl border p-8 text-sm font-semibold">{text}</div>;
}

function statusLabel(status: ShipToVariance['status']) {
  if (status === 'NO_VARIANCE') return 'Same city — no extra charge.';
  if (status === 'PRICING_NOT_CONFIGURED') return 'Actual-city pricing is not configured.';
  return 'Variance detected';
}

function decisionLabel(status: NonNullable<ShipToVariance['decision']>['status']) {
  return {
    DISMISSED: 'Dismissed',
    PENDING_APPROVAL: 'Pending Commercial Director Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  }[status];
}

function money(value: number) {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}
function nullableMoney(value: number | null) { return value === null ? 'Not configured' : money(value); }
function quantity(value: number) { return value.toLocaleString(undefined, { maximumFractionDigits: 3 }); }
function dateTime(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
