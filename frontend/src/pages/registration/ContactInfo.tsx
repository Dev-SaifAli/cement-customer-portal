import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SaveDraftButton } from '../../components/registration/SaveDraftButton';
import { SaveStatus } from '../../components/registration/SaveStatus';
import {
  formatSaudiPhoneNumber,
  getSaudiPhoneDigitsRemaining,
  getSaudiPhoneLocalDigits,
  isSaudiPhoneNumber,
  useRegistration,
} from '../../context/RegistrationContext';

export interface ContactInfoData {
  fullName: string;
  jobTitle: string;
  workEmail: string;
  phoneNumber: string;
}

interface ContactInfoProps {
  onBack?: () => void;
  onContinue?: (data: ContactInfoData) => void;
}

const ContactInfo: React.FC<ContactInfoProps> = ({ onBack, onContinue }) => {
  const navigate = useNavigate();
  const { continueRegistration, data, setCurrentStep, updateContact } = useRegistration();
  const form: ContactInfoData = {
    fullName: data.contact.fullName,
    jobTitle: data.contact.jobTitle,
    workEmail: data.contact.email,
    phoneNumber: data.contact.phone,
  };

  const [errors, setErrors] = useState<Partial<Record<keyof ContactInfoData, string>>>({});

  useEffect(() => setCurrentStep(2), [setCurrentStep]);

  const updateField = (field: keyof ContactInfoData, value: string) => {
    if (field === 'workEmail') updateContact({ email: value });
    else if (field === 'phoneNumber') updateContact({ phone: value });
    else updateContact({ [field]: value });

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof ContactInfoData, string>> = {};

    if (!form.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!form.jobTitle.trim()) {
      newErrors.jobTitle = 'Job title is required';
    }

    if (!form.workEmail.trim()) {
      newErrors.workEmail = 'Work email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail)) {
      newErrors.workEmail = 'Enter a valid work email';
    }

    if (!form.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!isSaudiPhoneNumber(form.phoneNumber)) {
      newErrors.phoneNumber = 'Enter a valid Saudi mobile number';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;

    void continueRegistration(() => {
      if (onContinue) onContinue(form);
      else navigate('/register/documents');
    });
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    navigate('/register/company');
  };

  const inputClass = (field: keyof ContactInfoData) =>
    `h-12 w-full rounded-md border bg-white px-4 text-[15px] text-gray-900 outline-none transition ${
      errors[field]
        ? 'border-red-500 focus:ring-2 focus:ring-red-100'
        : 'border-[#d9c9df] focus:border-[#5b2a7a] focus:ring-2 focus:ring-[#5b2a7a]/10'
    }`;

  const phoneDigitsRemaining = getSaudiPhoneDigitsRemaining(form.phoneNumber);

  return (
    <div className="min-h-screen bg-[#f8f7f7] text-[#292929]">
      {/* Header */}
      <header className="h-[68px] border-b border-[#e4dfe5] bg-white">
        <div className="mx-auto flex h-full max-w-[1280px] items-center px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#5b2a7a] text-white">
              <span className="text-lg font-bold">A</span>
            </div>

            <div>
              <div className="text-[20px] font-bold leading-none text-[#5b2a7a]">
                AlSafwa Cement
              </div>

              <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-gray-500">
                Customer Portal Registration
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <RegistrationProgress currentStep={2} />

      {/* Main */}
      <main className="mx-auto max-w-[1025px] px-6 pb-10 pt-10">
        <section className="rounded-xl border border-[#dacbdc] bg-white shadow-sm">
          {/* Heading */}
          <div className="px-8 pb-7 pt-8">
            <h1 className="text-[28px] font-bold tracking-[-0.02em]">
              Primary Contact Information
            </h1>

            <p className="mt-2 text-[16px] leading-6 text-gray-600">
              This person will be the main contact for the registration application and future
              portal communications.
            </p>
          </div>

          <div className="mx-8 border-t border-gray-200" />

          {/* Form */}
          <div className="px-8 py-8">
            <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
              {/* Full Name */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Full Name <Required />
                </label>

                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="Enter full name"
                  className={inputClass('fullName')}
                />

                {errors.fullName && <ErrorMessage message={errors.fullName} />}
              </div>

              {/* Job Title */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Job Title <Required />
                </label>

                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => updateField('jobTitle', e.target.value)}
                  placeholder="e.g. Procurement Manager"
                  className={inputClass('jobTitle')}
                />

                {errors.jobTitle && <ErrorMessage message={errors.jobTitle} />}
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Work Email <Required />
                </label>

                <input
                  type="email"
                  value={form.workEmail}
                  onChange={(e) => updateField('workEmail', e.target.value)}
                  placeholder="email@company.com"
                  className={inputClass('workEmail')}
                />

                {errors.workEmail && <ErrorMessage message={errors.workEmail} />}
              </div>

              {/* Phone */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Phone Number <Required />
                </label>

                <div
                  className={`flex h-12 overflow-hidden rounded-md border bg-white ${
                    errors.phoneNumber ? 'border-red-500' : 'border-[#d9c9df]'
                  }`}
                >
                  <div className="flex items-center border-r border-[#d9c9df] bg-[#f8f7f7] px-4 text-[15px] text-gray-600">
                    +966
                  </div>

                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={formatSaudiPhoneNumber(form.phoneNumber)}
                    onChange={(e) =>
                      updateField('phoneNumber', getSaudiPhoneLocalDigits(e.target.value))
                    }
                    placeholder="5XX XXX XXX"
                    className="min-w-0 flex-1 px-4 text-[15px] outline-none"
                  />
                </div>

                {errors.phoneNumber ? (
                  <ErrorMessage message={errors.phoneNumber} />
                ) : (
                  <PhoneHelper digitsRemaining={phoneDigitsRemaining} value={form.phoneNumber} />
                )}
              </div>
            </div>

            {/* Information */}
            <div className="mt-7 flex items-start gap-3 rounded-md border border-[#ddd0e2] bg-[#faf8fb] px-4 py-4">
              <Info size={19} className="mt-0.5 shrink-0 text-[#5b2a7a]" />

              <p className="text-sm leading-5 text-gray-600">
                Please provide a business email address and active phone number. These details may
                be used by our Sales Team during the verification process.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mx-8 border-t border-gray-200" />

          <div className="flex items-center justify-between px-8 py-6">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              <ArrowLeft size={18} />
              Go Back
            </button>

            <div className="flex items-center gap-4">
              <SaveStatus />
              <SaveDraftButton className="rounded-md border border-gray-400 bg-white px-6 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
                Save Draft
              </SaveDraftButton>

              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2 rounded-md bg-[#5b2a7a] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#492060] focus:outline-none focus:ring-2 focus:ring-[#5b2a7a]/30"
              >
                Continue to Documents
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

/* ---------------- Progress ---------------- */

interface RegistrationProgressProps {
  currentStep: number;
}

const steps = [
  'Company Info',
  'Contact Info',
  'Documents',
  'Delivery Locations',
  'Customer Admin',
  'Review & Submit',
];

const RegistrationProgress: React.FC<RegistrationProgressProps> = ({ currentStep }) => {
  return (
    <div className="mx-auto max-w-[1100px] px-6 pt-9">
      <div className="relative flex items-start justify-between">
        {/* Background line */}
        <div className="absolute left-[8%] right-[8%] top-[17px] h-[2px] bg-[#e3dfe4]" />

        {/* Completed line */}
        <div
          className="absolute left-[8%] top-[17px] h-[2px] bg-[#008c68] transition-all"
          style={{
            width: currentStep <= 1 ? '0%' : `${((currentStep - 1) / (steps.length - 1)) * 84}%`,
          }}
        />

        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const completed = stepNumber < currentStep;
          const active = stepNumber === currentStep;

          return (
            <div key={step} className="relative z-10 flex w-[120px] flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold ${
                  completed
                    ? 'bg-[#008c68] text-white'
                    : active
                      ? 'bg-[#5b2a7a] text-white'
                      : 'bg-[#e7e4e7] text-gray-600'
                }`}
              >
                {completed ? '✓' : stepNumber}
              </div>

              <span
                className={`mt-3 whitespace-nowrap text-xs font-semibold sm:text-sm ${
                  active ? 'text-[#5b2a7a]' : completed ? 'text-gray-600' : 'text-gray-500'
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
};

const Required = () => <span className="ml-1 text-red-500">*</span>;

const ErrorMessage = ({ message }: { message: string }) => (
  <p className="mt-1.5 text-xs font-medium text-red-600">{message}</p>
);

const PhoneHelper = ({ digitsRemaining, value }: { digitsRemaining: number; value: string }) => {
  const hasInvalidPrefix = digitsRemaining === 0 && !isSaudiPhoneNumber(value);

  return (
    <p
      className={`mt-1.5 text-xs font-medium ${
        hasInvalidPrefix
          ? 'text-red-600'
          : digitsRemaining === 0
            ? 'text-[#008c68]'
            : 'text-gray-500'
      }`}
    >
      {hasInvalidPrefix
        ? 'Saudi mobile number must start with 5.'
        : digitsRemaining === 0
          ? 'Phone number complete.'
          : `${digitsRemaining} digit${digitsRemaining === 1 ? '' : 's'} remaining after +966.`}
    </p>
  );
};

export default ContactInfo;
