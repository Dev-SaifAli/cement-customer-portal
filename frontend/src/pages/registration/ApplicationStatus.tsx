import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Check, Circle, Clock, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRegistration } from '../../context/RegistrationContext';
import {
  lookupApplicationStatus,
  type ApplicationStatusDetails,
  type ApplicationTimelineItem,
} from '../../services/applicationService';
import { RegistrationLayout } from '../../components/registration/RegistrationLayout';

export default function ApplicationStatus() {
  const navigate = useNavigate();
  const { data, loadApplicationForUpdate, submittedApplication } = useRegistration();
  const [reference, setReference] = useState(submittedApplication?.reference ?? '');
  const [email, setEmail] = useState(data.administrator.email || data.contact.email);
  const [application, setApplication] = useState<ApplicationStatusDetails | null>(
    submittedApplication
      ? {
          ...submittedApplication,
          timeline: createDefaultTimeline(),
        }
      : null,
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    if (!submittedApplication || !email) return;

    const loadSubmittedApplicationStatus = async () => {
      setError('');
      setLoading(true);
      try {
        const result = await lookupApplicationStatus({
          reference: submittedApplication.reference,
          email,
        });
        setApplication(result);
        setReference(result.reference);
      } catch {
        // Keep the submitted confirmation status visible if the API is unavailable.
      } finally {
        setLoading(false);
      }
    };

    void loadSubmittedApplicationStatus();
  }, [email, submittedApplication]);

  const handleLookup = async ({
    email: lookupEmail = email,
    reference: lookupReference = reference,
  } = {}) => {
    setError('');

    if (!lookupReference.trim() || !lookupEmail.trim()) {
      setError('Application reference and registered email are required.');
      return;
    }

    setLoading(true);
    try {
      const result = await lookupApplicationStatus({
        reference: lookupReference.trim(),
        email: lookupEmail.trim(),
      });
      setApplication(result);
      setReference(result.reference);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : 'Unable to retrieve application status.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleLookup();
  };

  const handleUpdateApplication = async () => {
    if (!application?.id) {
      setError('Application could not be opened for updates. Please check status again.');
      return;
    }

    setError('');
    setUpdateLoading(true);
    try {
      await loadApplicationForUpdate(application.id);
      navigate('/register/company');
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to open this application for updates.',
      );
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <RegistrationLayout>
      <div className="mx-auto max-w-[760px] space-y-6">
        <section className="rounded-xl border border-[#dacbdc] bg-white p-8 shadow-sm">
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#292929]">
            Application Status
          </h1>

          <form className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold">Application Reference</label>
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value.toUpperCase())}
                placeholder="Enter application reference"
                className="h-12 w-full rounded-md border border-[#d9c9df] bg-white px-4 text-[15px] outline-none transition focus:border-[#5b2a7a] focus:ring-2 focus:ring-[#5b2a7a]/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Registered Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter registered email"
                className="h-12 w-full rounded-md border border-[#d9c9df] bg-white px-4 text-[15px] outline-none transition focus:border-[#5b2a7a] focus:ring-2 focus:ring-[#5b2a7a]/10"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#5b2a7a] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#492060] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Search size={18} />
                {loading ? 'Checking...' : 'Check Status'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </section>

        {application && (
          <section className="rounded-xl border border-[#dacbdc] bg-white p-8 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StatusItem label="Application Reference" value={application.reference} />
              <StatusItem label="Current Status" value={application.statusLabel} />
            </div>

            {application.canUpdateApplication && (
              <div className="mt-6 rounded-md border border-orange-200 bg-orange-50 px-5 py-4">
                <div className="text-sm font-bold text-orange-800">Changes Requested</div>
                <p className="mt-2 text-sm leading-6 text-orange-800">
                  {application.changeReason ||
                    'Sales Team requested updates to your application. Please review and update the required information.'}
                </p>
                <button
                  type="button"
                  onClick={handleUpdateApplication}
                  disabled={updateLoading}
                  className="mt-4 inline-flex items-center justify-center rounded-md bg-[#5b2a7a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#492060] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateLoading ? 'Opening Application...' : 'Update Application'}
                </button>
              </div>
            )}

            <div className="mt-8">
              <h2 className="text-lg font-bold text-[#292929]">Timeline</h2>
              <div className="mt-5 space-y-5">
                {application.timeline.map((item) => (
                  <TimelineItem key={item.key} item={item} />
                ))}
              </div>
            </div>

            <p className="mt-8 rounded-md border border-[#ddd0e2] bg-[#faf8fb] px-5 py-4 text-sm leading-6 text-gray-600">
              {getStatusMessage(application)}
            </p>
          </section>
        )}
      </div>
    </RegistrationLayout>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e5dfe5] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">{label}</div>
      <div className="mt-1 text-base font-bold text-[#292929]">{value}</div>
    </div>
  );
}

function TimelineItem({ item }: { item: ApplicationTimelineItem }) {
  const tone =
    item.status === 'completed'
      ? 'text-[#008c68]'
      : item.status === 'current'
        ? 'text-[#5b2a7a]'
        : 'text-gray-400';
  const Icon = item.status === 'completed' ? Check : item.status === 'current' ? Clock : Circle;

  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${tone}`}>
        <Icon size={20} />
      </div>
      <div className={`font-semibold ${tone}`}>{item.label}</div>
    </div>
  );
}

function createDefaultTimeline(): ApplicationTimelineItem[] {
  return [
    { key: 'submitted', label: 'Application Submitted', status: 'completed' },
    { key: 'review', label: 'Sales Team Review', status: 'current' },
    { key: 'activation', label: 'Account Activation', status: 'pending' },
  ];
}

function getStatusMessage(application: ApplicationStatusDetails) {
  if (application.status === 'APPROVED') {
    return 'Your application has been approved. Your customer portal account is being prepared for activation.';
  }

  if (application.status === 'ACTIVATED') {
    return 'Your account has been activated. You can now access the AlSafwa Cement Customer Portal once customer login is enabled.';
  }

  if (application.status === 'CHANGES_REQUIRED') {
    return 'Sales Team requested updates to your application. Please update and resubmit your application.';
  }

  if (application.status === 'REJECTED') {
    return 'Your application was rejected by the Sales Team. Please contact AlSafwa Cement for more information.';
  }

  return 'Your application has been received and is currently being reviewed by our Sales Team.';
}
