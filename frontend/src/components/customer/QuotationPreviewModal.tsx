import { Download, Loader2, Printer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CustomerAuthAccount, CustomerAuthUser } from '../../services/customerAuthService';
import type { CustomerQuotation } from '../../services/customerQuotationsService';
import { QuotationDocument } from './QuotationDocument';

export type QuotationPreviewAction = 'preview' | 'print' | 'download';

interface QuotationPreviewModalProps {
  account: CustomerAuthAccount;
  initialAction: QuotationPreviewAction;
  onClose: () => void;
  phone?: string | null | undefined;
  quotation: CustomerQuotation;
  user: CustomerAuthUser;
}

export function QuotationPreviewModal({
  account,
  initialAction,
  onClose,
  phone,
  quotation,
  user,
}: QuotationPreviewModalProps) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [initialActionPending, setInitialActionPending] = useState(initialAction !== 'preview');

  const print = async () => {
    await document.fonts?.ready;
    window.print();
  };

  const download = async () => {
    if (!documentRef.current || downloading) return;

    setDownloadError('');
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(documentRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const image = canvas.toDataURL('image/jpeg', 0.96);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let remainingHeight = imageHeight;
      let position = 0;

      pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        position = remainingHeight - imageHeight;
        pdf.addPage();
        pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
        remainingHeight -= pageHeight;
      }

      const reference = quotation.reference ?? 'QUOTATION';
      const suffix = quotation.status === 'DRAFT' ? '-DRAFT' : '';
      pdf.save(`${reference}${suffix}.pdf`);
    } catch {
      setDownloadError('Unable to create the PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!initialActionPending) return;

    const timer = window.setTimeout(() => {
      setInitialActionPending(false);
      if (initialAction === 'print') void print();
      if (initialAction === 'download') void download();
    }, 200);

    return () => window.clearTimeout(timer);
  });

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="quotation-preview-overlay quotation-print-layer fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-3 sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quotation-preview-title"
        className="quotation-preview-shell flex h-full max-h-[calc(100vh-24px)] w-full max-w-[1200px] flex-col overflow-hidden rounded-xl border border-[#d9d5de] bg-white shadow-2xl sm:max-h-[calc(100vh-40px)]"
      >
        <header className="quotation-preview-toolbar flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e3e1e8] bg-white px-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="quotation-preview-title" className="text-sm font-bold text-[#17151c]">
              Quotation Preview
            </h2>
            {downloadError && (
              <p className="mt-0.5 truncate text-[11px] text-red-600">{downloadError}</p>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => void print()}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <Printer size={15} /> <span className="hidden sm:inline">Print</span>
            </button>
            <button
              type="button"
              onClick={() => void download()}
              disabled={downloading}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              <span className="hidden sm:inline">
                {downloading ? 'Preparing PDF' : 'Download PDF'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close quotation preview"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="quotation-preview-canvas flex-1 overflow-auto bg-[#eef0f3] p-4 sm:p-7">
          <div className="mx-auto w-fit shadow-[0_8px_30px_rgba(15,23,42,0.16)]">
            <QuotationDocument
              ref={documentRef}
              quotation={quotation}
              account={account}
              user={user}
              phone={phone}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
