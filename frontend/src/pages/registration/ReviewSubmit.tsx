import { ArrowLeft, CheckCircle2, Pencil, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegistrationLayout } from '../../components/registration/RegistrationLayout';
import { useRegistration } from '../../context/RegistrationContext';
import { RegistrationServiceError } from '../../services/registrationService';

export default function ReviewSubmit() {
  const navigate = useNavigate();
  const { data, setCurrentStep, submitApplication } = useRegistration();
  const [submitError, setSubmitError] = useState('');
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => setCurrentStep(6), [setCurrentStep]);

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitErrors({});
    setIsSubmitting(true);
    try {
      const submitted = await submitApplication();
      navigate('/register/submitted', {
        state: { submittedApplication: submitted },
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit application.');
      if (error instanceof RegistrationServiceError) {
        setSubmitErrors(error.errors ?? {});
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RegistrationLayout currentStep={6}>
      <section className="rounded-xl border border-[#dacbdc] bg-white shadow-sm">
        <div className="px-8 pb-7 pt-8">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Review & Submit</h1>
          <p className="mt-2 text-[16px] leading-6 text-gray-600">
            Review the registration information before submitting the application.
          </p>
        </div>

        <div className="mx-8 border-t border-gray-200" />

        <div className="space-y-6 px-8 py-8">
          <SummarySection title="Company Information" editPath="/register/company">
            <SummaryItem label="Company Name" value={data.company.companyName} />
            <SummaryItem label="CR Number" value={data.company.crNumber} />
            <SummaryItem label="VAT Number" value={data.company.vatNumber} />
            <SummaryItem
              label="Address"
              value={`${data.company.streetAddress}, ${data.company.city}, ${data.company.region}, ${data.company.country} ${data.company.postalCode}`}
            />
          </SummarySection>

          <SummarySection title="Primary Contact" editPath="/register/contact">
            <SummaryItem label="Full Name" value={data.contact.fullName} />
            <SummaryItem label="Job Title" value={data.contact.jobTitle} />
            <SummaryItem label="Email" value={data.contact.email} />
            <SummaryItem label="Phone" value={data.contact.phone} />
          </SummarySection>

          <SummarySection title="Documents" editPath="/register/documents">
            <SummaryItem
              label="Company CR"
              value={`${data.documents.cr.file?.name ?? data.documents.cr.fileName ?? 'Not uploaded'} - Expiry: ${data.documents.cr.expiryDate}`}
            />
            <SummaryItem
              label="VAT Certificate"
              value={`${data.documents.vat.file?.name ?? data.documents.vat.fileName ?? 'Not uploaded'} - Expiry: ${data.documents.vat.expiryDate}`}
            />
          </SummarySection>

          <SummarySection title="Delivery Locations" editPath="/register/locations">
            <div className="space-y-3">
              {data.deliveryLocations.map((location) => (
                <div key={location.id} className="rounded-md border border-[#e5dfe5] p-4">
                  <div className="font-semibold text-[#292929]">{location.name}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {location.streetAddress}, {location.city}, {location.region}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {location.contactPerson} - {location.contactPhone}
                  </div>
                </div>
              ))}
            </div>
          </SummarySection>

          <SummarySection title="Customer Administrator" editPath="/register/admin">
            <SummaryItem label="Full Name" value={data.administrator.fullName} />
            <SummaryItem label="Job Title" value={data.administrator.jobTitle} />
            <SummaryItem label="Email" value={data.administrator.email} />
            <SummaryItem label="Phone" value={data.administrator.phone} />
            <SummaryItem label="Password" value="Hidden for security" />
          </SummarySection>
        </div>

        <div className="mx-8 border-t border-gray-200" />

        {submitError && (
          <div className="mx-8 mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <p>{submitError}</p>
            {Object.keys(submitErrors).length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 font-medium">
                {Object.entries(submitErrors).map(([field, message]) => (
                  <li key={field}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-8 py-6">
          <button
            type="button"
            onClick={() => navigate('/register/admin')}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-[#5b2a7a] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#492060] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
            <Send size={18} />
          </button>
        </div>
      </section>
    </RegistrationLayout>
  );
}

function SummarySection({
  children,
  editPath,
  title,
}: {
  children: React.ReactNode;
  editPath: string;
  title: string;
}) {
  const navigate = useNavigate();

  return (
    <section className="rounded-lg border border-[#e5dfe5] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={19} className="text-[#008c68]" />
          <h2 className="text-lg font-bold text-[#292929]">{title}</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate(editPath)}
          className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-[#5b2a7a] transition hover:bg-[#f5eef7]"
        >
          <Pencil size={15} />
          Edit
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-[#292929]">{value || '-'}</div>
    </div>
  );
}
