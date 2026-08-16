import { Check } from 'lucide-react';

const steps = [
  'Company Info',
  'Contact Info',
  'Documents',
  'Delivery Locations',
  'Customer Admin',
  'Review & Submit',
];

export function RegistrationProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="mx-auto max-w-[1100px] px-6 pt-9">
      <div className="relative flex items-start justify-between">
        <div className="absolute left-[8%] right-[8%] top-[17px] h-[2px] bg-[#e3dfe4]" />
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
                {completed ? <Check size={17} strokeWidth={3} /> : stepNumber}
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
}
