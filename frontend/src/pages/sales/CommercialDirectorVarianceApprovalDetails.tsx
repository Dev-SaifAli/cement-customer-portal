import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import {
  approveShipToVarianceCharge,
  getShipToVarianceChargeApproval,
  rejectShipToVarianceCharge,
  type ShipToVarianceDecision,
} from '../../services/shipToVarianceService';

export function CommercialDirectorVarianceApprovalDetailsPage() {
  const { id = '' } = useParams();
  const [decision, setDecision] = useState<ShipToVarianceDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setDecision(await getShipToVarianceChargeApproval(id)); }
    catch { setError('Unable to load this approval request.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <State text="Loading approval request..." />;
  if (error || !decision) return <State text={error || 'Approval request was not found.'} />;

  const submit = async () => {
    if (!action || (action === 'reject' && reason.trim().length < 3)) return;
    setSaving(true); setError('');
    try {
      if (action === 'approve') await approveShipToVarianceCharge(decision.id);
      else await rejectShipToVarianceCharge(decision.id, reason.trim());
      setAction(null); setReason(''); await load();
    } catch { setError('Unable to record this approval decision.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <Link className="customer-secondary inline-flex items-center gap-2 text-sm font-semibold" to="/sales/ship-to-variance-approvals"><ArrowLeft size={16} /> Back to approvals</Link>
    <div><h1 className="customer-text text-2xl font-bold">Extra Charge Approval</h1><p className="customer-secondary mt-1 text-sm">{decision.shipment.number} · {decision.order.number}</p></div>
    <section className="customer-card rounded-xl border p-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Value label="Customer" value={decision.customer.companyName} /><Value label="Product" value={decision.product.name} /><Value label="Quantity" value={`${number(decision.quantityTon)} TON`} /><Value label="Status" value={label(decision.status)} />
        <Value label="Ordered City" value={decision.orderedCity.name} /><Value label="Actual City" value={decision.actualCity.name} /><Value label="Ordered Price / TON" value={money(decision.orderedPricePerTon)} /><Value label="Actual Price / TON" value={money(decision.actualPricePerTon)} />
        <Value label="Difference / TON" value={money(decision.differencePerTon)} /><Value label="Extra Charge" value={money(decision.extraCharge)} emphasized /><Value label="Raised By" value={decision.raisedOrDismissedBy} /><Value label="Raised At" value={dateTime(decision.createdAt)} />
        {decision.decidedBy && <Value label={decision.status === 'APPROVED' ? 'Approved By' : 'Rejected By'} value={decision.decidedBy} />}
        {decision.decidedAt && <Value label={decision.status === 'APPROVED' ? 'Approved At' : 'Rejected At'} value={dateTime(decision.decidedAt)} />}
      </div>
      {decision.status === 'PENDING_APPROVAL' && <div className="customer-border-soft mt-5 flex gap-3 border-t pt-4"><button className="customer-primary-bg rounded-lg px-4 py-2 text-sm font-semibold text-white" onClick={() => setAction('approve')}>Approve</button><button className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600" onClick={() => setAction('reject')}>Reject</button></div>}
      {decision.rejectionReason && <p className="mt-4 text-sm text-red-600">Rejection reason: {decision.rejectionReason}</p>}
    </section>
    <Modal open={action !== null} title={action === 'approve' ? 'Approve extra charge?' : 'Reject extra charge?'} onClose={() => !saving && setAction(null)} footer={<><button className="customer-border rounded-lg border px-4 py-2 text-sm" onClick={() => setAction(null)}>Cancel</button><button disabled={saving || (action === 'reject' && reason.trim().length < 3)} className="customer-primary-bg rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void submit()}>{saving ? 'Saving...' : action === 'approve' ? 'Approve' : 'Reject'}</button></>}>
      {action === 'approve' ? <p className="customer-secondary text-sm">Approve the snapshotted extra charge of {money(decision.extraCharge)}?</p> : <textarea className="customer-input customer-border customer-text min-h-28 w-full rounded-lg border p-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Rejection reason" maxLength={1000} />}
    </Modal>
  </div>;
}

function Value({ label: name, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) { return <div><p className="customer-muted text-xs font-semibold">{name}</p><p className={`mt-1 font-semibold ${emphasized ? 'customer-primary text-lg' : 'customer-text text-sm'}`}>{value}</p></div>; }
function State({ text }: { text: string }) { return <div className="customer-card customer-secondary flex min-h-56 items-center justify-center rounded-xl border p-8 text-sm">{text}</div>; }
function money(value: number) { return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`; }
function number(value: number) { return value.toLocaleString(undefined, { maximumFractionDigits: 3 }); }
function dateTime(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
function label(value: ShipToVarianceDecision['status']) { return { DISMISSED: 'Dismissed', PENDING_APPROVAL: 'Pending Commercial Director Approval', APPROVED: 'Approved', REJECTED: 'Rejected' }[value]; }
