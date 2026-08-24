import { ArrowLeft, Check, Eye, Loader2, Save, Send, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SalesQuotationPreview } from '../../components/sales/SalesQuotationPreview';
import {
  approveSalesQuotation,
  getSalesQuotation,
  rejectSalesQuotation,
  SalesApiError,
  sendSalesQuotationToCustomer,
  startSalesQuotationReview,
  submitSalesQuotationApproval,
  updateSalesQuotationPricing,
  type SalesQuotationDetails,
  type SalesQuotationStatus,
} from '../../services/salesService';

type PricingInput = Record<string, { productPrice: string; deliveryPrice: string }>;

export function SalesQuotationDetailsPage() {
  const { id = '' } = useParams();
  const [quotation, setQuotation] = useState<SalesQuotationDetails | null>(null);
  const [prices, setPrices] = useState<PricingInput>({});
  const [validUntil, setValidUntil] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [commercialNotes, setCommercialNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [preview, setPreview] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const applyQuotation = (value: SalesQuotationDetails) => {
    setQuotation(value);
    setPrices(
      Object.fromEntries(
        value.items.map((item) => [
          item.id,
          {
            productPrice: item.productPrice?.toFixed(2) ?? '',
            deliveryPrice: item.deliveryPrice?.toFixed(2) ?? '',
          },
        ]),
      ),
    );
    setValidUntil(value.validUntil ?? '');
    setPaymentTerms(value.paymentTerms ?? '');
    setCommercialNotes(value.commercialNotes ?? '');
  };

  const load = () => {
    setLoading(true);
    setError('');
    void getSalesQuotation(id)
      .then(applyQuotation)
      .catch(() => setError('Unable to load this quotation.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const perform = async (action: () => Promise<SalesQuotationDetails>) => {
    if (saving) return;
    setSaving(true);
    setError('');
    setValidation('');
    try {
      applyQuotation(await action());
    } catch (failure) {
      setError(
        failure instanceof SalesApiError && failure.status === 400
          ? failure.message
          : 'Unable to complete this action. Please retry.',
      );
    } finally {
      setSaving(false);
    }
  };

  const savePricing = async () => {
    if (!quotation) return;
    const invalid =
      !validUntil ||
      !paymentTerms.trim() ||
      quotation.items.some((item) => {
        const price = Number(prices[item.id]?.productPrice);
        const delivery = Number(prices[item.id]?.deliveryPrice);
        return (
          !Number.isFinite(price) ||
          price < 0 ||
          (quotation.fulfilmentType === 'DELIVERY' && (!Number.isFinite(delivery) || delivery < 0))
        );
      });
    if (invalid) {
      setValidation('Enter valid pricing, validity, and payment terms before saving.');
      return;
    }
    await perform(() =>
      updateSalesQuotationPricing(quotation.id, {
        items: quotation.items.map((item) => ({
          id: item.id,
          productPrice: Number(prices[item.id]?.productPrice ?? ''),
          ...(quotation.fulfilmentType === 'DELIVERY'
            ? { deliveryPrice: Number(prices[item.id]?.deliveryPrice ?? '') }
            : {}),
        })),
        validUntil,
        paymentTerms: paymentTerms.trim(),
        commercialNotes: commercialNotes.trim(),
      }),
    );
  };

  const computed = useMemo(
    () =>
      quotation?.items.map((item) => {
        const product = Number(prices[item.id]?.productPrice || 0);
        const delivery =
          quotation.fulfilmentType === 'DELIVERY' ? Number(prices[item.id]?.deliveryPrice || 0) : 0;
        return {
          id: item.id,
          rate: product + delivery,
          amount: item.quantity * (product + delivery),
        };
      }) ?? [],
    [prices, quotation],
  );
  const computedSubtotal = computed.reduce((sum, item) => sum + item.amount, 0);
  const computedVat = computedSubtotal * (quotation?.vatRate ?? 0.15);

  if (loading) return <DetailsSkeleton />;
  if (!quotation) return <ErrorState message={error} retry={load} />;

  const editable = quotation.allowedActions.editPricing;
  const destinationLabel =
    quotation.fulfilmentType === 'DELIVERY' ? 'Delivery Location' : 'Pickup From';

  return (
    <div className="space-y-4 pb-8">
      <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <Link
            to="/sales/quotations"
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[#64748b] hover:text-[#54247a]"
          >
            <ArrowLeft size={14} /> Quotations
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1a1b23]">Quotation / {quotation.reference}</h1>
            <Status status={quotation.status} />
          </div>
          <p className="mt-1 text-sm text-[#64748b]">
            Customer:{' '}
            <span className="font-semibold text-[#1a1b23]">{quotation.customer.companyName}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPreview(true)} className={secondaryButton}>
            <Eye size={15} /> Preview Customer Quote
          </button>
          {quotation.allowedActions.startReview && (
            <ActionButton
              loading={saving}
              onClick={() => perform(() => startSalesQuotationReview(id))}
            >
              Start Review
            </ActionButton>
          )}
          {quotation.allowedActions.submitApproval && (
            <ActionButton
              loading={saving}
              onClick={() => perform(() => submitSalesQuotationApproval(id))}
            >
              <Send size={15} /> Submit for Approval
            </ActionButton>
          )}
          {quotation.allowedActions.sendToCustomer && (
            <ActionButton
              loading={saving}
              onClick={() => perform(() => sendSalesQuotationToCustomer(id))}
            >
              <Send size={15} /> Send to Customer
            </ActionButton>
          )}
          {quotation.allowedActions.approve && (
            <ActionButton loading={saving} onClick={() => perform(() => approveSalesQuotation(id))}>
              <Check size={15} /> Approve
            </ActionButton>
          )}
          {quotation.allowedActions.reject && (
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50"
            >
              <XCircle size={15} /> Reject
            </button>
          )}
        </div>
      </header>

      {(error || validation) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b42318]"
        >
          {validation || error}
        </div>
      )}

      <section className={sectionClass}>
        <SectionTitle>Customer Requirement</SectionTitle>
        <div className="grid gap-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <InfoGroup
            rows={[
              ['Customer', quotation.customer.companyName],
              ['Contact Person', quotation.customer.contactName],
              ['Contact Email', quotation.customer.email],
              ['Phone', quotation.customer.phone],
            ]}
          />
          <InfoGroup
            rows={[
              ['Requested Delivery Date', formatDate(quotation.requestedDate)],
              ['Fulfilment', quotation.fulfilmentType === 'PICKUP' ? 'Pick-Up' : 'Delivery'],
              [destinationLabel, quotation.destination?.name],
              [
                'City / Region',
                [quotation.destination?.city, quotation.destination?.region]
                  .filter(Boolean)
                  .join(', '),
              ],
            ]}
          />
          <InfoGroup
            rows={[
              ['Address', formatAddress(quotation.destination)],
              ['Customer Notes', quotation.notes],
            ]}
          />
          <div className="rounded-lg border border-[#e5d9ed] bg-[#f6f2fa] p-3">
            <p className="text-xs font-medium text-[#64748b]">Quotation Status</p>
            <div className="mt-1">
              <Status status={quotation.status} />
            </div>
            <p className="mt-4 text-xs text-[#64748b]">Submitted On</p>
            <p className="mt-1 text-sm font-semibold">{formatDateTime(quotation.submittedAt)}</p>
          </div>
        </div>
      </section>

      <section className={`${sectionClass} overflow-hidden p-0`}>
        <div className="flex items-center justify-between px-4 py-3">
          <SectionTitle noBorder>Commercial Pricing</SectionTitle>
          <span className="text-xs font-medium text-[#64748b]">Currency: SAR</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed text-xs">
            <thead className="border-y border-[#e3e1e8] bg-[#f8fafc]">
              <tr>
                <th className="w-10 p-3">#</th>
                <th className="w-24 p-3 text-left">Item Code</th>
                <th className="w-56 p-3 text-left">Item Name</th>
                <th className="w-24 p-3">Qty</th>
                <th className="w-20 p-3">UOM</th>
                <th className="w-24 p-3">Packaging</th>
                <th className="w-36 p-3">Product Price</th>
                <th className="w-36 p-3">Delivery Price</th>
                <th className="w-36 p-3">Customer Rate</th>
                <th className="w-36 p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, index) => {
                const calculated = computed.find((value) => value.id === item.id);
                return (
                  <tr key={item.id} className="border-b border-[#e3e1e8] last:border-0">
                    <td className="p-3 text-center">{index + 1}</td>
                    <td className="p-3 font-bold">{item.productCode}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <ProductImage src={item.image} name={item.productName} />
                        <span className="font-semibold">{item.productName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">{formatQuantity(item.quantity)}</td>
                    <td className="p-3 text-center">{item.uom}</td>
                    <td className="p-3 text-center">{item.packagingType}</td>
                    <td className="p-3">
                      <PriceInput
                        disabled={!editable}
                        value={prices[item.id]?.productPrice ?? ''}
                        onChange={(value) =>
                          setPrices((current) => ({
                            ...current,
                            [item.id]: {
                              productPrice: value,
                              deliveryPrice: current[item.id]?.deliveryPrice ?? '',
                            },
                          }))
                        }
                      />
                      <PriceComparison
                        list={item.productListPrice}
                        value={Number(prices[item.id]?.productPrice)}
                      />
                    </td>
                    <td className="p-3">
                      {quotation.fulfilmentType === 'DELIVERY' ? (
                        <>
                          <PriceInput
                            disabled={!editable}
                            value={prices[item.id]?.deliveryPrice ?? ''}
                            onChange={(value) =>
                              setPrices((current) => ({
                                ...current,
                                [item.id]: {
                                  productPrice: current[item.id]?.productPrice ?? '',
                                  deliveryPrice: value,
                                },
                              }))
                            }
                          />
                          <PriceComparison
                            list={item.deliveryListPrice}
                            value={Number(prices[item.id]?.deliveryPrice)}
                          />
                        </>
                      ) : (
                        <span className="text-[#64748b]">Not applicable</span>
                      )}
                    </td>
                    <td className="bg-[#faf7fc] p-3 text-center font-bold">
                      {money(calculated?.rate ?? item.customerRate)}
                    </td>
                    <td className="p-3 text-right font-bold">
                      {money(calculated?.amount ?? item.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="flex justify-end border-t border-[#e3e1e8] px-4 py-3">
            <button
              type="button"
              onClick={() => void savePricing()}
              disabled={saving}
              className={secondaryButton}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
              Pricing
            </button>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr_0.9fr]">
        <section className={sectionClass}>
          <SectionTitle>Commercial Terms</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quotation Valid Until">
              <input
                type="date"
                disabled={!editable}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Payment Terms">
              <select
                disabled={!editable}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className={inputClass}
              >
                <option value="">Select terms</option>
                <option>Payment in Advance</option>
                <option>30 Days From Invoice Date</option>
                <option>45 Days From Invoice Date</option>
                <option>60 Days From Invoice Date</option>
              </select>
            </Field>
            <Field label="Commercial Notes" wide>
              <textarea
                disabled={!editable}
                value={commercialNotes}
                onChange={(e) => setCommercialNotes(e.target.value)}
                maxLength={1000}
                rows={3}
                className={inputClass}
              />
            </Field>
          </div>
        </section>
        <section className={sectionClass}>
          <SectionTitle>Approval Routing</SectionTitle>
          <ApprovalRow
            label="Hader Manager"
            status={quotation.approvals.hader}
            reason="Delivery price approval"
          />
          <div className="ml-2 h-4 border-l border-[#cbd5e1]" />
          <ApprovalRow
            label="Price Manager"
            status={quotation.approvals.price}
            reason="Product price approval"
          />
        </section>
        <section className={sectionClass}>
          <dl className="space-y-4 text-sm">
            <Total label="Subtotal" value={editable ? computedSubtotal : quotation.subtotal} />
            <Total
              label={`VAT (${(quotation.vatRate * 100).toFixed(0)}%)`}
              value={editable ? computedVat : quotation.vatAmount}
            />
            <Total
              label="Grand Total"
              value={editable ? computedSubtotal + computedVat : quotation.grandTotal}
              strong
            />
          </dl>
        </section>
      </div>

      <section className={sectionClass}>
        <SectionTitle>Activity Timeline</SectionTitle>
        {quotation.events.length ? (
          <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quotation.events.map((event) => (
              <li key={event.id} className="relative border-l-2 border-[#e5d9ed] pl-4">
                <span className="absolute -left-[7px] top-0 h-3 w-3 rounded-full border-2 border-[#54247a] bg-white" />
                <p className="text-sm font-bold">{eventLabel(event.action)}</p>
                <p className="mt-1 text-xs text-[#64748b]">
                  {event.changedBy} · {timeAgo(event.createdAt)}
                </p>
                {event.reason && (
                  <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-[#64748b]">
                    {event.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[#64748b]">No activity recorded.</p>
        )}
      </section>

      {preview && <SalesQuotationPreview quotation={quotation} onClose={() => setPreview(false)} />}
      {rejecting && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold">Reject commercial approval</h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Provide a clear reason so Sales can correct the quotation.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className={`${inputClass} mt-4`}
              placeholder="Rejection reason"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(false)} className={secondaryButton}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || saving}
                onClick={() => {
                  void perform(() => rejectSalesQuotation(id, rejectReason.trim()));
                  setRejecting(false);
                  setRejectReason('');
                }}
                className="h-10 rounded-lg bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const sectionClass = 'rounded-xl border border-[#e3e1e8] bg-white p-4';
const secondaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e3e1e8] bg-white px-4 text-sm font-bold text-[#1a1b23] hover:bg-[#f8fafc] disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-[#e3e1e8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#54247a] focus:ring-1 focus:ring-[#54247a] disabled:bg-slate-50 disabled:text-[#64748b]';
function ActionButton({
  children,
  loading,
  onClick,
}: {
  children: React.ReactNode;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-60"
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}
function SectionTitle({ children, noBorder }: { children: React.ReactNode; noBorder?: boolean }) {
  return (
    <h2
      className={`text-xs font-extrabold uppercase tracking-wide text-[#54247a] ${noBorder ? '' : 'mb-4 border-b border-[#e3e1e8] pb-3'}`}
    >
      {children}
    </h2>
  );
}
function InfoGroup({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <dl className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-[#64748b]">{label}</dt>
          <dd className="mt-0.5 break-words font-semibold text-[#1a1b23]">
            {typeof value === 'string' && value ? value : 'Not provided'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function Field({
  children,
  label,
  wide,
}: {
  children: React.ReactNode;
  label: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? 'sm:col-span-2' : ''}>
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}
function PriceInput({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label="Price"
      type="number"
      min="0"
      step="0.01"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-[#e3e1e8] px-2 text-right font-semibold outline-none focus:border-[#54247a] disabled:bg-slate-50"
    />
  );
}
function PriceComparison({ list, value }: { list: number | null; value: number }) {
  const changed = list !== null && Number.isFinite(value) && Math.abs(list - value) >= 0.005;
  return (
    <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-[#64748b]">
      <span>List: {list === null ? 'Not configured' : list.toFixed(2)}</span>
      {list !== null && (
        <span
          className={`inline-flex items-center gap-1 font-semibold ${changed ? 'text-[#b45309]' : 'text-[#64748b]'}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${changed ? 'bg-amber-500' : 'bg-slate-400'}`}
          />
          {changed ? 'Modified' : 'List Price'}
        </span>
      )}
    </div>
  );
}
function ApprovalRow({ label, status, reason }: { label: string; status: string; reason: string }) {
  return (
    <div className="flex gap-3">
      <span
        className={`mt-1 h-3 w-3 rounded-full border-2 ${status === 'APPROVED' ? 'border-emerald-600 bg-emerald-600' : status === 'PENDING' ? 'border-orange-500 bg-white' : 'border-slate-300 bg-white'}`}
      />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">{label}</p>
          <span className="text-xs font-semibold text-[#b45309]">{formatApproval(status)}</span>
        </div>
        <p className="mt-0.5 text-xs text-[#64748b]">{reason}</p>
      </div>
    </div>
  );
}
function Total({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${strong ? 'border-t border-[#e3e1e8] pt-4 font-extrabold text-[#54247a]' : ''}`}
    >
      <dt>{label}</dt>
      <dd>{money(value)} SAR</dd>
    </div>
  );
}
function ProductImage({ src, name }: { src: string | null; name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50">
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <span className="text-[9px] text-slate-400">No image</span>
      )}
    </div>
  );
}
function Status({ status }: { status: SalesQuotationStatus }) {
  const item = statusMap[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${item.text}`}>
      <span className={`h-2 w-2 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
}
function DetailsSkeleton() {
  return (
    <div className="space-y-4">
      {[80, 190, 280, 180].map((height) => (
        <div
          key={height}
          style={{ height }}
          className="animate-pulse rounded-xl border border-[#e3e1e8] bg-white"
        />
      ))}
    </div>
  );
}
function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3">
      <p className="font-semibold text-[#b42318]">{message}</p>
      <button onClick={retry} className={secondaryButton}>
        Retry
      </button>
    </div>
  );
}
const statusMap: Record<SalesQuotationStatus, { label: string; dot: string; text: string }> = {
  PENDING_SALES_REVIEW: {
    label: 'Pending Sales Review',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
  },
  UNDER_REVIEW: { label: 'Under Review', dot: 'bg-blue-600', text: 'text-blue-700' },
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
  ACCEPTED: { label: 'Accepted', dot: 'bg-emerald-600', text: 'text-emerald-700' },
  REJECTED: { label: 'Rejected', dot: 'bg-red-600', text: 'text-red-700' },
  CLARIFICATION_REQUESTED: {
    label: 'Clarification Requested',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
  },
};
const actionLabels: Record<string, string> = {
  CUSTOMER_SUBMITTED: 'Customer submitted',
  SALES_STARTED_REVIEW: 'Sales started review',
  PRICING_UPDATED: 'Commercial pricing updated',
  SUBMITTED_FOR_APPROVAL: 'Submitted for approval',
  HADER_MANAGER_APPROVED: 'Hader Manager approved',
  HADER_MANAGER_REJECTED: 'Hader Manager rejected',
  PRICE_MANAGER_APPROVED: 'Price Manager approved',
  PRICE_MANAGER_REJECTED: 'Price Manager rejected',
  SENT_TO_CUSTOMER: 'Sent to customer',
};
function eventLabel(action: string) {
  return actionLabels[action] ?? action.toLowerCase().replaceAll('_', ' ');
}
function formatApproval(value: string) {
  return value === 'NOT_REQUIRED' ? 'Not required' : value.charAt(0) + value.slice(1).toLowerCase();
}
function money(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        value,
      );
}
function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}
function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : 'Not provided';
}
function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Not provided';
}
function formatAddress(destination: SalesQuotationDetails['destination']) {
  return destination
    ? [
        destination.streetAddress,
        destination.city,
        destination.region,
        destination.postalCode,
        destination.country,
      ]
        .filter(Boolean)
        .join(', ')
    : 'Not provided';
}
function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
