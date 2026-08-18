import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RegistrationLayout } from '../../components/registration/RegistrationLayout';
import {
  getStoredSubmittedApplication,
  useRegistration,
  type SubmittedApplication,
} from '../../context/RegistrationContext';

export default function ApplicationSubmitted() {
  const navigate = useNavigate();
  const location = useLocation();
  const { submittedApplication } = useRegistration();
  const locationSubmittedApplication = isSubmittedApplicationLocationState(location.state)
    ? location.state.submittedApplication
    : null;
  const application =
    submittedApplication ?? locationSubmittedApplication ?? getStoredSubmittedApplication();
  const reference = application?.reference ?? '';
  const statusLabel = application?.statusLabel ?? 'Pending Sales Review';

  return (
    <RegistrationLayout>
      <section className="mx-auto max-w-[620px] rounded-xl border border-[#dacbdc] bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#e9f7f1] text-[#008c68]">
          <CheckCircle2 size={36} />
        </div>

        <h1 className="mt-6 text-[28px] font-bold tracking-[-0.02em]">Application Submitted</h1>

        <p className="mx-auto mt-3 max-w-[480px] text-[16px] leading-6 text-gray-600">
          Your registration application has been successfully submitted for Sales Team review.
        </p>

        <div className="mt-7 grid grid-cols-1 gap-4 rounded-lg border border-[#e5dfe5] p-5 text-left">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">
              Application Reference
            </div>
            <div className="mt-1 text-lg font-bold text-[#292929]">
              {reference || 'Reference unavailable'}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">
              Status
            </div>
            <div className="mt-1 text-lg font-bold text-[#5b2a7a]">{statusLabel}</div>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-[500px] text-sm leading-6 text-gray-600">
          Your application has been received and is currently being reviewed by our Sales Team. You
          will be notified when your application has been reviewed.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate('/register/status')}
            disabled={!reference}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#5b2a7a] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#492060] disabled:cursor-not-allowed disabled:opacity-60"
          >
            View Application Status
            <ArrowRight size={18} />
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center justify-center rounded-md border border-[#8c858d] bg-white px-7 py-3 text-sm font-semibold text-[#625d63] transition hover:border-[#5b2d7d] hover:text-[#5b2d7d]"
          >
            Back to Login
          </button>
        </div>
      </section>
    </RegistrationLayout>
  );
}

function isSubmittedApplicationLocationState(
  state: unknown,
): state is { submittedApplication: SubmittedApplication } {
  return Boolean(
    state &&
    typeof state === 'object' &&
    'submittedApplication' in state &&
    typeof (state as { submittedApplication?: { reference?: unknown } }).submittedApplication
      ?.reference === 'string',
  );
}
