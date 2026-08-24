import { forwardRef, type ReactNode } from 'react';
import type { CustomerAuthAccount, CustomerAuthUser } from '../../services/customerAuthService';
import type { CustomerQuotation } from '../../services/customerQuotationsService';
import './QuotationDocument.css';

interface QuotationDocumentProps {
  quotation: CustomerQuotation;
  account: CustomerAuthAccount;
  user: CustomerAuthUser;
  phone?: string | null | undefined;
}

export const QuotationDocument = forwardRef<HTMLDivElement, QuotationDocumentProps>(
  function QuotationDocument({ quotation, account, user, phone }, ref) {
    const isDraft = quotation.status === 'DRAFT';
    const showsCommercialTerms = [
      'READY_FOR_CUSTOMER',
      'ACCEPTED',
      'REJECTED',
      'CLARIFICATION_REQUESTED',
    ].includes(quotation.status);
    const destination =
      quotation.fulfilmentType === 'DELIVERY' ? quotation.shipToLocation : quotation.pickupLocation;
    const destinationLabel =
      quotation.fulfilmentType === 'DELIVERY' ? 'Delivery Location' : 'Pickup From';
    const address =
      quotation.fulfilmentType === 'DELIVERY' && quotation.shipToLocation
        ? formatAddress(quotation.shipToLocation)
        : null;

    return (
      <article ref={ref} className="quotation-document relative bg-white text-[#17151c]">
        {isDraft && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
          >
            <span className="-rotate-[35deg] select-none text-[96px] font-extrabold tracking-[0.14em] text-[#54247a]/[0.08]">
              DRAFT
            </span>
          </div>
        )}

        <div className="relative z-10 flex min-h-[277mm] flex-col px-[14mm] py-[12mm]">
          <header className="flex items-start justify-between border-b-2 border-[#54247a] pb-4">
            <div className="flex items-center gap-3">
              <img src="/favicon.png" alt="AlSafwa Cement" className="h-12 w-16 object-contain" />
              <div>
                <p className="text-[13px] font-extrabold text-[#54247a]">ALSAFWA CEMENT</p>
                <p className="text-[9px] font-semibold tracking-[0.12em] text-slate-500">
                  CUSTOMER PORTAL
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold tracking-[0.08em] text-slate-600">
                QUOTATION REQUEST
              </p>
              <p className="mt-1 text-lg font-extrabold text-[#17151c]">
                {quotation.reference ?? 'Reference pending'}
              </p>
            </div>
          </header>

          <section className="mt-5 grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-[10px]">
            <DocumentLabel label="Quotation Reference" value={quotation.reference} />
            <DocumentLabel
              label="Status"
              value={formatStatus(quotation.status)}
              highlight={!isDraft}
            />
            <DocumentLabel label="Created Date" value={formatDate(quotation.createdAt)} />
            <DocumentLabel label="Requested By" value={user.name} />
          </section>

          <div className="mt-7 grid grid-cols-2 gap-12">
            <DocumentSection title="Customer Information">
              <DocumentLabel label="Company Name" value={account.companyName} />
              <DocumentLabel label="Customer ID" value={account.id} />
              <DocumentLabel label="Contact Person" value={user.name} />
              <DocumentLabel label="Email" value={user.email} />
              <DocumentLabel label="Phone" value={phone} />
            </DocumentSection>

            <DocumentSection title="Delivery Information">
              <DocumentLabel
                label="Fulfilment"
                value={formatFulfilment(quotation.fulfilmentType)}
              />
              <DocumentLabel
                label="Requested Delivery Date"
                value={formatDate(quotation.requestedDate)}
              />
              <DocumentLabel label={destinationLabel} value={destination?.name} />
              <DocumentLabel label="City" value={destination?.city} />
              <DocumentLabel label="Region" value={destination?.region} />
              <DocumentLabel label="Address" value={address} />
            </DocumentSection>
          </div>

          <section className="mt-7">
            <h2 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#54247a]">
              Items
            </h2>
            <table className="quotation-document-table w-full border-collapse text-[9px]">
              <thead>
                <tr className="bg-[#f5f3f7] text-left">
                  <th className="w-8 border border-[#d9d5de] px-2 py-2 text-center">#</th>
                  <th className="border border-[#d9d5de] px-2 py-2">Item Code</th>
                  <th className="border border-[#d9d5de] px-2 py-2">Item Name</th>
                  <th className="w-20 border border-[#d9d5de] px-2 py-2 text-right">Quantity</th>
                  <th className="w-16 border border-[#d9d5de] px-2 py-2 text-center">UOM</th>
                  <th className="w-20 border border-[#d9d5de] px-2 py-2 text-center">Packaging</th>
                  {showsCommercialTerms && (
                    <th className="w-20 border border-[#d9d5de] px-2 py-2 text-right">
                      Equivalent
                    </th>
                  )}
                  {showsCommercialTerms && (
                    <th className="w-20 border border-[#d9d5de] px-2 py-2 text-right">
                      Unit Rate / TON
                    </th>
                  )}
                  {showsCommercialTerms && (
                    <th className="w-24 border border-[#d9d5de] px-2 py-2 text-right">Amount</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item, index) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="border border-[#d9d5de] px-2 py-2 text-center">{index + 1}</td>
                    <td className="border border-[#d9d5de] px-2 py-2 font-semibold">
                      {item.product.productCode}
                    </td>
                    <td className="border border-[#d9d5de] px-2 py-2">
                      {item.product.productName}
                    </td>
                    <td className="border border-[#d9d5de] px-2 py-2 text-right font-semibold">
                      {formatQuantity(item.quantity)}
                    </td>
                    <td className="border border-[#d9d5de] px-2 py-2 text-center">{item.uom}</td>
                    <td className="border border-[#d9d5de] px-2 py-2 text-center">
                      {item.packagingType}
                    </td>
                    {showsCommercialTerms && (
                      <td className="border border-[#d9d5de] px-2 py-2 text-right">
                        {formatQuantity(item.equivalentTons)} TON
                      </td>
                    )}
                    {showsCommercialTerms && (
                      <td className="border border-[#d9d5de] px-2 py-2 text-right">
                        {formatMoney(item.customerRate)}
                      </td>
                    )}
                    {showsCommercialTerms && (
                      <td className="border border-[#d9d5de] px-2 py-2 text-right font-semibold">
                        {formatMoney(item.amount)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {showsCommercialTerms && (
            <div className="mt-6 grid grid-cols-2 gap-8">
              <DocumentSection title="Commercial Terms">
                <DocumentLabel label="Valid Until" value={formatDate(quotation.validUntil)} />
                <DocumentLabel label="Payment Terms" value={quotation.paymentTerms} />
                <DocumentLabel label="Commercial Notes" value={quotation.commercialNotes} />
              </DocumentSection>
              <section className="rounded border border-[#d9d5de] p-3 text-[10px]">
                <MoneyRow label="Subtotal" value={quotation.subtotal} />
                <MoneyRow
                  label={
                    quotation.vatRate === null ? 'VAT' : `VAT (${formatVatRate(quotation.vatRate)})`
                  }
                  value={quotation.vatAmount}
                />
                <div className="mt-2 border-t border-[#d9d5de] pt-2">
                  <MoneyRow label="Grand Total" value={quotation.grandTotal} strong />
                </div>
              </section>
            </div>
          )}

          <section className="mt-6">
            <h2 className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#54247a]">
              Special Instructions
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-slate-700">
              {quotation.notes?.trim() || 'No special instructions provided.'}
            </p>
          </section>

          <footer className="mt-auto flex items-center justify-between border-t border-[#d9d5de] pt-3 text-[8px] font-medium text-slate-500">
            <span>AlSafwa Cement Customer Portal</span>
            <span>Generated on {formatDate(new Date().toISOString())}</span>
            <span>Page 1</span>
          </footer>
        </div>
      </article>
    );
  },
);

function DocumentSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <h2 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#54247a]">
        {title}
      </h2>
      <dl className="grid grid-cols-[105px_1fr] gap-x-2 gap-y-1.5 text-[9px]">{children}</dl>
    </section>
  );
}

function DocumentLabel({
  highlight = false,
  label,
  value,
}: {
  highlight?: boolean;
  label: string;
  value?: string | null | undefined;
}) {
  return (
    <>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd
        className={`break-words font-semibold ${highlight ? 'text-amber-600' : 'text-[#17151c]'}`}
      >
        {value || 'Not provided'}
      </dd>
    </>
  );
}

function MoneyRow({
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
      className={`flex items-center justify-between py-1 ${strong ? 'font-extrabold text-[#54247a]' : ''}`}
    >
      <span>{label}</span>
      <span>{formatMoney(value)} SAR</span>
    </div>
  );
}

function formatStatus(status: CustomerQuotation['status']) {
  const labels: Record<CustomerQuotation['status'], string> = {
    DRAFT: 'Draft',
    PENDING_SALES_REVIEW: 'Pending Sales Review',
    UNDER_REVIEW: 'Under Review',
    PENDING_HADER_APPROVAL: 'Pending Hader Approval',
    PENDING_PRICE_APPROVAL: 'Pending Price Approval',
    READY_FOR_CUSTOMER: 'Ready for Customer',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    CLARIFICATION_REQUESTED: 'Clarification Requested',
  };
  return labels[status];
}

function formatFulfilment(value: CustomerQuotation['fulfilmentType']) {
  return value === 'PICKUP' ? 'Pick-Up' : 'Delivery';
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number | null) {
  if (value === null) return 'Not provided';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatVatRate(value: number | null) {
  return value === null
    ? 'VAT'
    : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value * 100)}%`;
}

function formatAddress(location: NonNullable<CustomerQuotation['shipToLocation']>) {
  return [
    location.streetAddress,
    location.city,
    location.region,
    location.postalCode,
    location.country,
  ]
    .filter(Boolean)
    .join(', ');
}
