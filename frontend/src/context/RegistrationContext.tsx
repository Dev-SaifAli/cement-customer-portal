import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type CompanyInfoData = {
  companyName: string;
  crNumber: string;
  vatNumber: string;
  streetAddress: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
};

export type ContactInfoData = {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
};

export type DocumentData = {
  file: File | null;
  expiryDate: string;
};

export type DocumentsData = {
  cr: DocumentData;
  vat: DocumentData;
};

export type DeliveryLocation = {
  id: string;
  name: string;
  siteId: string;
  streetAddress: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  contactPerson: string;
  contactPhone: string;
};

export type AdministratorData = {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

export type RegistrationData = {
  company: CompanyInfoData;
  contact: ContactInfoData;
  documents: DocumentsData;
  deliveryLocations: DeliveryLocation[];
  administrator: AdministratorData;
};

const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_DOCUMENT_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

type RegistrationContextValue = {
  data: RegistrationData;
  updateCompany: (values: Partial<CompanyInfoData>) => void;
  updateContact: (values: Partial<ContactInfoData>) => void;
  updateDocuments: (values: Partial<DocumentsData>) => void;
  setDeliveryLocations: (locations: DeliveryLocation[]) => void;
  updateAdministrator: (values: Partial<AdministratorData>) => void;
  resetRegistration: () => void;
};

const emptyRegistrationData: RegistrationData = {
  company: {
    companyName: '',
    crNumber: '',
    vatNumber: '',
    streetAddress: '',
    city: '',
    region: '',
    country: 'Saudi Arabia',
    postalCode: '',
  },
  contact: {
    fullName: '',
    jobTitle: '',
    email: '',
    phone: '',
  },
  documents: {
    cr: {
      file: null,
      expiryDate: '',
    },
    vat: {
      file: null,
      expiryDate: '',
    },
  },
  deliveryLocations: [],
  administrator: {
    fullName: '',
    jobTitle: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  },
};

const RegistrationContext = createContext<RegistrationContextValue | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<RegistrationData>(emptyRegistrationData);

  const value = useMemo<RegistrationContextValue>(
    () => ({
      data,
      updateCompany: (values) =>
        setData((current) => ({ ...current, company: { ...current.company, ...values } })),
      updateContact: (values) =>
        setData((current) => ({ ...current, contact: { ...current.contact, ...values } })),
      updateDocuments: (values) =>
        setData((current) => ({
          ...current,
          documents: {
            cr: { ...current.documents.cr, ...values.cr },
            vat: { ...current.documents.vat, ...values.vat },
          },
        })),
      setDeliveryLocations: (locations) =>
        setData((current) => ({ ...current, deliveryLocations: locations })),
      updateAdministrator: (values) =>
        setData((current) => ({
          ...current,
          administrator: { ...current.administrator, ...values },
        })),
      resetRegistration: () => setData(emptyRegistrationData),
    }),
    [data],
  );

  return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>;
}

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error('useRegistration must be used within RegistrationProvider');
  }
  return context;
}

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSaudiPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('00966')) return digits.slice(5);
  if (digits.startsWith('966')) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);

  return digits;
}

export function isSaudiPhoneNumber(phone: string) {
  return /^[1-9]\d{8}$/.test(normalizeSaudiPhoneNumber(phone));
}

export function isCompanyValid(company: CompanyInfoData) {
  return Boolean(
    company.companyName.trim() &&
    company.crNumber.trim() &&
    company.vatNumber.trim() &&
    company.streetAddress.trim() &&
    company.city.trim() &&
    company.region.trim() &&
    company.country.trim() &&
    company.postalCode.trim(),
  );
}

export function isContactValid(contact: ContactInfoData) {
  return Boolean(
    contact.fullName.trim() &&
    contact.jobTitle.trim() &&
    emailPattern.test(contact.email.trim()) &&
    isSaudiPhoneNumber(contact.phone.trim()),
  );
}

export function isDocumentFuture(expiryDate: string) {
  if (!expiryDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${expiryDate}T00:00:00`) > today;
}

export function isAcceptedDocumentFile(file: File) {
  const fileName = file.name.toLowerCase();
  const hasAcceptedType = ACCEPTED_DOCUMENT_FILE_TYPES.includes(file.type);
  const hasAcceptedExtension = ACCEPTED_DOCUMENT_EXTENSIONS.some((extension) =>
    fileName.endsWith(extension),
  );

  return hasAcceptedType || hasAcceptedExtension;
}

export function isDocumentValid(document: DocumentData) {
  return Boolean(
    document.file &&
    isAcceptedDocumentFile(document.file) &&
    document.file.size <= MAX_DOCUMENT_FILE_SIZE &&
    document.expiryDate &&
    isDocumentFuture(document.expiryDate),
  );
}

export function areDocumentsValid(documents: DocumentsData) {
  return isDocumentValid(documents.cr) && isDocumentValid(documents.vat);
}

export function isDeliveryLocationValid(location: DeliveryLocation) {
  return Boolean(
    location.name.trim() &&
    location.streetAddress.trim() &&
    location.city.trim() &&
    location.region.trim() &&
    location.country.trim() &&
    location.contactPerson.trim() &&
    isSaudiPhoneNumber(location.contactPhone.trim()),
  );
}

export function areDeliveryLocationsValid(locations: DeliveryLocation[]) {
  return locations.length > 0 && locations.every(isDeliveryLocationValid);
}

export function isAdministratorValid(administrator: AdministratorData) {
  return Boolean(
    administrator.fullName.trim() &&
    administrator.jobTitle.trim() &&
    emailPattern.test(administrator.email.trim()) &&
    isSaudiPhoneNumber(administrator.phone.trim()) &&
    administrator.password.length >= 8 &&
    /[A-Z]/.test(administrator.password) &&
    /[a-z]/.test(administrator.password) &&
    /\d/.test(administrator.password) &&
    administrator.password === administrator.confirmPassword,
  );
}

export function isRegistrationComplete(data: RegistrationData) {
  return (
    isCompanyValid(data.company) &&
    isContactValid(data.contact) &&
    areDocumentsValid(data.documents) &&
    areDeliveryLocationsValid(data.deliveryLocations) &&
    isAdministratorValid(data.administrator)
  );
}
