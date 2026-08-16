import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RegistrationLayout } from '../../components/registration/RegistrationLayout';

export default function ApplicationSubmitted() {
  const navigate = useNavigate();

  return (
    <RegistrationLayout>
      <section className="mx-auto max-w-[620px] rounded-xl border border-[#dacbdc] bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#e9f7f1] text-[#008c68]">
          <CheckCircle2 size={36} />
        </div>

        <h1 className="mt-6 text-[28px] font-bold tracking-[-0.02em]">Application Submitted</h1>

        <p className="mx-auto mt-3 max-w-[480px] text-[16px] leading-6 text-gray-600">
          Your registration application has been submitted for Sales Team review. You will be
          contacted after the application has been verified.
        </p>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-[#5b2a7a] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#492060]"
        >
          Back to Login
          <ArrowRight size={18} />
        </button>
      </section>
    </RegistrationLayout>
  );
}
