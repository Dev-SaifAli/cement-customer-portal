import { Download, Loader2, Printer, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { SalesQuotationDetails } from '../../services/salesService';
import '../customer/QuotationDocument.css';

export function SalesQuotationPreview({
  quotation,
  onClose,
}: {
  quotation: SalesQuotationDetails;
  onClose: () => void;
}) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!documentRef.current || downloading) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(documentRef.current, {
        backgroundColor: '#fff',
        scale: 2,
        useCORS: true,
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.96),
        'JPEG',
        0,
        0,
        width,
        height,
        undefined,
        'FAST',
      );
      pdf.save(`${quotation.reference ?? 'QUOTATION'}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="quotation-preview-overlay quotation-print-layer fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-3 sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Customer quotation preview"
        className="quotation-preview-shell flex h-full max-h-[calc(100vh-24px)] w-full max-w-[1200px] flex-col overflow-hidden rounded-xl border border-[#d9d5de] bg-white shadow-2xl"
      >
        <header className="quotation-preview-toolbar flex min-h-14 items-center justify-between border-b border-[#e3e1e8] px-4">
          <h2 className="text-sm font-bold">Customer Quotation Preview</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => window.print()} className={toolButton}>
              <Printer size={15} /> Print
            </button>
            <button
              type="button"
              onClick={() => void download()}
              disabled={downloading}
              className={toolButton}
            >
              {downloading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}{' '}
              Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="quotation-preview-canvas flex-1 overflow-auto bg-[#eef0f3] p-4 sm:p-7">
          <article
            ref={documentRef}
            className="quotation-document mx-auto min-h-[297mm] w-[210mm] bg-white px-[14mm] py-[12mm] text-[#17151c] shadow-xl"
          >
            <header className="flex items-start justify-between border-b-2 border-[#54247a] pb-4">
              <div className="flex items-center gap-3">
                <img src="/favicon.png" alt="AlSafwa Cement" className="h-12 w-16 object-contain" />
                <div>
                  <p className="text-[13px] font-extrabold text-[#54247a]">ALSAFWA CEMENT</p>
                  <p className="text-[9px] font-semibold tracking-widest text-slate-500">
                    CUSTOMER PORTAL
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold tracking-wider text-slate-600">
                  COMMERCIAL QUOTATION
                </p>
                <p className="mt-1 text-lg font-extrabold">{quotation.reference}</p>
              </div>
            </header>
            <div className="mt-5 grid grid-cols-2 gap-10 text-[9px]">
              <Info
                title="Customer Information"
                rows={[
                  ['Company', quotation.customer.companyName],
                  ['Contact', quotation.customer.contactName],
                  ['Email', quotation.customer.email],
                  ['Phone', quotation.customer.phone],
                ]}
              />
              <Info
                title="Delivery Information"
                rows={[
                  ['Fulfilment', quotation.fulfilmentType === 'PICKUP' ? 'Pick-Up' : 'Delivery'],
                  ['Requested Date', formatDate(quotation.requestedDate)],
                  [
                    quotation.fulfilmentType === 'PICKUP' ? 'Pickup From' : 'Delivery Location',
                    quotation.destination?.name,
                  ],
                  [
                    'City / Region',
                    [quotation.destination?.city, quotation.destination?.region]
                      .filter(Boolean)
                      .join(', '),
                  ],
                ]}
              />
            </div>
            <section className="mt-7">
              <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#54247a]">
                Items
              </h3>
              <table className="quotation-document-table w-full border-collapse text-[9px]">
                <thead>
                  <tr className="bg-[#f5f3f7]">
                    <th className={th}>#</th>
                    <th className={th}>Item Code</th>
                    <th className={th}>Item Name</th>
                    <th className={th}>Qty</th>
                    <th className={th}>UOM</th>
                    <th className={th}>Unit Rate</th>
                    <th className={th}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className={td}>{index + 1}</td>
                      <td className={td}>{item.productCode}</td>
                      <td className={td}>{item.productName}</td>
                      <td className={`${td} text-right`}>{formatQuantity(item.quantity)}</td>
                      <td className={`${td} text-center`}>{item.uom}</td>
                      <td className={`${td} text-right`}>{money(item.customerRate)}</td>
                      <td className={`${td} text-right font-bold`}>{money(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <div className="mt-7 grid grid-cols-2 gap-10 text-[9px]">
              <Info
                title="Commercial Terms"
                rows={[
                  ['Valid Until', formatDate(quotation.validUntil)],
                  ['Payment Terms', quotation.paymentTerms],
                  ['Notes', quotation.commercialNotes],
                ]}
              />
              <dl className="space-y-2 border-t border-[#d9d5de] pt-3">
                <Total label="Subtotal" value={quotation.subtotal} />
                <Total
                  label={`VAT (${(quotation.vatRate * 100).toFixed(0)}%)`}
                  value={quotation.vatAmount}
                />
                <Total label="Grand Total" value={quotation.grandTotal} strong />
              </dl>
            </div>
            <footer className="mt-auto flex justify-between border-t border-[#d9d5de] pt-3 text-[8px] text-slate-500">
              <span>AlSafwa Cement Customer Portal</span>
              <span>Generated on {formatDate(new Date().toISOString())}</span>
              <span>Page 1</span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}

const toolButton =
  'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60';
const th = 'border border-[#d9d5de] px-2 py-2 text-left';
const td = 'border border-[#d9d5de] px-2 py-2';
function Info({ title, rows }: { title: string; rows: Array<[string, unknown]> }) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#54247a]">
        {title}
      </h3>
      <dl className="grid grid-cols-[100px_1fr] gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold">
              {typeof value === 'string' && value ? value : 'Not provided'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
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
      className={`flex justify-between ${strong ? 'border-t border-[#d9d5de] pt-2 font-extrabold text-[#54247a]' : ''}`}
    >
      <dt>{label}</dt>
      <dd>{money(value)} SAR</dd>
    </div>
  );
}
function money(value: number | null) {
  return value === null
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
