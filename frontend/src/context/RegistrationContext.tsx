import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createRegistrationDraft,
  getRegistrationDraft,
  RegistrationServiceError,
  submitRegistrationDraft,
  updateRegistrationDraft,
  uploadRegistrationDocument,
  type RegistrationDraftResponse,
} from '../services/registrationService';
import type { ApplicationStatus } from '../services/applicationService';

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
  fileName?: string | undefined;
  fileSize?: number | undefined;
  fileType?: string | undefined;
  uploadedAt?: string | undefined;
  expiryDate: string;
};

export type DocumentsData = {
  cr: DocumentData;
  vat: DocumentData;
};

export type DeliveryLocation = {
  id: string;
  name: string;
  siteId?: string | undefined;
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

export type SubmittedApplication = {
  reference: string;
  status: ApplicationStatus;
  statusLabel: string;
  submittedAt: string;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type RegistrationContextValue = {
  data: RegistrationData;
  currentStep: number;
  hasUnsavedChanges: boolean;
  isLoadingDraft: boolean;
  saveError: string;
  saveStatus: SaveStatus;
  submittedApplication: SubmittedApplication | null;
  updateCompany: (values: Partial<CompanyInfoData>) => void;
  updateContact: (values: Partial<ContactInfoData>) => void;
  updateDocuments: (values: Partial<DocumentsData>) => void;
  setDeliveryLocations: (locations: DeliveryLocation[]) => void;
  updateAdministrator: (values: Partial<AdministratorData>) => void;
  setCurrentStep: (step: number) => void;
  saveDraft: (options?: { createIfMissing?: boolean }) => Promise<boolean>;
  retrySave: () => void;
  continueRegistration: (onSuccess: () => void) => Promise<void>;
  submitApplication: () => Promise<SubmittedApplication>;
  resetRegistration: () => void;
};

const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_DOCUMENT_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const REGISTRATION_DRAFT_STORAGE_KEY = 'alsafwa_registration_draft_id';
const SUBMITTED_APPLICATION_STORAGE_KEY = 'alsafwa_submitted_application';

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
  const [currentStep, setCurrentStepState] = useState(1);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const [submittedApplication, setSubmittedApplication] = useState<SubmittedApplication | null>(
    () => getStoredSubmittedApplication(),
  );

  const registrationIdRef = useRef<string | null>(null);
  const dataRef = useRef(data);
  const currentStepRef = useRef(currentStep);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const continuePromiseRef = useRef<Promise<void> | null>(null);
  const initializedRef = useRef(false);
  const lastSavedSnapshotRef = useRef('');

  const hasUnsavedChanges = useMemo(() => {
    const currentStepData = getStepData(data, currentStep);
    const lastSavedStepData = getStepData(
      parseRegistrationSnapshot(lastSavedSnapshotRef.current),
      currentStep,
    );

    return (
      hasStepData(data, currentStep) &&
      JSON.stringify(currentStepData) !== JSON.stringify(lastSavedStepData)
    );
  }, [currentStep, data, saveStatus]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  const applyDraft = useCallback((draft: RegistrationDraftResponse) => {
    const nextData = mergeDraftData(draft, dataRef.current);
    const nextStep = draft.currentStep || 1;

    registrationIdRef.current = draft.id;
    localStorage.setItem(REGISTRATION_DRAFT_STORAGE_KEY, draft.id);
    lastSavedSnapshotRef.current = getRegistrationSnapshot(nextData);
    setCurrentStepState(nextStep);
    setData(nextData);
  }, []);

  const createDraft = useCallback(
    async () =>
      createRegistrationDraft({
        ...dataRef.current,
        currentStep: currentStepRef.current,
      }),
    [],
  );

  const updateDraft = useCallback(
    (id: string) =>
      updateRegistrationDraft(id, {
        ...dataRef.current,
        currentStep: currentStepRef.current,
      }),
    [],
  );

  const markDraftDirty = useCallback(() => {
    setSaveStatus((currentStatus) => (currentStatus === 'saved' ? 'idle' : currentStatus));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeDraft = async () => {
      const storedId = localStorage.getItem(REGISTRATION_DRAFT_STORAGE_KEY);

      if (!storedId) {
        initializedRef.current = true;
        setIsLoadingDraft(false);
        return;
      }

      setIsLoadingDraft(true);
      try {
        const draft = await getRegistrationDraft(storedId);
        if (!isMounted) return;

        if (draft.status !== 'DRAFT') {
          localStorage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
          registrationIdRef.current = null;
          setData(emptyRegistrationData);
          setCurrentStepState(1);
          setSaveStatus('idle');
          setSaveError('');
          return;
        }

        applyDraft(draft);
      } catch (error) {
        if (!isMounted) return;
        if (
          error instanceof RegistrationServiceError &&
          (error.status === 404 || error.code === 'REGISTRATION_ID_INVALID')
        ) {
          localStorage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
          registrationIdRef.current = null;
          setSaveStatus('idle');
          setSaveError('');
        } else {
          setSaveStatus('error');
          setSaveError(getRegistrationErrorMessage(error, 'Draft could not be loaded.'));
        }
      } finally {
        if (isMounted) {
          initializedRef.current = true;
          setIsLoadingDraft(false);
        }
      }
    };

    void initializeDraft();

    return () => {
      isMounted = false;
    };
  }, [applyDraft]);

  const updateCompany = useCallback(
    (values: Partial<CompanyInfoData>) => {
      markDraftDirty();
      setData((current) => ({ ...current, company: { ...current.company, ...values } }));
    },
    [markDraftDirty],
  );

  const updateContact = useCallback(
    (values: Partial<ContactInfoData>) => {
      markDraftDirty();
      setData((current) => ({ ...current, contact: { ...current.contact, ...values } }));
    },
    [markDraftDirty],
  );

  const updateDocuments = useCallback(
    (values: Partial<DocumentsData>) => {
      markDraftDirty();
      setData((current) => ({
        ...current,
        documents: {
          cr: { ...current.documents.cr, ...values.cr },
          vat: { ...current.documents.vat, ...values.vat },
        },
      }));
    },
    [markDraftDirty],
  );

  const setDeliveryLocations = useCallback(
    (locations: DeliveryLocation[]) => {
      markDraftDirty();
      setData((current) => ({ ...current, deliveryLocations: locations }));
    },
    [markDraftDirty],
  );

  const updateAdministrator = useCallback(
    (values: Partial<AdministratorData>) => {
      markDraftDirty();
      setData((current) => ({
        ...current,
        administrator: { ...current.administrator, ...values },
      }));
    },
    [markDraftDirty],
  );

  const setCurrentStep = useCallback((step: number) => {
    if (currentStepRef.current !== step) {
      currentStepRef.current = step;
      setSaveStatus('idle');
      setSaveError('');
    }

    setCurrentStepState(step);
  }, []);

  const saveDraft = useCallback(
    async (options: { createIfMissing?: boolean } = {}) => {
      if (savePromiseRef.current) return savePromiseRef.current;

      if (!registrationIdRef.current && !options.createIfMissing) {
        return true;
      }

      const currentSnapshot = getRegistrationSnapshot(dataRef.current);

      if (!hasRegistrationData(dataRef.current)) {
        return true;
      }

      if (registrationIdRef.current && lastSavedSnapshotRef.current === currentSnapshot) {
        return true;
      }

      const runSave = async () => {
        setSaveStatus('saving');
        setSaveError('');

        try {
          const savedDraft = registrationIdRef.current
            ? await updateDraft(registrationIdRef.current)
            : await createDraft();
          registrationIdRef.current = savedDraft.id;
          localStorage.setItem(REGISTRATION_DRAFT_STORAGE_KEY, savedDraft.id);

          const draft = await uploadPendingDocuments(savedDraft.id, savedDraft, dataRef.current);
          const nextData = mergeDraftData(draft, dataRef.current);

          registrationIdRef.current = draft.id;
          localStorage.setItem(REGISTRATION_DRAFT_STORAGE_KEY, draft.id);
          lastSavedSnapshotRef.current = getRegistrationSnapshot(nextData);
          setData(nextData);
          setSaveStatus('saved');
          return true;
        } catch (error) {
          if (
            error instanceof RegistrationServiceError &&
            (error.status === 404 || error.code === 'REGISTRATION_ID_INVALID')
          ) {
            registrationIdRef.current = null;
            localStorage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
          }

          setSaveStatus('error');
          setSaveError(getRegistrationErrorMessage(error, 'Unable to save registration.'));
          return false;
        } finally {
          savePromiseRef.current = null;
        }
      };

      savePromiseRef.current = runSave();
      return savePromiseRef.current;
    },
    [createDraft, updateDraft],
  );

  const retrySave = useCallback(() => {
    void saveDraft({ createIfMissing: true });
  }, [saveDraft]);

  const continueRegistration = useCallback(async (onSuccess: () => void) => {
    if (continuePromiseRef.current) return continuePromiseRef.current;

    const runContinue = async () => {
      onSuccess();
    };

    continuePromiseRef.current = runContinue().finally(() => {
      continuePromiseRef.current = null;
    });

    return continuePromiseRef.current;
  }, []);

  const submitApplication = useCallback(async () => {
    const saved = await saveDraft({ createIfMissing: true });
    if (!saved || !registrationIdRef.current) {
      throw new Error(saveError || 'Unable to save registration before submission.');
    }

    const submitted = await submitRegistrationDraft(registrationIdRef.current);
    setSubmittedApplication(submitted);
    storeSubmittedApplication(submitted);
    registrationIdRef.current = null;
    localStorage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
    setSaveStatus('idle');
    setSaveError('');
    return submitted;
  }, [saveDraft, saveError]);

  const resetRegistration = useCallback(() => {
    registrationIdRef.current = null;
    localStorage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
    setData(emptyRegistrationData);
    setCurrentStepState(1);
    setSaveStatus('idle');
    setSaveError('');
    setSubmittedApplication(null);
    sessionStorage.removeItem(SUBMITTED_APPLICATION_STORAGE_KEY);
  }, []);

  const value = useMemo<RegistrationContextValue>(
    () => ({
      data,
      currentStep,
      hasUnsavedChanges,
      isLoadingDraft,
      saveError,
      saveStatus,
      submittedApplication,
      updateCompany,
      updateContact,
      updateDocuments,
      setDeliveryLocations,
      updateAdministrator,
      setCurrentStep,
      saveDraft,
      retrySave,
      continueRegistration,
      submitApplication,
      resetRegistration,
    }),
    [
      continueRegistration,
      currentStep,
      data,
      hasUnsavedChanges,
      isLoadingDraft,
      resetRegistration,
      retrySave,
      saveDraft,
      saveError,
      saveStatus,
      setCurrentStep,
      setDeliveryLocations,
      submitApplication,
      submittedApplication,
      updateAdministrator,
      updateCompany,
      updateContact,
      updateDocuments,
    ],
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

export function getStoredSubmittedApplication() {
  const stored = sessionStorage.getItem(SUBMITTED_APPLICATION_STORAGE_KEY);

  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as Partial<SubmittedApplication>;

    if (
      typeof parsed.reference === 'string' &&
      typeof parsed.status === 'string' &&
      typeof parsed.statusLabel === 'string' &&
      typeof parsed.submittedAt === 'string'
    ) {
      return parsed as SubmittedApplication;
    }
  } catch {
    sessionStorage.removeItem(SUBMITTED_APPLICATION_STORAGE_KEY);
  }

  return null;
}

function storeSubmittedApplication(application: SubmittedApplication) {
  sessionStorage.setItem(SUBMITTED_APPLICATION_STORAGE_KEY, JSON.stringify(application));
}

async function uploadPendingDocuments(
  draftId: string,
  draft: RegistrationDraftResponse,
  currentData: RegistrationData,
) {
  let nextDraft = draft;

  if (currentData.documents.cr.file) {
    nextDraft = await uploadRegistrationDocument(draftId, 'cr', currentData.documents.cr.file);
  }

  if (currentData.documents.vat.file) {
    nextDraft = await uploadRegistrationDocument(draftId, 'vat', currentData.documents.vat.file);
  }

  return nextDraft;
}

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSaudiPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('00966')) return digits.slice(5);
  if (digits.startsWith('966')) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);

  return digits;
}

export function getSaudiPhoneLocalDigits(phone: string) {
  return normalizeSaudiPhoneNumber(phone).slice(0, 9);
}

export function formatSaudiPhoneNumber(phone: string) {
  const digits = getSaudiPhoneLocalDigits(phone);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(' ');
}

export function getSaudiPhoneDigitsRemaining(phone: string) {
  return Math.max(0, 9 - getSaudiPhoneLocalDigits(phone).length);
}

export function isSaudiPhoneNumber(phone: string) {
  return /^5\d{8}$/.test(normalizeSaudiPhoneNumber(phone));
}

export function isCompanyValid(company: CompanyInfoData) {
  return Boolean(
    company.companyName.trim() &&
    /^\d{10}$/.test(company.crNumber.trim()) &&
    /^\d{15}$/.test(company.vatNumber.trim()) &&
    company.streetAddress.trim() &&
    company.city.trim() &&
    company.region.trim() &&
    company.country.trim() &&
    /^\d{5}$/.test(company.postalCode.trim()),
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
  const hasSelectedFile = Boolean(document.file);
  const hasPersistedFile = Boolean(document.fileName && document.uploadedAt);

  return Boolean(
    (hasSelectedFile || hasPersistedFile) &&
    (!hasPersistedFile || document.fileSize) &&
    (!hasPersistedFile || document.fileType) &&
    (!document.file || isAcceptedDocumentFile(document.file)) &&
    (!document.file || document.file.size <= MAX_DOCUMENT_FILE_SIZE) &&
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

function mergeDraftData(
  draft: RegistrationDraftResponse,
  currentData: RegistrationData = emptyRegistrationData,
): RegistrationData {
  const mergedContact = { ...emptyRegistrationData.contact, ...draft.contact };
  const mergedAdministrator = {
    ...emptyRegistrationData.administrator,
    ...draft.administrator,
    password: currentData.administrator.password,
    confirmPassword: currentData.administrator.confirmPassword,
  };

  return {
    company: { ...emptyRegistrationData.company, ...draft.company },
    contact: {
      ...mergedContact,
      phone: shouldKeepCurrentPhone(currentData.contact.phone, mergedContact.phone)
        ? currentData.contact.phone
        : mergedContact.phone,
    },
    documents: {
      cr: { ...emptyRegistrationData.documents.cr, ...draft.documents.cr },
      vat: { ...emptyRegistrationData.documents.vat, ...draft.documents.vat },
    },
    deliveryLocations: mergeDeliveryLocations(
      draft.deliveryLocations ?? [],
      currentData.deliveryLocations,
    ),
    administrator: {
      ...mergedAdministrator,
      phone: shouldKeepCurrentPhone(currentData.administrator.phone, mergedAdministrator.phone)
        ? currentData.administrator.phone
        : mergedAdministrator.phone,
    },
  };
}

function mergeDeliveryLocations(
  savedLocations: DeliveryLocation[],
  currentLocations: DeliveryLocation[],
): DeliveryLocation[] {
  return savedLocations.map((savedLocation) => {
    const currentLocation = currentLocations.find((location) => location.id === savedLocation.id);

    if (!currentLocation) return savedLocation;

    return {
      ...savedLocation,
      contactPhone: shouldKeepCurrentPhone(currentLocation.contactPhone, savedLocation.contactPhone)
        ? currentLocation.contactPhone
        : savedLocation.contactPhone,
    };
  });
}

function shouldKeepCurrentPhone(currentPhone: string, savedPhone: string | undefined) {
  return Boolean(currentPhone && currentPhone !== savedPhone && !isSaudiPhoneNumber(currentPhone));
}

function getRegistrationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getRegistrationSnapshot(data: RegistrationData) {
  return JSON.stringify(data);
}

function parseRegistrationSnapshot(snapshot: string): RegistrationData {
  if (!snapshot) return emptyRegistrationData;

  try {
    return mergeRegistrationData(JSON.parse(snapshot) as Partial<RegistrationData>);
  } catch {
    return emptyRegistrationData;
  }
}

function mergeRegistrationData(data: Partial<RegistrationData>): RegistrationData {
  return {
    company: { ...emptyRegistrationData.company, ...data.company },
    contact: { ...emptyRegistrationData.contact, ...data.contact },
    documents: {
      cr: { ...emptyRegistrationData.documents.cr, ...data.documents?.cr },
      vat: { ...emptyRegistrationData.documents.vat, ...data.documents?.vat },
    },
    deliveryLocations: data.deliveryLocations ?? [],
    administrator: { ...emptyRegistrationData.administrator, ...data.administrator },
  };
}

function getStepData(data: RegistrationData, step: number) {
  if (step === 1) return data.company;
  if (step === 2) return data.contact;
  if (step === 3) return data.documents;
  if (step === 4) return data.deliveryLocations;
  if (step === 5) return data.administrator;
  return data;
}

function hasStepData(data: RegistrationData, step: number) {
  if (step === 1) {
    return Boolean(
      data.company.companyName.trim() ||
      data.company.crNumber.trim() ||
      data.company.vatNumber.trim() ||
      data.company.streetAddress.trim() ||
      data.company.city.trim() ||
      data.company.region.trim() ||
      data.company.postalCode.trim(),
    );
  }

  if (step === 2) {
    return Boolean(
      data.contact.fullName.trim() ||
      data.contact.jobTitle.trim() ||
      data.contact.email.trim() ||
      data.contact.phone.trim(),
    );
  }

  if (step === 3) {
    return Boolean(
      data.documents.cr.file ||
      data.documents.cr.fileName ||
      data.documents.cr.expiryDate ||
      data.documents.vat.file ||
      data.documents.vat.fileName ||
      data.documents.vat.expiryDate,
    );
  }

  if (step === 4) return data.deliveryLocations.length > 0;

  if (step === 5) {
    return Boolean(
      data.administrator.fullName.trim() ||
      data.administrator.jobTitle.trim() ||
      data.administrator.email.trim() ||
      data.administrator.phone.trim() ||
      data.administrator.password ||
      data.administrator.confirmPassword,
    );
  }

  return hasRegistrationData(data);
}

function hasRegistrationData(data: RegistrationData) {
  return Boolean(
    data.company.companyName.trim() ||
    data.company.crNumber.trim() ||
    data.company.vatNumber.trim() ||
    data.company.streetAddress.trim() ||
    data.company.city.trim() ||
    data.company.region.trim() ||
    data.company.postalCode.trim() ||
    data.contact.fullName.trim() ||
    data.contact.jobTitle.trim() ||
    data.contact.email.trim() ||
    data.contact.phone.trim() ||
    data.documents.cr.file ||
    data.documents.cr.fileName ||
    data.documents.cr.expiryDate ||
    data.documents.vat.file ||
    data.documents.vat.fileName ||
    data.documents.vat.expiryDate ||
    data.deliveryLocations.length > 0 ||
    data.administrator.fullName.trim() ||
    data.administrator.jobTitle.trim() ||
    data.administrator.email.trim() ||
    data.administrator.phone.trim() ||
    data.administrator.password ||
    data.administrator.confirmPassword,
  );
}
