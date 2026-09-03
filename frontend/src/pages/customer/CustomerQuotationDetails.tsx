import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  Printer,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ProductImage } from '../../components/customer/ProductImage';
import {
  QuotationPreviewModal,
  type QuotationPreviewAction,
} from '../../components/customer/QuotationPreviewModal';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { getCustomerDashboard } from '../../services/customerDashboardService';
import {
  acceptCustomerQuotation,
  rejectCustomerQuotation,
  requestCustomerQuotationClarification,
  type CustomerQuotation,
} from '../../services/customerQuotationsService';

type Decision = 'accept' | 'reject' | 'clarification';

export function CustomerQuotationDetails({
  initialQuotation,
}: {
  initialQuotation: CustomerQuotation;
}) {
  const { account, user } = useCustomerAuth();
  const [quotation, setQuotation] = useState(initialQuotation);
  const [phone, setPhone] = useState<string | null>(null);
  const [previewAction, setPreviewAction] = useState<QuotationPreviewAction | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void getCustomerDashboard()
      .then((data) => setPhone(data.contact.phone ?? data.administrator.phone))
      .catch(() => setPhone(null));
  }, []);

  if (!account || !user) return null;

  const destination =
    quotation.fulfilmentType === 'DELIVERY' ? quotation.shipToLocation : quotation.pickupLocation;
  const canDecide = user.role === 'CUSTOMER_ADMIN';
  const isReadyForCustomer = quotation.status === 'READY_FOR_CUSTOMER';
  const canTakeDecision = isReadyForCustomer && canDecide;

  const submitDecision = async () => {
    if (!decision || submitting) return;
    const trimmed = message.trim();
    if (decision !== 'accept' && trimmed.length < 3) {
      setError(
        decision === 'reject'
          ? 'Please provide a reason for rejecting this quotation.'
          : 'Please enter your clarification request.',
      );
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const updated =
        decision === 'accept'
          ? await acceptCustomerQuotation(quotation.id)
          : decision === 'reject'
            ? await rejectCustomerQuotation(quotation.id, trimmed)
            : await requestCustomerQuotationClarification(quotation.id, trimmed);
      setQuotation(updated);
      setSuccess(
        decision === 'accept'
          ? 'Quotation accepted successfully.'
          : decision === 'reject'
            ? 'Quotation rejected. Your reason has been shared with Sales.'
            : 'Your clarification request has been sent to Sales.',
      );
      setDecision(null);
      setMessage('');
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to record your decision.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-8 text-[#1a1b23]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/customer/quotations"
            className="mb-2 inline-flex text-xs font-semibold text-slate-600 hover:text-[#54247a]"
          >
            ← Quotations
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Quotation / {quotation.reference ?? 'Reference pending'}
            </h1>
            <Status status={quotation.status} />
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Customer: <span className="font-semibold text-slate-800">{account.companyName}</span>
            <span className="mx-2 text-slate-300">|</span>
            Customer ID: <span className="font-medium">{account.id}</span>
            <span className="mx-2 text-slate-300">|</span>
            Created on: {formatDateTime(quotation.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewAction('preview')}
            className={secondaryButton}
          >
            <Printer size={16} /> Preview / Print
          </button>
          <button
            type="button"
            onClick={() => setPreviewAction('download')}
            className={primaryButton}
          >
            <Download size={16} /> Download PDF
          </button>
        </div>
      </header>

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={17} /> {success}
        </div>
      )}

      {isReadyForCustomer && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#dfd0ea] bg-[#f6f2fa] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#54247a]">
              <FileText size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#54247a]">
                Please review the commercial terms of this quotation carefully.
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                You can accept, reject, or request clarification if you need any changes.
              </p>
            </div>
          </div>
          <div className="border-l border-[#d8c7e3] pl-5">
            <p className="text-[11px] font-semibold text-slate-600">Valid Until</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#54247a]">
              <CalendarDays size={15} /> {formatDate(quotation.validUntil)}
            </p>
          </div>
        </section>
      )}

      <section className="grid gap-5 rounded-xl border border-[#e3e1e8] bg-white p-5 text-sm md:grid-cols-3">
        <InfoGroup>
          <Info label="Customer" value={account.companyName} />
          <Info label="Contact Person" value={user.name} />
          <Info label="Email" value={user.email} />
          <Info label="Phone" value={phone} />
        </InfoGroup>
        <InfoGroup>
          <Info label="Requested Delivery Date" value={formatDate(quotation.requestedDate)} />
          <Info
            label="Fulfilment"
            value={quotation.fulfilmentType === 'DELIVERY' ? 'Delivery' : 'Pick-Up'}
          />
          <Info
            label={
              quotation.fulfilmentType === 'DELIVERY' ? 'Delivery Location' : 'Pickup Location'
            }
            value={destination?.name}
          />
          <Info
            label="City / Region"
            value={[destination?.city, destination?.region].filter(Boolean).join(', ')}
          />
        </InfoGroup>
        <InfoGroup>
          <Info label="Payment Terms" value={quotation.paymentTerms} />
          <Info label="Valid Until" value={formatDate(quotation.validUntil)} />
          <Info label="Customer Notes" value={quotation.notes} />
        </InfoGroup>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#e3e1e8] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                {[
                  '#',
                  'Item Code',
                  'Item Name',
                  'Quantity',
                  'UOM',
                  'Packaging',
                  'Packaging Quantity',
                  'Unit Rate (SAR / TON)',
                  'Amount (SAR)',
                ].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-r border-[#e3e1e8] px-4 py-3 text-left last:border-r-0"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, index) => (
                <tr key={item.id}>
                  <td className={cell}>{index + 1}</td>
                  <td className={`${cell} font-semibold`}>{item.product.productCode}</td>
                  <td className={cell}>
                    <div className="flex items-center gap-3">
                      <ProductImage
                        image={item.product.image}
                        productName={item.product.productName}
                        size="thumbnail"
                      />
                      <span className="font-medium">{item.product.productName}</span>
                    </div>
                  </td>
                  <td className={`${cell} text-right`}>
                    <div>{formatQuantity(item.quantityTon)} TON</div>
                  </td>
                  <td className={cell}>{item.commercialUom}</td>
                  <td className={cell}>{item.packagingType}</td>
                  <td className={`${cell} text-right`}>
                    {item.packagingQuantity === null
                      ? 'Bulk'
                      : `${formatQuantity(item.packagingQuantity)} Bags`}
                  </td>
                  <td className={`${cell} text-right`}>{formatMoney(item.customerRate)}</td>
                  <td className={`${cell} text-right font-bold`}>{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="customer-card customer-border rounded-xl border p-5">
          <h2 className="customer-primary text-sm font-bold">Commercial Notes</h2>
          <p className="customer-secondary mt-3 whitespace-pre-wrap text-sm leading-6">
            {quotation.commercialNotes?.trim() || 'Not provided'}
          </p>
        </section>
        <section className="customer-card customer-border rounded-xl border p-5 text-sm">
          <Total label="Subtotal" value={quotation.subtotal} />
          <Total
            label={`VAT (${formatVatPercent(quotation.vatRate)})`}
            value={quotation.vatAmount}
          />
          <div className="customer-border mt-3 border-t pt-3">
            <Total label="Grand Total" value={quotation.grandTotal} strong />
          </div>
        </section>
      </div>

      {canTakeDecision && (
        <section className="customer-card customer-border rounded-xl border p-4">
          <h2 className="customer-primary text-sm font-bold">What would you like to do?</h2>
          <p className="customer-secondary mt-1 text-xs">
            Please choose one action regarding this quotation.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <DecisionCard
              icon={<Check size={18} />}
              tone="green"
              title="Accept Quotation"
              description="I accept the commercial terms shown in this quotation."
              onClick={() => setDecision('accept')}
            />
            <DecisionCard
              icon={<X size={18} />}
              tone="red"
              title="Reject"
              description="I do not want to proceed with this quotation."
              onClick={() => setDecision('reject')}
            />
            <DecisionCard
              icon={<HelpCircle size={18} />}
              tone="amber"
              title="Request Clarification"
              description="I need more information or changes to this quotation."
              onClick={() => setDecision('clarification')}
            />
          </div>
          <p className="customer-muted mt-3 flex items-center gap-2 text-[11px]">
            <ShieldCheck size={14} /> Your action will be recorded and communicated to our Sales
            team.
          </p>
        </section>
      )}

      {decision && (
        <DecisionDialog
          decision={decision}
          error={error}
          message={message}
          submitting={submitting}
          onMessageChange={setMessage}
          onCancel={() => {
            setDecision(null);
            setMessage('');
            setError('');
          }}
          onConfirm={() => void submitDecision()}
        />
      )}

      {previewAction && (
        <QuotationPreviewModal
          account={account}
          user={user}
          phone={phone}
          quotation={quotation}
          initialAction={previewAction}
          onClose={() => setPreviewAction(null)}
        />
      )}
    </div>
  );
}

function InfoGroup({ children }: { children: ReactNode }) {
  return <dl className="space-y-3">{children}</dl>;
}
function Info({ label, value }: { label: string; value?: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-[#1a1b23]">{value || 'Not provided'}</dd>
    </div>
  );
}
function Total({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: number | null;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${strong ? 'customer-primary text-base font-bold' : 'customer-secondary'}`}
    >
      <span>{label}</span>
      <span>{formatMoney(value)} SAR</span>
    </div>
  );
}

function Status({ status }: { status: CustomerQuotation['status'] }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${config.text}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function DecisionCard({
  description,
  icon,
  onClick,
  title,
  tone,
}: {
  description: string;
  icon: ReactNode;
  onClick: () => void;
  title: string;
  tone: 'green' | 'red' | 'amber';
}) {
  const tones = {
    green:
      'border-[var(--customer-success)] bg-[var(--customer-success-soft)] text-[var(--customer-success)]',
    red:
      'border-[var(--customer-danger)] bg-[var(--customer-danger-soft)] text-[var(--customer-danger)]',
    amber:
      'border-[var(--customer-warning)] bg-[var(--customer-warning-soft)] text-[var(--customer-warning)]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-28 items-start gap-3 rounded-lg border p-4 text-left transition ${tones[tone]}`}
    >
      <span className="customer-card mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-1 block text-xs leading-5 opacity-80">{description}</span>
      </span>
    </button>
  );
}

function DecisionDialog({
  decision,
  error,
  message,
  onCancel,
  onConfirm,
  onMessageChange,
  submitting,
}: {
  decision: Decision;
  error: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  onMessageChange: (value: string) => void;
  submitting: boolean;
}) {
  const isAccept = decision === 'accept';
  const title = isAccept
    ? 'Accept Quotation?'
    : decision === 'reject'
      ? 'Reject Quotation?'
      : 'Request Clarification';

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, submitting]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        className="customer-card customer-border w-full max-w-lg rounded-xl border p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6f2fa] text-[#54247a]">
            {isAccept ? (
              <CheckCircle2 size={21} />
            ) : decision === 'reject' ? (
              <XCircle size={21} />
            ) : (
              <HelpCircle size={21} />
            )}
          </span>
          <div>
            <h2 id="decision-title" className="text-lg font-bold">
              {title}
            </h2>
            <p className="customer-secondary mt-1 text-sm">
              {isAccept
                ? 'You are confirming the commercial terms shown in this quotation.'
                : decision === 'reject'
                  ? 'Tell our Sales team why you do not want to proceed.'
                  : 'Tell our Sales team what information or changes you need.'}
            </p>
          </div>
        </div>
        {!isAccept && (
          <div className="mt-4">
            <label htmlFor="decision-message" className="customer-secondary text-xs font-semibold">
              {decision === 'reject' ? 'Reason' : 'Message'} <span className="text-red-600">*</span>
            </label>
            <textarea
              id="decision-message"
              autoFocus
              value={message}
              maxLength={1000}
              onChange={(event) => onMessageChange(event.target.value)}
              className="customer-input customer-border customer-text mt-1.5 min-h-28 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--customer-primary)] focus:ring-2 focus:ring-[var(--customer-primary)]"
            />
          </div>
        )}
        {error && (
          <p className="mt-3 flex items-center gap-2 text-xs font-medium text-red-700">
            <AlertCircle size={15} />
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={secondaryButton}
          >
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={submitting} className={primaryButton}>
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {isAccept ? 'Accept' : decision === 'reject' ? 'Reject Quotation' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

const cell = 'border-b border-r border-[#e3e1e8] px-4 py-3 last:border-r-0';
const primaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-semibold text-white transition hover:bg-[#472066] disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d8d4de] bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#54247a] hover:text-[#54247a] disabled:opacity-60';

const statusConfig: Record<
  CustomerQuotation['status'],
  { label: string; dot: string; text: string }
> = {
  DRAFT: { label: 'Draft', dot: 'bg-slate-400', text: 'text-slate-600' },
  PENDING_SALES_REVIEW: {
    label: 'Pending Sales Review',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
  },
  UNDER_REVIEW: { label: 'Under Review', dot: 'bg-blue-500', text: 'text-blue-700' },
  PENDING_HADER_APPROVAL: {
    label: 'Pending Hader Approval',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
  },
  PENDING_PRICE_APPROVAL: {
    label: 'Pending Price Approval',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
  },
  READY_FOR_CUSTOMER: { label: 'Ready for Customer', dot: 'bg-[#54247a]', text: 'text-[#54247a]' },
  ACCEPTED: { label: 'Accepted', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  REJECTED: { label: 'Rejected', dot: 'bg-red-500', text: 'text-red-700' },
  CLARIFICATION_REQUESTED: {
    label: 'Clarification Requested',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
  },
};

function formatDate(value?: string | null) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        date,
      );
}
function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
}
function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}
function formatMoney(value: number | null) {
  return value === null
    ? 'Not provided'
    : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        value,
      );
}
function formatVatPercent(value: number | null) {
  return value === null
    ? 'Not provided'
    : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value * 100)}%`;
}
