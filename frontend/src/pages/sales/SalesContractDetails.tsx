import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileText,
  Lock,
  MapPin,
  Package,
  Pencil,
  PlusCircle,
  Send,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CommercialTonInput } from '../../components/ui/CommercialTonInput';
import { useToast } from '../../components/ui/ToastProvider';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Textarea } from '../../components/ui/shadcn';
import { DetailBreadcrumb } from '../../components/customer-detail/DetailBreadcrumb';
import {
  DocumentHeader,
  DocumentStateBadge,
} from '../../components/customer-detail/DocumentHeader';
import {
  formatCommercialTonValue,
  isWholeTonQuantity,
  wholeTonQuantityMessage,
} from '../../utils/commercialQuantity';
import {
  approveSalesContract,
  extendSalesContract,
  getSalesContract,
  rejectSalesContract,
  submitSalesContract,
  updateSalesContract,
  type SalesContractDetails,
} from '../../services/salesService';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { getSalesLandingPath } from '../../utils/salesRouting';

export function SalesContractDetailsPage() {
  const { id } = useParams();
  const { user } = useSalesAuth();
  const toast = useToast();
  const [contract, setContract] = useState<SalesContractDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({
    startDate: '',
    endDate: '',
  });
  const [extendOpen, setExtendOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const [extensionError, setExtensionError] = useState('');
  const [extensionForm, setExtensionForm] = useState({
    additionalQuantityTons: '',
    endDate: '',
    reason: '',
  });

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError('');
    getSalesContract(id)
      .then(setContract)
      .catch(() => setError('Unable to load contract.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const history = useMemo(() => buildHistory(contract), [contract]);

  const handleSubmit = async () => {
    if (!contract || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const submittedContract = await submitSalesContract(contract.id);
      setContract(submittedContract);
      setSubmitOpen(false);
      toast.success('Contract submitted for approval');
    } catch {
      setError('Unable to submit contract. Please verify contract dates, customer, and items.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!contract || approving) return;
    setApproving(true);
    setError('');
    try {
      setContract(await approveSalesContract(contract.id));
      toast.success('Contract approved and activated');
    } catch {
      setError('Unable to approve this Contract.');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!contract || rejecting || !rejectionReason.trim()) return;
    setRejecting(true);
    setError('');
    try {
      setContract(await rejectSalesContract(contract.id, rejectionReason.trim()));
      setRejectOpen(false);
      setRejectionReason('');
      toast.success('Changes requested from Sales');
    } catch {
      setError('Unable to request Contract changes.');
    } finally {
      setRejecting(false);
    }
  };

  const openEditModal = () => {
    if (!contract) return;
    setEditForm({
      startDate: contract.startDate,
      endDate: contract.endDate,
    });
    setEditError('');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!contract || savingEdit) return;
    const quantity = Number(contract.quantity ?? contract.totalQuantityTons);
    if (!isWholeTonQuantity(quantity)) {
      setEditError(wholeTonQuantityMessage);
      return;
    }
    if (!editForm.startDate || !editForm.endDate || editForm.endDate < editForm.startDate) {
      setEditError('End date must be on or after the start date.');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      const updated = await updateSalesContract(contract.id, {
        customerAccountId: contract.customerAccountId,
        productId: contract.productId,
        quantity,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        fulfilment: contract.fulfilment,
        ...(contract.pickupLocationId ? { pickupLocationId: contract.pickupLocationId } : {}),
        ...(contract.deliveryLocationId ? { deliveryLocationId: contract.deliveryLocationId } : {}),
        palletRequired: Boolean(contract.palletRequired),
        ...(contract.palletType ? { palletType: contract.palletType } : {}),
        productListPrice: Number(contract.productListPrice),
        productPrice: Number(contract.productPrice),
        ...(contract.deliveryListPrice != null ? { deliveryListPrice: contract.deliveryListPrice } : {}),
        ...(contract.deliveryPrice != null ? { deliveryPrice: contract.deliveryPrice } : {}),
      });
      setContract(updated);
      setEditOpen(false);
      toast.success('Contract updated');
    } catch {
      setEditError('Unable to update Contract. Verify the entered values.');
    } finally {
      setSavingEdit(false);
    }
  };

  const openExtendModal = () => {
    if (!contract) return;
    setExtensionForm({
      additionalQuantityTons: '',
      endDate: contract.endDate,
      reason: '',
    });
    setExtensionError('');
    setExtendOpen(true);
  };

  const handleExtend = async () => {
    if (!contract || extending) return;
    const additionalQuantity =
      extensionForm.additionalQuantityTons.trim() === ''
        ? undefined
        : Number(extensionForm.additionalQuantityTons);
    const endDate =
      extensionForm.endDate && extensionForm.endDate !== contract.endDate
        ? extensionForm.endDate
        : undefined;

    if (additionalQuantity !== undefined && !isWholeTonQuantity(additionalQuantity)) {
      setExtensionError(wholeTonQuantityMessage);
      return;
    }

    if (endDate && endDate <= contract.endDate) {
      setExtensionError('End date can only move later than the current contract end date.');
      return;
    }

    if (additionalQuantity === undefined && !endDate) {
      setExtensionError('Enter a quantity increase, a later end date, or both.');
      return;
    }

    setExtending(true);
    setExtensionError('');
    try {
      const updatedContract = await extendSalesContract(contract.id, {
        ...(additionalQuantity !== undefined ? { additionalQuantityTons: additionalQuantity } : {}),
        ...(endDate ? { endDate } : {}),
        ...(extensionForm.reason.trim() ? { reason: extensionForm.reason.trim() } : {}),
      });
      setContract(updatedContract);
      setExtendOpen(false);
    } catch {
      setExtensionError('Unable to extend contract. Please verify the quantity and end date.');
    } finally {
      setExtending(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <div className="h-5 w-44 animate-pulse rounded bg-slate-100" />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
        {error}
        <button onClick={load} className="ml-3 font-bold underline">
          Retry
        </button>
      </div>
    );
  }

  if (!contract) return null;

  const items = contract.items ?? [];
  const isEditable = ['DRAFT', 'CHANGES_REQUESTED'].includes(contract.status);
  const isUnderReview = contract.status === 'UNDER_REVIEW';
  const isActive = contract.status === 'ACTIVE';
  const isSalesRep = user?.role === 'SALES_REP';
  const isContractApprover = user?.role === 'COMMERCIAL_DIRECTOR';

  return (
    <div className="space-y-5">
      <DetailBreadcrumb
        homePath={user ? getSalesLandingPath(user.role) : '/sales'}
        listLabel="Contracts"
        listPath="/sales/contracts"
        current={contract.reference ?? 'Draft Contract'}
      />
      <section className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
        <DocumentHeader
          number={contract.reference ?? 'Draft Contract'}
          status={<DocumentStateBadge persisted status={contract.status} />}
          className="border-b border-[#e2e8f0] px-5 py-4"
          actions={
            <>
          {isEditable && isSalesRep && (
            <>
              <Button type="button" variant="outline" onClick={openEditModal}>
                <Pencil size={16} /> Edit Contract
              </Button>
              <Button type="button" onClick={() => setSubmitOpen(true)}>
                <Send size={16} /> {contract.status === 'CHANGES_REQUESTED' ? 'Resubmit' : 'Submit for Approval'}
              </Button>
            </>
          )}
          {isUnderReview && isContractApprover && (
            <>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(true)}>
                <XCircle size={16} /> Request Changes
              </Button>
              <Button type="button" disabled={approving} onClick={() => void handleApprove()}>
                <CheckCircle2 size={16} /> {approving ? 'Approving...' : 'Approve'}
              </Button>
            </>
          )}
          {isActive && isSalesRep && (
            <button
              type="button"
              onClick={openExtendModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#472066]"
            >
              <PlusCircle size={16} /> Extend Contract
            </button>
          )}
            </>
          }
        />

        <div className="grid gap-px bg-[#e2e8f0] md:grid-cols-2 xl:grid-cols-4">
          <HeaderCell icon={<BriefcaseBusiness size={16} />} label="Customer">
            {contract.customerCompanyName}
          </HeaderCell>
          <HeaderCell icon={<FileText size={16} />} label="Source Quotation">
            {contract.sourceQuotation?.reference ? (
              <Link
                to={`/sales/quotations/${contract.sourceQuotation.id}`}
                className="font-bold text-[#54247a] hover:underline"
              >
                {contract.sourceQuotation.reference}
              </Link>
            ) : (
              'Not provided'
            )}
          </HeaderCell>
          <HeaderCell icon={<CalendarDays size={16} />} label="Contract Period">
            {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
          </HeaderCell>
          <HeaderCell icon={<MapPin size={16} />} label="Fulfilment">
            {formatFulfilment(contract.fulfilment)}
          </HeaderCell>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card title="Contract Information">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Contract Number" value={contract.reference} />
            <Field label="Status" value={<StatusDot status={contract.status} />} />
            <Field label="Customer" value={contract.customerCompanyName} />
            <Field label="Source Quotation" value={contract.sourceQuotation?.reference} />
            <Field label="Start Date" value={formatDate(contract.startDate)} />
            <Field label="End Date" value={formatDate(contract.endDate)} />
            <Field label="Fulfilment" value={formatFulfilment(contract.fulfilment)} />
            <Field label="Pickup From" value={pickupLabel(contract.pickupLocationId)} />
            <Field label="Hader City" value={contract.deliveryCity} />
            <Field label="Ship-to" value={shipToLabel(contract)} />
            <Field label="Created By" value={contract.salesUserName} />
            <Field label="Created At" value={formatDateTime(contract.createdAt)} />
          </div>
        </Card>

        <Card title="Commercial Terms">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment Terms" value={contract.paymentTerms} />
            <Field label="Accepted On" value={formatDateTime(contract.sourceQuotation?.acceptedAt)} />
            <Field label="Customer Notes" value={contract.customerNotes} />
            <Field label="Internal Notes" value={contract.internalNotes} />
          </div>
        </Card>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-5 py-4">
          <Package size={17} className="text-[#54247a]" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#54247a]">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs font-bold uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Packaging</th>
                <th className="px-4 py-3">Commercial Quantity</th>
                <th className="px-4 py-3">Packaging Quantity</th>
                <th className="px-4 py-3">Customer Rate / TON</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {items.map((item, index) => (
                <tr key={`${item.productCode ?? 'product'}-${index}`} className="hover:bg-[#f8fafc]">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#1a1b23]">{item.productName ?? 'Not provided'}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#64748b]">{item.productCode ?? 'Not provided'}</p>
                  </td>
                  <td className="px-4 py-3 text-[#1a1b23]">{item.packagingType ?? 'Not provided'}</td>
                  <td className="px-4 py-3 text-[#1a1b23]">
                    {(item.quantityTon ?? item.equivalentTons) == null
                      ? 'Not provided'
                      : `${formatCommercialTonValue(item.quantityTon ?? item.equivalentTons ?? 0)} TON`}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#1a1b23]">
                    {item.packagingQuantity == null
                      ? 'Bulk'
                      : `${formatNumber(item.packagingQuantity)} Bags`}
                  </td>
                  <td className="px-4 py-3 text-[#1a1b23]">{formatMoney(item.customerRate)}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#1a1b23]">{formatMoney(item.amount)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#64748b]">
                    No contract items available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card
          title="Internal Commercial Summary"
          aside={
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f6f2fa] px-2.5 py-1 text-xs font-bold text-[#54247a]">
              <Lock size={13} /> Internal only
            </span>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Product List / Reference Price" value={formatMoney(contract.productListPrice)} />
            <Field label="Discount" value={discountLabel(items)} />
            <Field label="Approved Product Price" value={formatMoney(contract.productPrice)} />
            <Field label="Hader Delivery Price" value={formatMoney(contract.deliveryPrice)} />
            <Field label="Approved Customer Rate" value={formatMoney(contract.customerRate)} />
            <Field label="VAT" value={formatMoney(contract.vatAmount)} />
            <Field label="Grand Total" value={formatMoney(contract.grandTotal)} strong />
          </div>
        </Card>

        <Card title="History">
          <div className="space-y-4">
            {history.map((event) => (
              <div key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f6f2fa] text-[#54247a]">
                  <CheckCircle2 size={14} />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-[#1a1b23]">{event.title}</p>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    {event.actor ? `${event.actor}${event.actorRole ? ` (${formatStatus(event.actorRole)})` : ''} - ` : ''}
                    {formatDateTime(event.createdAt)}
                  </p>
                  {event.reason && (
                    <p className="mt-2 rounded-xl bg-[#f8fafc] px-3 py-2 text-[#475569]">
                      {event.reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-[#64748b]">No history available.</p>}
          </div>
        </Card>
      </section>

      <Dialog open={submitOpen} onOpenChange={(open) => !submitting && setSubmitOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Contract for approval?</DialogTitle>
            <DialogDescription>
              The Commercial Director will review the Contract. It remains hidden from the customer until approved and activated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={(open) => !rejecting && setRejectOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Contract changes</DialogTitle>
            <DialogDescription>Explain what Sales must correct before resubmitting.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            maxLength={500}
            rows={4}
            aria-label="Reason for requested Contract changes"
            onChange={(event) => setRejectionReason(event.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={rejecting} onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button type="button" disabled={rejecting || !rejectionReason.trim()} onClick={() => void handleReject()}>
              {rejecting ? 'Sending...' : 'Request Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => !savingEdit && setEditOpen(open)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
            <DialogDescription>Update the Contract period before approval. Accepted RFQ commercial terms remain unchanged.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              <span>Start Date</span>
              <Input type="date" value={editForm.startDate} onChange={(event) => setEditForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span>End Date</span>
              <Input type="date" value={editForm.endDate} onChange={(event) => setEditForm((current) => ({ ...current, endDate: event.target.value }))} />
            </label>
          </div>
          {editError && <p className="text-sm font-medium text-[var(--customer-danger)]">{editError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={savingEdit} onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="button" disabled={savingEdit} onClick={() => void handleSaveEdit()}>{savingEdit ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {extendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6f2fa] text-[#54247a]">
                <PlusCircle size={22} />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-[#1a1b23]">Extend Active Contract</h2>
                <p className="mt-2 text-sm leading-6 text-[#64748b]">
                  You may only increase total quantity or move the end date later. Product,
                  packaging, fulfilment, ship-to, Hader city and prices remain locked.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 rounded-xl border border-[#e3e1e8] bg-[#f8fafc] p-4 sm:grid-cols-2">
              <Field label="Current Total TON" value={contract.totalQuantityTons == null ? 'Not provided' : formatCommercialTonValue(contract.totalQuantityTons)} />
              <Field label="Current Remaining TON" value={contract.remainingQuantityTons == null ? 'Not provided' : formatCommercialTonValue(contract.remainingQuantityTons)} />
              <Field label="Current End Date" value={formatDate(contract.endDate)} />
              <Field label="Customer Rate / TON" value={formatMoney(contract.customerRate)} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-[#64748b]">Increase Quantity (TON)</span>
                <CommercialTonInput
                  value={extensionForm.additionalQuantityTons}
                  onValueChange={(value) => {
                    setExtensionError('');
                    setExtensionForm((current) => ({
                      ...current,
                      additionalQuantityTons: value,
                    }));
                  }}
                  onInvalidValue={setExtensionError}
                  className="mt-1 h-11 w-full rounded-xl border border-[#d8d4df] px-3 text-sm font-semibold outline-none focus:border-[#54247a]"
                  placeholder="e.g. 25"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#64748b]">Extend End Date</span>
                <input
                  type="date"
                  value={extensionForm.endDate}
                  min={contract.endDate}
                  onChange={(event) =>
                    setExtensionForm((current) => ({ ...current, endDate: event.target.value }))
                  }
                  className="mt-1 h-11 w-full rounded-xl border border-[#d8d4df] px-3 text-sm font-semibold outline-none focus:border-[#54247a]"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold text-[#64748b]">Internal Reason</span>
                <textarea
                  value={extensionForm.reason}
                  onChange={(event) =>
                    setExtensionForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  rows={3}
                  maxLength={500}
                  className="mt-1 w-full rounded-xl border border-[#d8d4df] px-3 py-2 text-sm font-semibold outline-none focus:border-[#54247a]"
                  placeholder="Optional internal reason"
                />
              </label>
            </div>

            {extensionError && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {extensionError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExtendOpen(false)}
                disabled={extending}
                className="rounded-xl border border-[#e3e1e8] bg-white px-4 py-2 text-sm font-bold text-[#1a1b23] hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExtend}
                disabled={extending}
                className="rounded-xl bg-[#54247a] px-4 py-2 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-60"
              >
                {extending ? 'Saving...' : 'Save Extension'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderCell({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
        {icon} {label}
      </p>
      <div className="mt-1 text-sm font-bold text-[#1a1b23]">{children ?? 'Not provided'}</div>
    </div>
  );
}

function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#e2e8f0] pb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#54247a]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-[#64748b]">{label}</p>
      <div
        className={`mt-1 break-words text-sm ${
          strong ? 'font-extrabold text-[#54247a]' : 'font-semibold text-[#1a1b23]'
        }`}
      >
        {value || 'Not provided'}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'ACTIVE'
      ? 'bg-[#0f8b5f]'
      : status === 'DRAFT'
        ? 'bg-slate-400'
        : status === 'REJECTED' || status === 'CANCELLED'
          ? 'bg-[#b42318]'
          : 'bg-[#54247a]';

  return (
    <span className="inline-flex items-center gap-2 text-sm font-bold text-[#1a1b23]">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {formatStatus(status)}
    </span>
  );
}

function buildHistory(contract: SalesContractDetails | null) {
  if (!contract) return [];

  const accepted = contract.sourceQuotation?.acceptedAt
    ? [
        {
          id: 'quotation-accepted',
          title: 'Quotation accepted',
          actor: 'Customer',
          actorRole: null,
          reason: contract.sourceQuotation.reference
            ? `Source quotation ${contract.sourceQuotation.reference} was accepted.`
            : null,
          createdAt: contract.sourceQuotation.acceptedAt,
        },
      ]
    : [];

  const contractEvents = (contract.statusHistory ?? []).map((event) => ({
    id: event.id,
    title: historyTitle(event.action, event.previousStatus, event.newStatus),
    actor: event.changedByName ?? 'Sales user',
    actorRole: event.changedByRole,
    reason: event.reason,
    createdAt: event.createdAt,
  }));

  return [...accepted, ...contractEvents].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function historyTitle(action: string, previousStatus: string | null, newStatus: string) {
  if (action === 'CONTRACT_CREATED_FROM_RFQ') return 'Contract created from accepted quotation';
  if (action === 'CONTRACT_UPDATED') return 'Contract updated';
  if (action === 'CONTRACT_SUBMITTED_FOR_APPROVAL') return 'Contract submitted for approval';
  if (action === 'CONTRACT_APPROVED') return 'Contract approved';
  if (action === 'CONTRACT_CHANGES_REQUESTED') return 'Contract changes requested';
  if (action === 'CONTRACT_ACTIVATED') return 'Contract activated';
  if (action === 'CREATE') return 'Contract created';
  if (action === 'ACTIVATE') return 'Contract activated';
  if (action === 'EXTEND') return 'Contract extended';
  if (previousStatus) return `${formatStatus(previousStatus)} → ${formatStatus(newStatus)}`;
  return formatStatus(newStatus);
}

function discountLabel(items: SalesContractDetails['items']) {
  const discounts = (items ?? [])
    .map((item) => item.discountAmountPerTon)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (discounts.length === 0) return 'Not provided';
  const unique = Array.from(new Set(discounts.map((value) => value.toFixed(2))));
  return unique.map((value) => `${value} SAR / TON`).join(', ');
}

function pickupLabel(value?: string | null) {
  if (!value) return 'Not applicable';
  if (value === 'ALSAFWA_PLANT_MAIN') return 'AlSafwa Cement Plant';
  return value;
}

function shipToLabel(contract: SalesContractDetails) {
  if (contract.fulfilment !== 'DELIVERY') return 'Not applicable';
  const location = contract.deliveryLocation;
  return [location?.name, location?.city, location?.region].filter(Boolean).join(', ') || contract.deliveryLocationId;
}

function formatFulfilment(value?: string | null) {
  if (value === 'DELIVERY') return 'Hader Delivery';
  if (value === 'PICKUP') return 'Pick-Up';
  return 'Not provided';
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatMoney(value?: number | null) {
  return value == null
    ? 'Not provided'
    : `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function formatNumber(value?: number | null) {
  return value == null
    ? 'Not provided'
    : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not provided';
}

function formatDateTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not provided';
}
