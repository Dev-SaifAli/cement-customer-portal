import {
  ArrowLeft,
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileText,
  Lock,
  MapPin,
  Package,
  PlusCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  activateSalesContract,
  extendSalesContract,
  getSalesContract,
  type SalesContractDetails,
} from '../../services/salesService';

export function SalesContractDetailsPage() {
  const { id } = useParams();
  const [contract, setContract] = useState<SalesContractDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activating, setActivating] = useState(false);
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

  const handleActivate = async () => {
    if (!contract || activating) return;
    setActivating(true);
    setError('');
    try {
      const activatedContract = await activateSalesContract(contract.id);
      setContract(activatedContract);
      setConfirmOpen(false);
    } catch {
      setError('Unable to activate contract. Please verify contract dates, customer, and items.');
    } finally {
      setActivating(false);
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

    if (additionalQuantity !== undefined && (!Number.isFinite(additionalQuantity) || additionalQuantity <= 0)) {
      setExtensionError('Quantity increase must be greater than zero.');
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
  const isDraft = contract.status === 'DRAFT';
  const isActive = contract.status === 'ACTIVE';

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-[#e2e8f0] px-5 py-4 lg:flex-row lg:items-center">
          <div>
            <Link
              to="/sales/contracts"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748b] hover:text-[#54247a]"
            >
              <ArrowLeft size={16} /> Contracts
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#1a1b23]">
                Contract / {contract.reference ?? 'Draft Contract'}
              </h1>
              <StatusDot status={contract.status} />
            </div>
          </div>

          {isDraft && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#472066]"
            >
              <CheckCircle2 size={16} /> Activate Contract
            </button>
          )}
          {isActive && (
            <button
              type="button"
              onClick={openExtendModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#472066]"
            >
              <PlusCircle size={16} /> Extend Contract
            </button>
          )}
        </div>

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
      </header>

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
                <th className="px-4 py-3">Original Qty/UOM</th>
                <th className="px-4 py-3">Equivalent TON</th>
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
                    {formatNumber(item.quantity)} {item.uom ?? ''}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#1a1b23]">
                    {formatNumber(item.equivalentTons)}
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
                    {event.actor ? `${event.actor} · ` : ''}
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

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6f2fa] text-[#54247a]">
                <AlertTriangle size={22} />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-[#1a1b23]">Activate Contract?</h2>
                <p className="mt-2 text-sm leading-6 text-[#64748b]">
                  This will activate the contract using the already accepted quotation commercial
                  terms. Pricing, products, packaging, ship-to and agreement fields will remain
                  locked after activation.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-[#e3e1e8] bg-[#f8fafc] p-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contract" value={contract.reference} />
                <Field label="Customer" value={contract.customerCompanyName} />
                <Field label="Period" value={`${formatDate(contract.startDate)} - ${formatDate(contract.endDate)}`} />
                <Field label="Grand Total" value={formatMoney(contract.grandTotal)} strong />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={activating}
                className="rounded-xl border border-[#e3e1e8] bg-white px-4 py-2 text-sm font-bold text-[#1a1b23] hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActivate}
                disabled={activating}
                className="rounded-xl bg-[#54247a] px-4 py-2 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-60"
              >
                {activating ? 'Activating...' : 'Yes, Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <Field label="Current Total TON" value={formatNumber(contract.totalQuantityTons)} />
              <Field label="Current Remaining TON" value={formatNumber(contract.remainingQuantityTons)} />
              <Field label="Current End Date" value={formatDate(contract.endDate)} />
              <Field label="Customer Rate / TON" value={formatMoney(contract.customerRate)} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-[#64748b]">Increase Quantity (TON)</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={extensionForm.additionalQuantityTons}
                  onChange={(event) =>
                    setExtensionForm((current) => ({
                      ...current,
                      additionalQuantityTons: event.target.value,
                    }))
                  }
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
    reason: event.reason,
    createdAt: event.createdAt,
  }));

  return [...accepted, ...contractEvents].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function historyTitle(action: string, previousStatus: string | null, newStatus: string) {
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
