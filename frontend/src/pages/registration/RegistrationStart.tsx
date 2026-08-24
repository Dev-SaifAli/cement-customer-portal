import {
  Building2,
  FileText,
  MapPin,
  ShieldCheck,
  ClipboardCheck,
  Info,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import alsafwaPlantImage from '../../assets/registration/alsafwa-plant.jpg';
import { SaveStatus } from '../../components/registration/SaveStatus';
import { useRegistration } from '../../context/RegistrationContext';
import './RegistrationStart.css';

interface RegistrationStartProps {
  onStart?: () => void;
}

const registrationSteps = [
  {
    icon: Building2,
    title: 'Company registration',
    description: 'Basic corporate details and CR number.',
  },
  {
    icon: FileText,
    title: 'Required document submission',
    description: 'Upload CR, VAT certificates, and authorization letters.',
  },
  {
    icon: MapPin,
    title: 'Delivery locations',
    description: 'Specify primary operational sites and plants.',
  },
  {
    icon: ShieldCheck,
    title: 'Customer administrator',
    description: 'Appoint the main contact for account management.',
  },
  {
    icon: ClipboardCheck,
    title: 'Review and submission',
    description: 'Final check of all provided information.',
  },
];

export default function RegistrationStart({ onStart }: RegistrationStartProps) {
  const navigate = useNavigate();
  const { currentStep, isLoadingDraft, resetRegistration, saveStatus, submittedApplication } =
    useRegistration();

  const handleStart = () => {
    if (onStart) onStart();
    else if (submittedApplication) {
      resetRegistration();
      navigate('/register/company');
    } else navigate(getRegistrationStepPath(currentStep));
  };

  return (
    <div className="registration-start">
      {/* Left visual panel */}
      <section
        className="registration-hero"
        style={{ backgroundImage: `url(${alsafwaPlantImage})` }}
        aria-label="AlSafwa Cement"
      >
        <div className="hero-overlay" />

        <div className="hero-content">
          <div>
            <h1>AlSafwa Cement</h1>

            <p>
              Building the future with precision, reliability, and unparalleled enterprise service.
            </p>
          </div>
        </div>
      </section>

      {/* Right content panel */}
      <main className="registration-content">
        <div className="registration-inner">
          <header className="registration-header">
            <h2>Register Your Organization</h2>

            <p>
              Create an application to access the AlSafwa Cement Customer Portal. Provide your
              organization's details to begin.
            </p>
          </header>

          {/* Sales review notice */}
          <div className="review-notice" role="note">
            <div className="notice-icon">
              <Info size={18} strokeWidth={2.5} />
            </div>

            <div>
              <h3>Sales Team Review Required</h3>

              <p>
                All new registrations undergo a verification process by our Sales Team to ensure
                security and validity before your account is activated.
              </p>
            </div>
          </div>

          {/* Registration process */}
          <section className="process-section">
            <h3 className="process-title">REGISTRATION PROCESS</h3>

            <div className="process-list">
              {registrationSteps.map((step, index) => {
                const Icon = step.icon;
                const isLast = index === registrationSteps.length - 1;

                return (
                  <div className="process-item" key={step.title}>
                    <div className="process-marker-wrapper">
                      <div className="process-marker">
                        <Icon size={18} strokeWidth={2} />
                      </div>

                      {!isLast && <div className="process-line" />}
                    </div>

                    <div className="process-content">
                      <h4>{step.title}</h4>
                      <p>{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Primary action */}
          <div className="mb-3 text-right">
            <SaveStatus />
          </div>
          <button
            type="button"
            className="start-registration-button"
            onClick={handleStart}
            disabled={isLoadingDraft || saveStatus === 'saving'}
          >
            <span>
              {isLoadingDraft
                ? 'Preparing registration...'
                : currentStep > 1
                  ? 'Continue Registration'
                  : 'Start Registration'}
            </span>
            <ArrowRight size={20} strokeWidth={2.2} />
          </button>
        </div>
      </main>
    </div>
  );
}

function getRegistrationStepPath(step: number) {
  const paths: Record<number, string> = {
    1: '/register/company',
    2: '/register/contact',
    3: '/register/documents',
    4: '/register/locations',
    5: '/register/admin',
    6: '/register/review',
  };

  return paths[step] ?? '/register/company';
}
