import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SalesQuotationPreview } from '../../components/sales/SalesQuotationPreview';
import {
  approveSalesQuotation,
  createContractFromSalesQuotation,
  getSalesQuotation,
  rejectSalesQuotation,
  SalesApiError,
  sendSalesQuotationToCustomer,
  startSalesQuotationReview,
  submitSalesQuotationApproval,
  updateSalesQuotationPricing,
  type SalesContractDetails,
  type SalesQuotationDetails,
  type SalesQuotationStatus,
} from '../../services/salesService';

type DiscountMode = 'PERCENT' | 'SAR_PER_TON' | '';
type PricingInput = Record<
  string,
  { productPrice: string; deliveryPrice: string; discountMode: DiscountMode; discountValue: string }
>;

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
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractError, setContractError] = useState('');
  const [createdContract, setCreatedContract] = useState<SalesContractDetails | null>(null);
  const [contractForm, setContractForm] = useState({
    startDate: today(),
    endDate: today(),
    totalQuantityTons: '',
    internalNotes: '',
  });

  const applyQuotation = (value: SalesQuotationDetails) => {
    setQuotation(value);
    setPrices(
      Object.fromEntries(
        value.items.map((item) => [
          item.id,
          {
            productPrice: item.productPrice?.toFixed(2) ?? '',
            deliveryPrice: item.deliveryPrice?.toFixed(2) ?? '',
            discountMode: item.discountMode ?? '',
            discountValue: item.discountValue?.toString() ?? '',
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
      setError(toSafeActionError(failure));
    } finally {
      setSaving(false);
    }
  };

  const pricingPayload = () => {
    if (!quotation) return null;
    if (!quotation.pricingCity) {
      setValidation('Pricing city is not configured for this quotation.');
      return null;
    }
    const productsWithoutListPricing = missingProductListPrices(quotation);
    if (productsWithoutListPricing.length) {
      setValidation(
        `List pricing is not configured for ${productsWithoutListPricing.map((item) => `${item.productCode} (${quotation.pricingCity?.name ?? 'unmapped city'} · ${item.packagingType} · ${item.uom})`).join(', ')}. Contact the pricing administrator.`,
      );
      return null;
    }
    const productsWithoutDeliveryPricing = missingDeliveryListPrices(quotation);
    if (productsWithoutDeliveryPricing.length) {
      setValidation(
        `Hader delivery pricing is not configured for ${quotation.pricingCity?.name ?? 'unmapped city'}. Configure delivery pricing for the quotation delivery UOM before preparing this quotation.`,
      );
      return null;
    }
    const invalid =
      !validUntil ||
      !paymentTerms.trim() ||
      quotation.items.some((item) => {
        const price = Number(prices[item.id]?.productPrice);
        const discountedPrice = finalProductPrice(item.productListPrice, prices[item.id]);
        const delivery = Number(prices[item.id]?.deliveryPrice);
        return (
          !Number.isFinite(discountedPrice ?? price) ||
          Number(discountedPrice ?? price) <= 0 ||
          (quotation.fulfilmentType === 'DELIVERY' && (!Number.isFinite(delivery) || delivery < 0))
        );
      });
    if (invalid) {
      setValidation('Enter valid pricing, validity, and payment terms before continuing.');
      return null;
    }
    return {
      items: quotation.items.map((item) => {
        const input = prices[item.id];
        return {
          id: item.id,
          productPrice:
            finalProductPrice(item.productListPrice, input) ?? Number(input?.productPrice ?? ''),
          ...(input?.discountMode
            ? {
                discountMode: input.discountMode as Exclude<DiscountMode, ''>,
                discountValue: Number(input.discountValue || 0),
              }
            : {}),
          ...(quotation.fulfilmentType === 'DELIVERY'
            ? { deliveryPrice: Number(input?.deliveryPrice ?? '') }
            : {}),
        };
      }),
      validUntil,
      paymentTerms: paymentTerms.trim(),
      commercialNotes: commercialNotes.trim(),
    };
  };

  const submitCommercialQuote = async () => {
    if (!quotation || saving) return;
    const payload = pricingPayload();
    if (!payload) return;
    setSaving(true);
    setError('');
    setValidation('');
    try {
      const updated = await updateSalesQuotationPricing(quotation.id, payload);
      const completed = updated.allowedActions.submitApproval
        ? await submitSalesQuotationApproval(updated.id)
        : updated.allowedActions.sendToCustomer
          ? await sendSalesQuotationToCustomer(updated.id)
          : updated;
      applyQuotation(completed);
    } catch (failure) {
      setError(toSafeActionError(failure));
    } finally {
      setSaving(false);
    }
  };

  const openContractModal = () => {
    if (!quotation) return;
    const acceptedQuantity = totalEquivalentTons(quotation);
    setContractForm({
      startDate: today(),
      endDate: quotation.validUntil ?? today(),
      totalQuantityTons: acceptedQuantity.toFixed(3),
      internalNotes: '',
    });
    setContractError('');
    setCreatedContract(null);
    setContractModalOpen(true);
  };

  const submitContract = async () => {
    if (!quotation || contractSubmitting) return;
    const quantity = Number(contractForm.totalQuantityTons);
    const acceptedQuantity = totalEquivalentTons(quotation);
    if (!contractForm.startDate || !contractForm.endDate || contractForm.endDate < contractForm.startDate) {
      setContractError('Enter valid contract start and end dates.');
      return;
    }
    if (!Number.isFinite(quantity) || Math.abs(quantity - acceptedQuantity) >= 0.001) {
      setContractError('Initial contract quantity must match the accepted quotation quantity.');
      return;
    }
    setContractSubmitting(true);
    setContractError('');
    try {
      const contract = await createContractFromSalesQuotation(quotation.id, {
        startDate: contractForm.startDate,
        endDate: contractForm.endDate,
        totalQuantityTons: quantity,
        ...(contractForm.internalNotes.trim()
          ? { internalNotes: contractForm.internalNotes.trim() }
          : {}),
      });
      setCreatedContract(contract);
      load();
    } catch (failure) {
      setContractError(toSafeActionError(failure));
    } finally {
      setContractSubmitting(false);
    }
  };

  const computed = useMemo(
    () =>
      quotation?.items.map((item) => {
        const product =
          finalProductPrice(item.productListPrice, prices[item.id]) ??
          Number(prices[item.id]?.productPrice || 0);
        const delivery =
          quotation.fulfilmentType === 'DELIVERY' ? Number(prices[item.id]?.deliveryPrice || 0) : 0;
        return {
          id: item.id,
          rate: product + delivery,
          amount: item.equivalentTons * (product + delivery),
        };
      }) ?? [],
    [prices, quotation],
  );
  const computedSubtotal = computed.reduce((sum, item) => sum + item.amount, 0);
  const computedVat = computedSubtotal * (quotation?.vatRate ?? 0.15);

  if (loading) return <DetailsSkeleton />;
  if (!quotation) return <ErrorState message={error} retry={load} />;

  const editable = quotation.allowedActions.editPricing;
  const productsWithoutListPricing = missingProductListPrices(quotation);
  const productsWithoutDeliveryPricing = missingDeliveryListPrices(quotation);
  const localProductPriceChanged = quotation.items.some(
    (item) =>
      item.productListPrice !== null &&
      Math.abs(
        (finalProductPrice(item.productListPrice, prices[item.id]) ??
          Number(prices[item.id]?.productPrice)) - item.productListPrice,
      ) >= 0.005,
  );
  const localDeliveryPriceChanged =
    quotation.fulfilmentType === 'DELIVERY' &&
    quotation.items.some(
      (item) =>
        item.deliveryListPrice !== null &&
        Math.abs(Number(prices[item.id]?.deliveryPrice) - item.deliveryListPrice) >= 0.005,
    );
  const commercialActionLabel =
    quotation.allowedActions.sendToCustomer ||
    (!localProductPriceChanged && !localDeliveryPriceChanged)
      ? 'Send to Customer'
      : quotation.approvals.hader === 'REJECTED' || quotation.approvals.price === 'REJECTED'
        ? 'Resubmit for Approval'
        : 'Submit for Approval';
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
            <span className="mx-2 text-[#cbd5e1]">|</span>
            Customer ID:{' '}
            <span className="break-all font-semibold text-[#1a1b23]">{quotation.customer.id}</span>
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
          {editable && (
            <ActionButton
              loading={saving}
              disabled={productsWithoutListPricing.length > 0 || productsWithoutDeliveryPricing.length > 0}
              onClick={() => void submitCommercialQuote()}
            >
              <Send size={15} /> {commercialActionLabel}
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
          {quotation.allowedActions.createContract && (
            <ActionButton loading={contractSubmitting} onClick={openContractModal}>
              <BriefcaseBusiness size={15} /> Create Contract
            </ActionButton>
          )}
          {!quotation.allowedActions.createContract && quotation.contract && (
            <button type="button" disabled className={secondaryButton}>
              <BriefcaseBusiness size={15} /> Contract {quotation.contract.reference ?? 'created'}
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

      {editable && !quotation.pricingCity && !validation && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <p>Pricing city is not configured for this quotation.</p>
        </div>
      )}

      {editable &&
        quotation.pricingCity &&
        productsWithoutListPricing.length > 0 &&
        !validation && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <p>
              List pricing is not configured for{' '}
              {productsWithoutListPricing.map((item) => (
                <span
                  key={`${item.productCode}-${item.packagingType}-${item.uom}`}
                  className="block"
                >
                  <strong>{item.productCode}</strong> — {quotation.pricingCity?.name} ·{' '}
                  {item.packagingType} · {item.uom}
                </span>
              ))}
              Contact the pricing administrator before preparing this quotation.
            </p>
          </div>
        )}

      {editable &&
        quotation.pricingCity &&
        productsWithoutDeliveryPricing.length > 0 &&
        !validation && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <p>
              Hader delivery pricing is not configured for {quotation.pricingCity?.name}. Contact
              the pricing administrator before preparing this quotation.
            </p>
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
            <p className="mt-4 text-xs text-[#64748b]">Created by (Customer)</p>
            <p className="mt-1 text-sm font-semibold">
              {quotation.submittedBy ?? quotation.customer.contactName ?? 'Not provided'}
            </p>
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
          <table className="w-full min-w-[1220px] table-fixed text-xs">
            <thead className="border-y border-[#e3e1e8] bg-[#f8fafc]">
              <tr>
                <th className="w-10 p-3">#</th>
                <th className="w-24 p-3 text-left">Item Code</th>
                <th className="w-56 p-3 text-left">Item Name</th>
                <th className="w-28 p-3">Qty</th>
                <th className="w-20 p-3">UOM</th>
                <th className="w-24 p-3">Packaging</th>
                <th className="w-32 p-3">Product List / TON</th>
                <th className="w-40 p-3">Discount</th>
                <th className="w-36 p-3">Final Product / TON</th>
                <th className="w-36 p-3">Hader Delivery / TON</th>
                <th className="w-36 p-3">Customer Rate / TON</th>
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
                    <td className="p-3 text-center">
                      <div className="font-semibold">{formatQuantity(item.quantity)}</div>
                      <div className="mt-1 text-[11px] text-[#64748b]">
                        Equivalent: {formatQuantity(item.equivalentTons)} TON
                      </div>
                    </td>
                    <td className="p-3 text-center">{item.uom}</td>
                    <td className="p-3 text-center">{item.packagingType}</td>
                    <td className="p-3 text-center font-bold">
                      {money(item.productListPrice)}
                    </td>
                    <td className="p-3">
                      <DiscountInput
                        disabled={!editable}
                        value={prices[item.id]}
                        onChange={(patch) =>
                          setPrices((current) => ({
                            ...current,
                            [item.id]: {
                              productPrice: current[item.id]?.productPrice ?? '',
                              deliveryPrice: current[item.id]?.deliveryPrice ?? '',
                              discountMode: current[item.id]?.discountMode ?? '',
                              discountValue: current[item.id]?.discountValue ?? '',
                              ...patch,
                            },
                          }))
                        }
                      />
                    </td>
                    <td className="p-3">
                      <PriceInput
                        disabled={!editable}
                        value={
                          finalProductPrice(item.productListPrice, prices[item.id])?.toFixed(2) ??
                          prices[item.id]?.productPrice ??
                          ''
                        }
                        onChange={(value) =>
                          setPrices((current) => ({
                            ...current,
                            [item.id]: {
                              productPrice: value,
                              deliveryPrice: current[item.id]?.deliveryPrice ?? '',
                              discountMode: '',
                              discountValue: '',
                            },
                          }))
                        }
                      />
                      <PriceComparison
                        list={item.productListPrice}
                        value={
                          finalProductPrice(item.productListPrice, prices[item.id]) ??
                          Number(prices[item.id]?.productPrice)
                        }
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
                                  discountMode: current[item.id]?.discountMode ?? '',
                                  discountValue: current[item.id]?.discountValue ?? '',
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
          {(localProductPriceChanged || localDeliveryPriceChanged) && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Approval required</p>
                <p>{approvalRequirement(localProductPriceChanged, localDeliveryPriceChanged)}</p>
              </div>
            </div>
          )}
          <ApprovalRow
            label="Hader Manager"
            status={
              localDeliveryPriceChanged && quotation.approvals.hader === 'NOT_REQUIRED'
                ? 'REQUIRED'
                : quotation.approvals.hader
            }
            reason={
              localDeliveryPriceChanged
                ? changedPriceSummary(quotation, prices, 'delivery')
                : 'Delivery price approval is not required.'
            }
          />
          <div className="ml-2 h-4 border-l border-[#cbd5e1]" />
          <ApprovalRow
            label="Price Manager"
            status={
              localProductPriceChanged && quotation.approvals.price === 'NOT_REQUIRED'
                ? 'REQUIRED'
                : quotation.approvals.price
            }
            reason={
              localProductPriceChanged
                ? changedPriceSummary(quotation, prices, 'product')
                : 'Product price approval is not required.'
            }
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
          <ol className="flex flex-col gap-0 md:flex-row md:overflow-x-auto md:pb-2">
            {quotation.events.map((event, index) => (
              <li
                key={event.id}
                className="relative min-w-0 border-l-2 border-[#d9c8e5] pb-5 pl-7 last:pb-0 md:min-w-[190px] md:flex-1 md:border-l-0 md:border-t-2 md:pb-0 md:pl-0 md:pt-7"
              >
                <span className="absolute -left-[13px] top-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#a875c2] bg-white text-[#54247a] md:-top-[13px] md:left-0">
                  {event.action.includes('REJECTED') ? (
                    <XCircle size={14} className="text-red-600" />
                  ) : index === quotation.events.length - 1 ? (
                    <Clock3 size={14} />
                  ) : (
                    <CheckCircle2 size={14} className="text-emerald-600" />
                  )}
                </span>
                <p className="text-sm font-bold">{eventLabel(event.action)}</p>
                <p className="mt-1 text-xs font-medium text-[#64748b]">
                  {event.changedBy}
                  {event.actorRole ? ` · ${formatActorRole(event.actorRole)}` : ''}
                </p>
                <p
                  className="mt-0.5 text-xs text-[#64748b]"
                  title={formatDateTime(event.createdAt)}
                >
                  {timeAgo(event.createdAt)}
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
      {contractModalOpen && (
        <ContractCreationModal
          quotation={quotation}
          form={contractForm}
          onChange={setContractForm}
          loading={contractSubmitting}
          error={contractError}
          createdContract={createdContract}
          onSubmit={() => void submitContract()}
          onClose={() => setContractModalOpen(false)}
        />
      )}
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

function ContractCreationModal({
  quotation,
  form,
  onChange,
  loading,
  error,
  createdContract,
  onSubmit,
  onClose,
}: {
  quotation: SalesQuotationDetails;
  form: { startDate: string; endDate: string; totalQuantityTons: string; internalNotes: string };
  onChange: React.Dispatch<
    React.SetStateAction<{
      startDate: string;
      endDate: string;
      totalQuantityTons: string;
      internalNotes: string;
    }>
  >;
  loading: boolean;
  error: string;
  createdContract: SalesContractDetails | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const firstItem = quotation.items[0];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#e3e1e8] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1a1b23]">
              {createdContract ? 'Contract Created Successfully' : 'Create Contract from Accepted Quotation'}
            </h2>
            <p className="text-xs font-medium text-[#64748b]">
              Accepted commercial pricing is locked from the quotation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1a1b23]"
            aria-label="Close"
          >
            <XCircle size={18} />
          </button>
        </div>

        {createdContract ? (
          <div className="p-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check size={34} />
            </div>
            <div className="mt-4 text-center">
              <h3 className="text-xl font-extrabold">Contract Created Successfully!</h3>
              <p className="mt-1 text-sm text-[#64748b]">
                The accepted quotation has been converted to a draft contract.
              </p>
            </div>
            <div className="mt-5 rounded-xl border border-[#e3e1e8] bg-[#f8fafc] p-4 text-sm">
              <InfoGroup
                rows={[
                  ['Contract Number', createdContract.reference],
                  ['Quotation Number', quotation.reference],
                  ['Customer', quotation.customer.companyName],
                  ['Created At', formatDateTime(createdContract.createdAt)],
                  ['Status', createdContract.status],
                ]}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className={secondaryButton}>
                Back to Quotation
              </button>
              <Link to={`/sales/contracts/${createdContract.id}`} className={primaryLinkButton}>
                Open Contract
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b42318]">
                {error}
              </div>
            )}
            <section className="rounded-xl border border-[#e3e1e8] p-4">
              <SectionTitle>Source Quotation</SectionTitle>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <InfoGroup
                  rows={[
                    ['Quotation No.', quotation.reference],
                    ['Customer', quotation.customer.companyName],
                  ]}
                />
                <InfoGroup
                  rows={[
                    ['Accepted On', acceptedEventDate(quotation)],
                    ['Accepted By', acceptedEventActor(quotation)],
                  ]}
                />
                <InfoGroup
                  rows={[
                    ['Fulfilment', quotation.fulfilmentType === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up'],
                    ['Hader City', quotation.pricingCity?.name],
                  ]}
                />
              </div>
            </section>

            <section className="rounded-xl border border-[#e3e1e8] p-4">
              <SectionTitle>Contract Information</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Contract Start Date">
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, startDate: event.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Contract End Date">
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, endDate: event.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Contract Quantity (TON)">
                  <input
                    type="number"
                    disabled
                    step="0.001"
                    value={form.totalQuantityTons}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, totalQuantityTons: event.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Ship-To Location">
                  <input
                    disabled
                    value={quotation.destination?.name ?? 'Not provided'}
                    className={inputClass}
                  />
                </Field>
                <Field label="Summary">
                  <input
                    disabled
                    value={`${quotation.items.length} item${quotation.items.length === 1 ? '' : 's'} · ${formatQuantity(totalEquivalentTons(quotation))} TON`}
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-[#e5d9ed] bg-[#faf7fc] p-4">
              <SectionTitle>Commercial Locked — From Accepted Quotation</SectionTitle>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <LockedPrice label="Product Price / TON" value={firstItem?.productPrice} />
                <LockedPrice label="Hader Delivery / TON" value={firstItem?.deliveryPrice} />
                <LockedPrice label="Customer Rate / TON" value={firstItem?.customerRate} />
              </div>
            </section>

            <Field label="Internal Notes" wide>
              <textarea
                rows={3}
                value={form.internalNotes}
                onChange={(event) =>
                  onChange((current) => ({ ...current, internalNotes: event.target.value }))
                }
                className={inputClass}
                placeholder="Add internal notes here..."
              />
            </Field>

            <div className="flex justify-end gap-2 border-t border-[#e3e1e8] pt-4">
              <button type="button" onClick={onClose} className={secondaryButton}>
                Cancel
              </button>
              <ActionButton loading={loading} onClick={onSubmit}>
                Create Contract
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LockedPrice({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#64748b]">{label}</p>
      <p className="mt-1 rounded-lg border border-[#e5d9ed] bg-white px-3 py-2 font-bold">
        {value === null || value === undefined ? 'Not applicable' : `${money(value)} SAR`}
      </p>
    </div>
  );
}

const sectionClass = 'rounded-xl border border-[#e3e1e8] bg-white p-4';
const secondaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e3e1e8] bg-white px-4 text-sm font-bold text-[#1a1b23] hover:bg-[#f8fafc] disabled:opacity-50';
const primaryLinkButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-bold text-white hover:bg-[#472066]';
const inputClass =
  'w-full rounded-lg border border-[#e3e1e8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#54247a] focus:ring-1 focus:ring-[#54247a] disabled:bg-slate-50 disabled:text-[#64748b]';
function ActionButton({
  children,
  loading,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading || disabled}
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
function DiscountInput({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value?: { discountMode: DiscountMode; discountValue: string } | undefined;
  onChange: (patch: Partial<{ discountMode: DiscountMode; discountValue: string }>) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_78px] gap-1">
      <input
        aria-label="Discount"
        type="number"
        min="0"
        step="0.01"
        disabled={disabled || !value?.discountMode}
        value={value?.discountValue ?? ''}
        onChange={(event) => onChange({ discountValue: event.target.value })}
        placeholder="0"
        className="h-9 w-full rounded-md border border-[#e3e1e8] px-2 text-right font-semibold outline-none focus:border-[#54247a] disabled:bg-slate-50"
      />
      <select
        aria-label="Discount mode"
        disabled={disabled}
        value={value?.discountMode ?? ''}
        onChange={(event) =>
          onChange({
            discountMode: event.target.value as DiscountMode,
            discountValue: event.target.value ? (value?.discountValue ?? '') : '',
          })
        }
        className="h-9 rounded-md border border-[#e3e1e8] bg-white px-1 text-xs font-semibold outline-none focus:border-[#54247a] disabled:bg-slate-50"
      >
        <option value="">None</option>
        <option value="PERCENT">%</option>
        <option value="SAR_PER_TON">SAR</option>
      </select>
    </div>
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
  const color =
    status === 'APPROVED'
      ? 'text-emerald-700'
      : status === 'REJECTED'
        ? 'text-red-700'
        : status === 'PENDING' || status === 'REQUIRED'
          ? 'text-[#b45309]'
          : 'text-[#64748b]';
  const dot =
    status === 'APPROVED'
      ? 'border-emerald-600 bg-emerald-600'
      : status === 'REJECTED'
        ? 'border-red-600 bg-red-600'
        : status === 'PENDING' || status === 'REQUIRED'
          ? 'border-orange-500 bg-white'
          : 'border-slate-300 bg-white';
  return (
    <div className="flex gap-3">
      <span className={`mt-1 h-3 w-3 rounded-full border-2 ${dot}`} />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">{label}</p>
          <span className={`text-xs font-semibold ${color}`}>{formatApproval(status)}</span>
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function totalEquivalentTons(quotation: SalesQuotationDetails) {
  return Math.round(
    (quotation.items.reduce((sum, item) => sum + item.equivalentTons, 0) + Number.EPSILON) * 1000,
  ) / 1000;
}

function acceptedEventDate(quotation: SalesQuotationDetails) {
  const event = [...quotation.events].reverse().find((item) => item.action.includes('ACCEPT'));
  return event ? formatDateTime(event.createdAt) : 'Not provided';
}

function acceptedEventActor(quotation: SalesQuotationDetails) {
  const event = [...quotation.events].reverse().find((item) => item.action.includes('ACCEPT'));
  return event?.changedBy ?? 'Customer user';
}

function toSafeActionError(failure: unknown) {
  if (
    failure instanceof SalesApiError &&
    failure.status !== undefined &&
    failure.status >= 400 &&
    failure.status < 500
  ) {
    return failure.message;
  }
  return 'Unable to complete this action. Please retry.';
}

function approvalRequirement(productChanged: boolean, deliveryChanged: boolean) {
  if (productChanged && deliveryChanged) {
    return 'Delivery pricing requires Hader Manager approval, followed by Price Manager approval.';
  }
  return productChanged
    ? 'Modified product pricing requires Price Manager approval.'
    : 'Modified delivery pricing requires Hader Manager approval.';
}

function changedPriceSummary(
  quotation: SalesQuotationDetails,
  prices: PricingInput,
  type: 'product' | 'delivery',
) {
  const changes = quotation.items.flatMap((item) => {
    const list = type === 'product' ? item.productListPrice : item.deliveryListPrice;
    const entered =
      type === 'product'
        ? (finalProductPrice(item.productListPrice, prices[item.id]) ??
          Number(prices[item.id]?.productPrice))
        : Number(prices[item.id]?.deliveryPrice);
    if (list === null || !Number.isFinite(entered) || Math.abs(list - entered) < 0.005) return [];
    return [`${item.productCode}: ${money(list)} → ${money(entered)} SAR`];
  });
  return changes.length ? changes.join('; ') : `Modified ${type} pricing requires approval.`;
}

function finalProductPrice(
  listPrice: number | null,
  input:
    | {
        discountMode: DiscountMode;
        discountValue: string;
        productPrice?: string;
      }
    | undefined,
) {
  if (!listPrice || !input?.discountMode) return null;
  const discountValue = Number(input.discountValue || 0);
  if (!Number.isFinite(discountValue) || discountValue <= 0) return listPrice;
  const discount =
    input.discountMode === 'PERCENT' ? (listPrice * discountValue) / 100 : discountValue;
  return Math.max(0, Math.round((listPrice - discount + Number.EPSILON) * 100) / 100);
}

function missingProductListPrices(quotation: SalesQuotationDetails) {
  const missing = quotation.items.filter((item) => item.productListPrice === null);

  return Array.from(
    new Map(
      missing.map((item) => [
        `${item.productCode.trim().toUpperCase()}|${item.packagingType.trim().toUpperCase()}|${item.uom.trim().toUpperCase()}`,
        item,
      ]),
    ).values(),
  );
}

function missingDeliveryListPrices(quotation: SalesQuotationDetails) {
  if (quotation.fulfilmentType !== 'DELIVERY') return [];
  const missing = quotation.items.filter((item) => item.deliveryListPrice === null);

  return Array.from(
    new Map(
      missing.map((item) => [
        `${item.productCode.trim().toUpperCase()}|${item.packagingType.trim().toUpperCase()}|${item.uom.trim().toUpperCase()}`,
        item,
      ]),
    ).values(),
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
function formatActorRole(value: string) {
  const labels: Record<string, string> = {
    SALES_REP: 'Sales Representative',
    HADER_MANAGER: 'Hader Manager',
    PRICE_MANAGER: 'Price Manager',
    PRICING_ADMIN: 'Pricing Administrator',
    CUSTOMER_ADMIN: 'Customer Administrator',
    PURCHASER: 'Purchaser',
    FINANCE_USER: 'Finance User',
    VIEWER: 'Viewer',
  };
  return labels[value] ?? value.toLowerCase().replaceAll('_', ' ');
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
