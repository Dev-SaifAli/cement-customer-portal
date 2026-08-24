import { type ReactNode } from 'react';
import { BrandHeader } from './BrandHeader';
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
      <BrandHeader />

      {currentStep && <RegistrationProgress currentStep={currentStep} />}

      <main className="mx-auto max-w-[1025px] px-6 pb-10 pt-10">{children}</main>
    </div>
  );
}
