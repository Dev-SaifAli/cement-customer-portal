import { Navigate, Route, Routes } from 'react-router-dom';
import {
  areDeliveryLocationsValid,
  areDocumentsValid,
  isAdministratorValid,
  isCompanyValid,
  isContactValid,
  isRegistrationComplete,
  RegistrationProvider,
  useRegistration,
} from '../context/RegistrationContext';
import ApplicationSubmitted from '../pages/registration/ApplicationSubmitted';
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
  const { data } = useRegistration();

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
    return <Navigate to="/register/delivery-locations" replace />;
  }

  if (step === 'review' && !isAdministratorValid(data.administrator)) {
    return <Navigate to="/register/customer-admin" replace />;
  }

  if (step === 'submitted' && !isRegistrationComplete(data)) {
    return <Navigate to="/register/review" replace />;
  }

  return children;
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
        path="/delivery-locations"
        element={
          <GuardedRegistrationRoute step="deliveryLocations">
            <DeliveryLocations />
          </GuardedRegistrationRoute>
        }
      />
      <Route
        path="/customer-admin"
        element={
          <GuardedRegistrationRoute step="customerAdmin">
            <CustomerAdmin />
          </GuardedRegistrationRoute>
        }
      />
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
