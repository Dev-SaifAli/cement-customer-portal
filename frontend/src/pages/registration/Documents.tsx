import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Info,
  RefreshCw,
  Trash2,
  Upload,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SaveDraftButton } from '../../components/registration/SaveDraftButton';
import { SaveStatus } from '../../components/registration/SaveStatus';
import {
  isAcceptedDocumentFile,
  isDocumentValid as isRegistrationDocumentValid,
  useRegistration,
  type DocumentData,
} from '../../context/RegistrationContext';

type DocumentType = 'cr' | 'vat';

const steps = [
  'Company Info',
  'Contact Info',
  'Documents',
  'Delivery Locations',
  'Customer Admin',
  'Review & Submit',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';

export default function Documents() {
  const navigate = useNavigate();
  const { continueRegistration, data, setCurrentStep, updateDocuments } = useRegistration();
  const documents = data.documents;

  const [errors, setErrors] = useState<{
    cr?: string | undefined;
    vat?: string | undefined;
  }>({});
  useEffect(() => setCurrentStep(3), [setCurrentStep]);

  const crInputRef = useRef<HTMLInputElement>(null);
  const vatInputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isExpiredOrToday = (expiryDate: string) => {
    if (!expiryDate) return false;

    const expiry = new Date(`${expiryDate}T00:00:00`);

    return expiry <= today;
  };

  const validateDocument = (type: DocumentType, file: File | null, expiryDate: string) => {
    const documentName = type === 'cr' ? 'Company CR' : 'VAT Certificate';

    if (!file) {
      return `${documentName} document is required.`;
    }

    if (!isAcceptedDocumentFile(file)) {
      return 'Only PDF, JPG, and PNG files are allowed.';
    }

    if (file.size > MAX_FILE_SIZE) {
      return 'File size must not exceed 10 MB.';
    }

    if (!expiryDate) {
      return 'Expiry date is required.';
    }

    if (isExpiredOrToday(expiryDate)) {
      return 'Expiry date must be a future date.';
    }

    return '';
  };

  const handleFile = (type: DocumentType, file?: File) => {
    if (!file) return;

    const currentDocument = documents[type];

    const validationError = validateDocument(type, file, currentDocument.expiryDate);

    /*
     * We don't block the file if expiry date hasn't
     * been entered yet. The document can be uploaded
     * first and the expiry date entered afterwards.
     */
    let fileError = '';

    if (!isAcceptedDocumentFile(file)) {
      fileError = 'Only PDF, JPG, and PNG files are allowed.';
    } else if (file.size > MAX_FILE_SIZE) {
      fileError = 'File size must not exceed 10 MB.';
    }

    updateDocuments({
      [type]: {
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
    });

    setErrors((previous) => ({
      ...previous,
      [type]: fileError || undefined,
    }));

    void validationError;
  };

  const handleFileInput = (type: DocumentType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      handleFile(type, file);
    }

    event.target.value = '';
  };

  const handleDrop = (type: DocumentType, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const file = event.dataTransfer.files?.[0];

    if (file) {
      handleFile(type, file);
    }
  };

  const handleExpiryChange = (type: DocumentType, expiryDate: string) => {
    updateDocuments({ [type]: { expiryDate } });

    const document = documents[type];
    const file = document.file;

    if (!file && !document.fileName) {
      setErrors((previous) => ({
        ...previous,
        [type]: 'Please upload the required document.',
      }));

      return;
    }

    const validationError = file
      ? validateDocument(type, file, expiryDate)
      : isRegistrationDocumentValid({ ...document, expiryDate })
        ? ''
        : 'Expiry date must be a future date.';

    setErrors((previous) => ({
      ...previous,
      [type]: validationError || undefined,
    }));
  };

  const removeFile = (type: DocumentType) => {
    const documentName = type === 'cr' ? 'Company CR' : 'VAT Certificate';
    if (!window.confirm(`Remove ${documentName}?`)) return;

    updateDocuments({
      [type]: {
        file: null,
        fileName: undefined,
        fileSize: undefined,
        fileType: undefined,
        expiryDate: '',
      },
    });

    setErrors((previous) => ({
      ...previous,
      [type]: undefined,
    }));
  };

  const isDocumentValid = (type: DocumentType) => isRegistrationDocumentValid(documents[type]);

  const canContinue = isDocumentValid('cr') && isDocumentValid('vat');

  const handleContinue = () => {
    const crError = isRegistrationDocumentValid(documents.cr)
      ? ''
      : 'Company CR document and a future expiry date are required.';

    const vatError = isRegistrationDocumentValid(documents.vat)
      ? ''
      : 'VAT Certificate document and a future expiry date are required.';

    setErrors({
      cr: crError || undefined,
      vat: vatError || undefined,
    });

    if (crError || vatError) {
      return;
    }

    void continueRegistration(() => navigate('/register/locations'));
  };

  const handleBack = () => {
    navigate('/register/contact');
  };

  return (
    <div className="min-h-screen bg-[#f7f6f7] text-[#29252d]">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="border-b border-[#e4dfe5] bg-white">
        <div className="mx-auto flex min-h-[68px] max-w-[1440px] items-center px-6 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#5b2d7d] text-white">
              <span className="text-sm font-bold">AS</span>
            </div>

            <div className="leading-none">
              <div className="text-[20px] font-bold tracking-[-0.02em] text-[#5b2d7d]">
                AlSafwa Cement
              </div>

              <div className="mt-1 text-[11px] font-medium tracking-[0.08em] text-[#625c63]">
                CUSTOMER PORTAL REGISTRATION
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="mx-auto max-w-[1180px] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        {/* =================================================
            PROGRESS
        ================================================= */}

        <RegistrationStepper currentStep={2} />

        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <section className="mt-10 text-center">
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-[#29252d] sm:text-[34px]">
            Required Documents
          </h1>

          <p className="mx-auto mt-2 max-w-[680px] text-[16px] leading-6 text-[#625d63]">
            Please upload the mandatory documents below to complete your registration profile.
          </p>
        </section>

        {/* =================================================
            DOCUMENTS
        ================================================= */}

        <section className="mt-9 space-y-6">
          <DocumentCard
            title="Company CR"
            description="Commercial Registration Certificate."
            document={documents.cr}
            error={errors.cr}
            inputRef={crInputRef}
            onFileChange={(event) => handleFileInput('cr', event)}
            onDrop={(event) => handleDrop('cr', event)}
            onBrowse={() => crInputRef.current?.click()}
            onReplace={() => crInputRef.current?.click()}
            onRemove={() => removeFile('cr')}
            onExpiryChange={(value) => handleExpiryChange('cr', value)}
            isExpired={!!documents.cr.expiryDate && isExpiredOrToday(documents.cr.expiryDate)}
          />

          <DocumentCard
            title="VAT Certificate"
            description="Value Added Tax Registration Certificate."
            document={documents.vat}
            error={errors.vat}
            inputRef={vatInputRef}
            onFileChange={(event) => handleFileInput('vat', event)}
            onDrop={(event) => handleDrop('vat', event)}
            onBrowse={() => vatInputRef.current?.click()}
            onReplace={() => vatInputRef.current?.click()}
            onRemove={() => removeFile('vat')}
            onExpiryChange={(value) => handleExpiryChange('vat', value)}
            isExpired={!!documents.vat.expiryDate && isExpiredOrToday(documents.vat.expiryDate)}
          />
        </section>

        {/* =================================================
            ACTIONS
        ================================================= */}

        <div className="mt-8 border-t border-[#ddd7de] pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex min-h-[46px] w-fit items-center gap-2 rounded-md border border-[#8c858d] bg-white px-6 text-[15px] font-semibold text-[#625d63] transition hover:border-[#5b2d7d] hover:text-[#5b2d7d] focus:outline-none focus:ring-2 focus:ring-[#5b2d7d]/20"
            >
              <ArrowLeft size={18} />
              Back
            </button>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <SaveStatus />
              <SaveDraftButton className="min-h-[46px] rounded-md px-6 text-[15px] font-semibold text-[#625d63] transition hover:text-[#5b2d7d] disabled:cursor-not-allowed disabled:opacity-60">
                Save Draft
              </SaveDraftButton>

              <button
                type="button"
                onClick={handleContinue}
                disabled={!canContinue}
                className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-7 text-[15px] font-bold transition focus:outline-none focus:ring-2 focus:ring-[#5b2d7d]/30 focus:ring-offset-2 ${
                  canContinue
                    ? 'bg-[#5b2d7d] text-white hover:bg-[#4d256a]'
                    : 'cursor-not-allowed bg-[#b9a3c4] text-white/80'
                }`}
              >
                Continue to Delivery Locations
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {!canContinue && (
            <div className="mt-4 flex items-start justify-end gap-2 text-right text-[13px] text-[#716b72]">
              <Info size={16} className="mt-0.5 shrink-0" />

              <span>Upload both required documents and enter valid expiry dates to continue.</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   DOCUMENT CARD
============================================================ */

type DocumentCardProps = {
  title: string;
  description: string;
  document: DocumentData;
  error?: string | undefined;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onBrowse: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onExpiryChange: (value: string) => void;
  isExpired: boolean;
};

function DocumentCard({
  title,
  description,
  document,
  error,
  inputRef,
  onFileChange,
  onDrop,
  onBrowse,
  onReplace,
  onRemove,
  onExpiryChange,
  isExpired,
}: DocumentCardProps) {
  const hasFile = !!document.file || !!document.fileName;
  const fileName = document.file?.name ?? document.fileName ?? '';
  const fileSize = document.file?.size ?? document.fileSize;

  return (
    <article className="rounded-lg border border-[#dbcbdc] bg-white p-6 sm:p-7">
      {/* Header */}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[#29252d]">{title}</h2>

            <span className="rounded-[3px] bg-[#ffe0dc] px-2 py-1 text-[12px] font-bold text-[#c73527]">
              Required
            </span>
          </div>

          <p className="mt-1 text-[15px] text-[#6a646b]">{description}</p>
        </div>
      </div>

      {/* Hidden file input */}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={onFileChange}
      />

      {/* =====================================================
          EMPTY STATE
      ===================================================== */}

      {!hasFile && (
        <div
          onClick={onBrowse}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className="mt-5 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-[#dbcbdc] bg-[#fcfbfc] px-6 text-center transition hover:border-[#5b2d7d] hover:bg-[#faf7fb]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0e9f3] text-[#5b2d7d]">
            <Upload size={23} />
          </div>

          <p className="mt-3 text-[15px] font-semibold text-[#302c31]">
            Click to upload or drag and drop
          </p>

          <p className="mt-1 text-[13px] text-[#716b72]">PDF, JPG, or PNG (max. 10MB)</p>
        </div>
      )}

      {/* =====================================================
          UPLOADED FILE
      ===================================================== */}

      {hasFile && (
        <div className="mt-5 rounded-md border border-[#dbcbdc] bg-[#fcfbfc] p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            {/* File */}

            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#f0e9f3] text-[#5b2d7d]">
                <FileText size={23} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[#302c31]">{fileName}</p>

                {fileSize !== undefined && (
                  <p className="mt-1 text-[13px] text-[#716b72]">{formatFileSize(fileSize)}</p>
                )}
              </div>
            </div>

            {/* Expiry */}

            <div className="w-full lg:max-w-[310px]">
              <label className="mb-2 block text-[14px] font-semibold text-[#302c31]">
                Expiry Date
                <span className="ml-1 text-[#b42318]">*</span>
              </label>

              <div className="relative">
                <CalendarDays
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#716b72]"
                />

                <input
                  type="date"
                  value={document.expiryDate}
                  min={getTomorrowDate()}
                  onChange={(event) => onExpiryChange(event.target.value)}
                  className={`h-[46px] w-full rounded-md border bg-white pl-10 pr-3 text-[15px] outline-none transition ${
                    isExpired || error
                      ? 'border-[#b42318] focus:ring-2 focus:ring-[#b42318]/10'
                      : 'border-[#d9cbd9] focus:border-[#5b2d7d] focus:ring-2 focus:ring-[#5b2d7d]/10'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Error */}

          {error && (
            <div className="mt-4 flex items-start gap-2 text-[13px] font-medium text-[#b42318]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />

              <span>{error}</span>
            </div>
          )}

          {/* Valid */}

          {!error && document.expiryDate && !isExpired && (
            <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#087443]">
              <Check size={16} />

              <span>Document uploaded and expiry date is valid.</span>
            </div>
          )}

          {/* Actions */}

          <div className="mt-5 flex items-center gap-2 border-t border-[#e8e3e8] pt-4">
            <button
              type="button"
              onClick={onReplace}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold text-[#5b2d7d] transition hover:bg-[#f1ebf4]"
            >
              <RefreshCw size={15} />
              Replace
            </button>

            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold text-[#b42318] transition hover:bg-[#fff1f0]"
            >
              <Trash2 size={15} />
              Remove
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* ============================================================
   PROGRESS STEPPER
============================================================ */

function RegistrationStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto flex min-w-[850px] items-start justify-between px-8">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;

          return (
            <div key={step} className="relative flex flex-1 flex-col items-center">
              {/* Connector */}

              {index < steps.length - 1 && (
                <div
                  className={`absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[16px] h-[2px] ${
                    index < currentStep ? 'bg-[#008c6a]' : 'bg-[#ddd8de]'
                  }`}
                />
              )}

              {/* Step */}

              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[14px] font-bold ${
                  isCompleted
                    ? 'bg-[#008c6a] text-white'
                    : isActive
                      ? 'bg-[#5b2d7d] text-white'
                      : 'bg-[#e7e4e7] text-[#6a646b]'
                }`}
              >
                {isCompleted ? <Check size={17} strokeWidth={3} /> : index + 1}
              </div>

              {/* Label */}

              <span
                className={`mt-3 whitespace-nowrap text-[14px] font-semibold ${
                  isActive ? 'text-[#5b2d7d]' : isCompleted ? 'text-[#625d63]' : 'text-[#625d63]'
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTomorrowDate() {
  const tomorrow = new Date();

  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');

  const day = String(tomorrow.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
