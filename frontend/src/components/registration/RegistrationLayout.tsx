import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { RegistrationProgress } from './RegistrationProgress';

export function RegistrationLayout({
  children,
  currentStep,
}: {
  children: ReactNode;
  currentStep?: number;
}) {
  return (
    <div className="min-h-screen bg-[#f8f7f7] text-[#292929]">
      <header className="h-[68px] border-b border-[#e4dfe5] bg-white">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-6">
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

          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#625d63] transition hover:text-[#5b2d7d]"
          >
            <X size={18} />
            Exit
          </button>
        </div>
      </header>

      {currentStep && <RegistrationProgress currentStep={currentStep} />}

      <main className="mx-auto max-w-[1025px] px-6 pb-10 pt-10">{children}</main>
    </div>
  );
}
