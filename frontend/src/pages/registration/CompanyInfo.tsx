import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrandHeader } from '../../components/registration/BrandHeader';
import { SaveDraftButton } from '../../components/registration/SaveDraftButton';
import { SaveStatus } from '../../components/registration/SaveStatus';
import { useRegistration, type CompanyInfoData } from '../../context/RegistrationContext';

interface CompanyInfoProps {
  onBack?: () => void;
  onContinue?: (data: CompanyInfoData) => void;
}

const regions = [
  'Makkah Province',
  'Riyadh Province',
  'Madinah Province',
  'Eastern Province',
  'Asir Province',
  'Jazan Province',
  'Tabuk Province',
  'Other',
];

const CompanyInfo: React.FC<CompanyInfoProps> = ({ onBack, onContinue }) => {
  const navigate = useNavigate();
  const { continueRegistration, data, setCurrentStep, updateCompany } = useRegistration();
  const form = data.company;

  const [errors, setErrors] = useState<Partial<Record<keyof CompanyInfoData, string>>>({});

  useEffect(() => setCurrentStep(1), [setCurrentStep]);

  const updateField = (field: keyof CompanyInfoData, value: string) => {
    updateCompany({ [field]: value });

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof CompanyInfoData, string>> = {};

    if (!form.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (!form.crNumber.trim()) {
      newErrors.crNumber = 'CR number is required';
    } else if (!/^\d{10}$/.test(form.crNumber)) {
      newErrors.crNumber = 'CR number must contain 10 digits';
    }

    if (!form.vatNumber.trim()) {
      newErrors.vatNumber = 'VAT number is required';
    } else if (!/^\d{15}$/.test(form.vatNumber)) {
      newErrors.vatNumber = 'VAT number must contain 15 digits';
    }

    if (!form.streetAddress.trim()) {
      newErrors.streetAddress = 'Street address is required';
    }

    if (!form.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!form.region) {
      newErrors.region = 'Please select a region';
    }

    if (!form.country) {
      newErrors.country = 'Country is required';
    }

    if (!form.postalCode.trim()) {
      newErrors.postalCode = 'Postal code is required';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;

    void continueRegistration(() => {
      if (onContinue) onContinue(form);
      else navigate('/register/contact');
    });
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    navigate('/register');
  };

  const inputClass = (field: keyof CompanyInfoData) =>
    `w-full h-12 rounded-md border bg-white px-4 text-[15px] text-gray-900 outline-none transition
    ${
      errors[field]
        ? 'border-red-500 focus:ring-2 focus:ring-red-100'
        : 'border-[#d9c9df] focus:border-[#5b2a7a] focus:ring-2 focus:ring-[#5b2a7a]/10'
    }`;

  return (
    <div className="min-h-screen bg-[#f8f7f7] text-[#292929]">
      {/* Header */}
      <BrandHeader />

      {/* Progress */}
      <div className="mx-auto max-w-[1100px] px-6 pt-9">
        <div className="relative flex items-start justify-between">
          {/* Progress line */}
          <div className="absolute left-[8%] right-[8%] top-[17px] h-[2px] bg-[#e3dfe4]" />

          <div className="absolute left-[8%] top-[17px] h-[2px] w-[0%] bg-[#5b2a7a]" />

          <ProgressStep number="1" label="Company Info" active />

          <ProgressStep number="2" label="Contact Info" />

          <ProgressStep number="3" label="Documents" />

          <ProgressStep number="4" label="Delivery Locations" />

          <ProgressStep number="5" label="Customer Admin" />

          <ProgressStep number="6" label="Review & Submit" />
        </div>
      </div>

      {/* Main */}
      <main className="mx-auto max-w-[1025px] px-6 pb-10 pt-10">
        <section className="rounded-xl border border-[#dacbdc] bg-white shadow-sm">
          {/* Heading */}
          <div className="px-8 pb-7 pt-8">
            <h1 className="text-[28px] font-bold tracking-[-0.02em]">Company Information</h1>

            <p className="mt-2 text-[16px] leading-6 text-gray-600">
              Please provide your official company details exactly as they appear on your Commercial
              Registration certificate.
            </p>
          </div>

          <div className="mx-8 border-t border-gray-200" />

          {/* Form */}
          <div className="space-y-6 px-8 py-7">
            {/* Company name */}
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Company Name <Required />
              </label>

              <input
                type="text"
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                placeholder="e.g., Arabian Construction Co. Ltd."
                className={inputClass('companyName')}
              />

              {errors.companyName && <ErrorMessage message={errors.companyName} />}
            </div>

            {/* CR + VAT */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Company CR Number <Required />
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.crNumber}
                  onChange={(e) => updateField('crNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit number"
                  className={inputClass('crNumber')}
                />

                {errors.crNumber && <ErrorMessage message={errors.crNumber} />}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  VAT Number <Required />
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={15}
                  value={form.vatNumber}
                  onChange={(e) => updateField('vatNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="15-digit number"
                  className={inputClass('vatNumber')}
                />

                {errors.vatNumber && <ErrorMessage message={errors.vatNumber} />}
              </div>
            </div>

            {/* Address heading */}
            <div className="pt-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-gray-600">
                Registered Address
              </h2>
            </div>

            {/* Street */}
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Street Address <Required />
              </label>

              <input
                type="text"
                value={form.streetAddress}
                onChange={(e) => updateField('streetAddress', e.target.value)}
                placeholder="Building number, Street name, District"
                className={inputClass('streetAddress')}
              />

              {errors.streetAddress && <ErrorMessage message={errors.streetAddress} />}
            </div>

            {/* City + Region */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  City <Required />
                </label>

                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="e.g., Jeddah"
                  className={inputClass('city')}
                />

                {errors.city && <ErrorMessage message={errors.city} />}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Region / Province <Required />
                </label>

                <div className="relative">
                  <select
                    value={form.region}
                    onChange={(e) => updateField('region', e.target.value)}
                    className={`${inputClass('region')} appearance-none pr-10 ${
                      !form.region ? 'text-gray-400' : ''
                    }`}
                  >
                    <option value="">Select Region</option>

                    {regions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={19}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>

                {errors.region && <ErrorMessage message={errors.region} />}
              </div>
            </div>

            {/* Country + Postal */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Country <Required />
                </label>

                <div className="relative">
                  <select
                    value={form.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    className={`${inputClass('country')} appearance-none pr-10`}
                  >
                    <option value="Saudi Arabia">Saudi Arabia</option>
                  </select>

                  <ChevronDown
                    size={19}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Postal Code <Required />
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={form.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value.replace(/\D/g, ''))}
                  placeholder="5-digit code"
                  className={inputClass('postalCode')}
                />

                {errors.postalCode && <ErrorMessage message={errors.postalCode} />}
              </div>
            </div>
          </div>

          {/* Footer actions */}
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
                Continue
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* Information message */}
        <div className="mt-6 flex items-start gap-3 rounded-md border border-[#a8d8f5] bg-[#eef8ff] px-5 py-4 text-sm text-gray-700">
          <Info size={20} className="mt-0.5 shrink-0 text-[#1684c4]" />

          <p>
            Ensure your CR Number and VAT Number exactly match your official documents. These will
            be verified before account activation.
          </p>
        </div>
      </main>
    </div>
  );
};

interface ProgressStepProps {
  number: string;
  label: string;
  active?: boolean;
}

const ProgressStep: React.FC<ProgressStepProps> = ({ number, label, active }) => {
  return (
    <div className="relative z-10 flex w-[120px] flex-col items-center">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold ${
          active ? 'bg-[#5b2a7a] text-white' : 'bg-[#e7e4e7] text-gray-600'
        }`}
      >
        {number}
      </div>

      <span
        className={`mt-3 whitespace-nowrap text-xs font-semibold sm:text-sm ${
          active ? 'text-[#5b2a7a]' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
};

const Required = () => <span className="ml-1 text-red-500">*</span>;

const ErrorMessage = ({ message }: { message: string }) => (
  <p className="mt-1.5 text-xs font-medium text-red-600">{message}</p>
);

export default CompanyInfo;
