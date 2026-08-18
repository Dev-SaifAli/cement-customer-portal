import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RegistrationLayout } from '../../components/registration/RegistrationLayout';
import { SaveDraftButton } from '../../components/registration/SaveDraftButton';
import { SaveStatus } from '../../components/registration/SaveStatus';
import {
  emailPattern,
  formatSaudiPhoneNumber,
  getSaudiPhoneDigitsRemaining,
  getSaudiPhoneLocalDigits,
  isSaudiPhoneNumber,
  useRegistration,
  type AdministratorData,
} from '../../context/RegistrationContext';

type AdminErrors = Partial<Record<keyof AdministratorData, string>>;

export default function CustomerAdmin() {
  const navigate = useNavigate();
  const { continueRegistration, data, setCurrentStep, updateAdministrator } = useRegistration();
  const [errors, setErrors] = useState<AdminErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const admin = data.administrator;

  useEffect(() => setCurrentStep(5), [setCurrentStep]);

  const updateField = (field: keyof AdministratorData, value: string) => {
    updateAdministrator({ [field]: value });
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const next: AdminErrors = {};
    if (!admin.fullName.trim()) next.fullName = 'Full name is required.';
    if (!admin.jobTitle.trim()) next.jobTitle = 'Job title is required.';
    if (!admin.email.trim()) next.email = 'Email is required.';
    else if (!emailPattern.test(admin.email.trim())) next.email = 'Enter a valid email address.';
    if (!admin.phone.trim()) next.phone = 'Phone is required.';
    else if (!isSaudiPhoneNumber(admin.phone)) {
      next.phone = 'Enter a valid Saudi mobile number.';
    }
    if (!admin.password) next.password = 'Password is required.';
    else if (admin.password.length < 8) next.password = 'Password must be at least 8 characters.';
    else if (
      !/[A-Z]/.test(admin.password) ||
      !/[a-z]/.test(admin.password) ||
      !/\d/.test(admin.password)
    )
      next.password = 'Password must include uppercase, lowercase, and a number.';
    if (!admin.confirmPassword) next.confirmPassword = 'Confirm password is required.';
    else if (admin.confirmPassword !== admin.password)
      next.confirmPassword = 'Passwords must match.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    void continueRegistration(() => navigate('/register/review'));
  };

  return (
    <RegistrationLayout currentStep={5}>
      <section className="rounded-xl border border-[#dacbdc] bg-white shadow-sm">
        <div className="px-8 pb-7 pt-8">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 text-[#5b2a7a]" size={34} />
            <div>
              <h1 className="text-[28px] font-bold tracking-[-0.02em]">Customer Administrator</h1>
              <p className="mt-2 text-[16px] leading-6 text-gray-600">
                Create the first administrator who will manage your organization's customer portal
                users and access.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-8 border-t border-gray-200" />

        <div className="grid grid-cols-1 gap-6 px-8 py-8 md:grid-cols-2">
          <Field
            label="Full Name"
            value={admin.fullName}
            error={errors.fullName}
            onChange={(value) => updateField('fullName', value)}
          />
          <Field
            label="Job Title"
            value={admin.jobTitle}
            error={errors.jobTitle}
            onChange={(value) => updateField('jobTitle', value)}
          />
          <Field
            label="Email"
            type="email"
            value={admin.email}
            error={errors.email}
            onChange={(value) => updateField('email', value)}
          />
          <Field
            label="Phone"
            type="tel"
            isPhone
            value={admin.phone}
            error={errors.phone}
            onChange={(value) => updateField('phone', value)}
          />
          <Field
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={admin.password}
            error={errors.password}
            onChange={(value) => updateField('password', value)}
            action={
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="text-gray-500 hover:text-[#5b2a7a]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <Field
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={admin.confirmPassword}
            error={errors.confirmPassword}
            onChange={(value) => updateField('confirmPassword', value)}
            action={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="text-gray-500 hover:text-[#5b2a7a]"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
        </div>

        <div className="mx-8 border-t border-gray-200" />

        <div className="flex items-center justify-between px-8 py-6">
          <button
            type="button"
            onClick={() => navigate('/register/locations')}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <div className="flex items-center gap-4">
            <SaveStatus />
            <SaveDraftButton className="rounded-md border border-gray-400 bg-white px-6 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
              Save Draft
            </SaveDraftButton>
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center gap-2 rounded-md bg-[#5b2a7a] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#492060]"
            >
              Continue to Review
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </RegistrationLayout>
  );
}

function Field({
  action,
  error,
  label,
  onChange,
  isPhone,
  type = 'text',
  value,
}: {
  action?: ReactNode;
  error?: string | undefined;
  isPhone?: boolean | undefined;
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  const digitsRemaining = isPhone ? getSaudiPhoneDigitsRemaining(value) : 0;
  const hasInvalidPhonePrefix = Boolean(
    isPhone && digitsRemaining === 0 && !isSaudiPhoneNumber(value),
  );

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">
        {label} <span className="text-red-500">*</span>
      </label>
      <div
        className={`relative flex h-12 overflow-hidden rounded-md border bg-white transition ${
          error
            ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-100'
            : 'border-[#d9c9df] focus-within:border-[#5b2a7a] focus-within:ring-2 focus-within:ring-[#5b2a7a]/10'
        }`}
      >
        {isPhone && (
          <div className="flex items-center border-r border-[#d9c9df] bg-[#f8f7f7] px-4 text-[15px] text-gray-600">
            +966
          </div>
        )}

        <input
          type={type}
          inputMode={isPhone ? 'numeric' : undefined}
          maxLength={isPhone ? 11 : undefined}
          value={isPhone ? formatSaudiPhoneNumber(value) : value}
          onChange={(event) =>
            onChange(isPhone ? getSaudiPhoneLocalDigits(event.target.value) : event.target.value)
          }
          placeholder={isPhone ? '5XX XXX XXX' : undefined}
          className={`min-w-0 flex-1 bg-white px-4 text-[15px] outline-none ${
            action ? 'pr-11' : ''
          }`}
        />
        {action && <div className="absolute right-4 top-1/2 -translate-y-1/2">{action}</div>}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
      {isPhone && !error && (
        <p
          className={`mt-1.5 text-xs font-medium ${
            hasInvalidPhonePrefix
              ? 'text-red-600'
              : digitsRemaining === 0
                ? 'text-[#008c68]'
                : 'text-gray-500'
          }`}
        >
          {hasInvalidPhonePrefix
            ? 'Saudi mobile number must start with 5.'
            : digitsRemaining === 0
              ? 'Phone number complete.'
              : `${digitsRemaining} digit${digitsRemaining === 1 ? '' : 's'} remaining after +966.`}
        </p>
      )}
    </div>
  );
}
