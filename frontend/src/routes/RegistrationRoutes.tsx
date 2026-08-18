import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  areDeliveryLocationsValid,
  areDocumentsValid,
  isAdministratorValid,
  isCompanyValid,
  isContactValid,
  isRegistrationComplete,
  getStoredSubmittedApplication,
  RegistrationProvider,
  useRegistration,
} from '../context/RegistrationContext';
import type { SubmittedApplication } from '../context/RegistrationContext';
import ApplicationSubmitted from '../pages/registration/ApplicationSubmitted';
import ApplicationStatus from '../pages/registration/ApplicationStatus';
import CompanyInfo from '../pages/registration/CompanyInfo';
import ContactInfo from '../pages/registration/ContactInfo';
import CustomerAdmin from '../pages/registration/CustomerAdmin';
import DeliveryLocations from '../pages/registration/DeliveryLocations';
import Documents from '../pages/registration/Documents';
import RegistrationStart from '../pages/registration/RegistrationStart';
import ReviewSubmit from '../pages/registration/ReviewSubmit';

type RegistrationStep =
  'contact' | 'documents' | 'deliveryLocations' | 'customerAdmin' | 'review' | 'submitted';

function GuardedRegistrationRoute({
  children,
  step,
}: {
  children: React.ReactNode;
  step: RegistrationStep;
}) {
  const { data, isLoadingDraft, submittedApplication } = useRegistration();
  const location = useLocation();
  const submittedApplicationFromLocation = isSubmittedApplicationLocationState(location.state)
    ? location.state.submittedApplication
    : null;
  const storedSubmittedApplication = getStoredSubmittedApplication();

  if (isLoadingDraft) return null;

  if (step === 'contact' && !isCompanyValid(data.company)) {
    return <Navigate to="/register/company" replace />;
  }

  if (step === 'documents' && !isContactValid(data.contact)) {
    return <Navigate to="/register/contact" replace />;
  }

  if (step === 'deliveryLocations' && !areDocumentsValid(data.documents)) {
    return <Navigate to="/register/documents" replace />;
  }

  if (step === 'customerAdmin' && !areDeliveryLocationsValid(data.deliveryLocations)) {
    return <Navigate to="/register/locations" replace />;
  }

  if (step === 'review' && !isAdministratorValid(data.administrator)) {
    return <Navigate to="/register/admin" replace />;
  }

  if (
    step === 'submitted' &&
    !submittedApplication?.reference &&
    !submittedApplicationFromLocation?.reference &&
    !storedSubmittedApplication?.reference &&
    !isRegistrationComplete(data)
  ) {
    return <Navigate to="/register/review" replace />;
  }

  return children;
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

function RegistrationRouteSet() {
  return (
    <Routes>
      <Route path="/" element={<RegistrationStart />} />
      <Route path="/company" element={<CompanyInfo />} />
      <Route
        path="/contact"
        element={
          <GuardedRegistrationRoute step="contact">
            <ContactInfo />
          </GuardedRegistrationRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <GuardedRegistrationRoute step="documents">
            <Documents />
          </GuardedRegistrationRoute>
        }
      />
      <Route
        path="/locations"
        element={
          <GuardedRegistrationRoute step="deliveryLocations">
            <DeliveryLocations />
          </GuardedRegistrationRoute>
        }
      />
      <Route path="/delivery-locations" element={<Navigate to="/register/locations" replace />} />
      <Route
        path="/admin"
        element={
          <GuardedRegistrationRoute step="customerAdmin">
            <CustomerAdmin />
          </GuardedRegistrationRoute>
        }
      />
      <Route path="/customer-admin" element={<Navigate to="/register/admin" replace />} />
      <Route
        path="/review"
        element={
          <GuardedRegistrationRoute step="review">
            <ReviewSubmit />
          </GuardedRegistrationRoute>
        }
      />
      <Route
        path="/submitted"
        element={
          <GuardedRegistrationRoute step="submitted">
            <ApplicationSubmitted />
          </GuardedRegistrationRoute>
        }
      />
      <Route path="/status" element={<ApplicationStatus />} />
      <Route path="*" element={<Navigate to="/register" replace />} />
    </Routes>
  );
}

export function RegistrationRoutes() {
  return (
    <RegistrationProvider>
      <RegistrationRouteSet />
    </RegistrationProvider>
  );
}
