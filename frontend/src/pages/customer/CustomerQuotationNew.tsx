import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { CommercialTonInput } from '../../components/ui/CommercialTonInput';
import { useToast } from '../../components/ui/ToastProvider';
import { DetailBreadcrumb } from '../../components/customer-detail/DetailBreadcrumb';
import {
  DocumentHeader,
  DocumentStateBadge,
} from '../../components/customer-detail/DocumentHeader';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '../../components/ui/shadcn';
import {
  AlertCircle,
  CalendarDays,
  Check,
  Copy,
  Download,
  Eye,
  ExternalLink,
  Loader2,
  MapPin,
  MoreVertical,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ProductImage } from '../../components/customer/ProductImage';
import {
  QuotationPreviewModal,
  type QuotationPreviewAction,
} from '../../components/customer/QuotationPreviewModal';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  getCustomerDashboard,
  type CustomerDashboardData,
} from '../../services/customerDashboardService';
import {
  getCustomerLocations,
  type CustomerLocation,
} from '../../services/customerLocationsService';
import {
  getCustomerProduct,
  getCustomerProducts,
  type CustomerProduct,
} from '../../services/customerProductsService';
import {
  createCustomerQuotation,
  getCustomerQuotation,
  getPickupLocations,
  submitCustomerQuotation,
  updateCustomerQuotation,
  type CustomerQuotation,
  type CustomerQuotationPayload,
  type PickupLocation,
  type QuotationFulfilmentType,
} from '../../services/customerQuotationsService';
import { createClientId } from '../../utils/createClientId';
import {
  formatCommercialTonValue,
  isWholeTonQuantity,
  packagingQuantityForTons,
  wholeTonQuantityMessage,
} from '../../utils/commercialQuantity';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

type FormItem = {
  key: string;
  product: CustomerProduct | null;
  quantity: string;
};

type FormState = {
  fulfilmentType: QuotationFulfilmentType;
  pickupLocationId: string;
  shipToLocationId: string;
  requestedDate: string;
  specialPriceRequested: boolean;
  palletRequired: boolean;
  palletType: string;
  palletQuantity: string;
  notes: string;
  items: FormItem[];
};

const draftStorageKey = 'alsafwa_customer_quotation_draft_id';
const writableRoles = new Set(['CUSTOMER_ADMIN', 'PURCHASER']);
const today = new Date().toISOString().slice(0, 10);
const palletTypeOptions = ['Standard Wooden Pallet', 'Euro Pallet', 'Plastic Pallet'];

const initialItem = (): FormItem => ({
  key: createClientId(),
  product: null,
  quantity: '',
});

const createInitialForm = (): FormState => ({
  fulfilmentType: 'DELIVERY',
  pickupLocationId: '',
  shipToLocationId: '',
  requestedDate: '',
  specialPriceRequested: false,
  palletRequired: false,
  palletType: '',
  palletQuantity: '',
  notes: '',
  items: [initialItem()],
});

export function CustomerQuotationNew() {
  const navigate = useNavigate();
  const { id: routeQuotationId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preselectedProductId = searchParams.get('product')?.trim() ?? '';
  const { account, user } = useCustomerAuth();
  const toast = useToast();
  const canManageQuotation = Boolean(user?.role && writableRoles.has(user.role));
  const [form, setForm] = useState<FormState>(createInitialForm);
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [quotation, setQuotation] = useState<CustomerQuotation | null>(null);
  const [dashboard, setDashboard] = useState<CustomerDashboardData | null>(null);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<CustomerLocation[]>([]);
  const [productResults, setProductResults] = useState<CustomerProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [activePickerKey, setActivePickerKey] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [palletQuantityTouched, setPalletQuantityTouched] = useState(false);
  const [palletQuantityInputError, setPalletQuantityInputError] = useState('');
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [previewAction, setPreviewAction] = useState<QuotationPreviewAction | null>(null);
  const [previewQuotation, setPreviewQuotation] = useState<CustomerQuotation | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const requestedDateInputRef = useRef<HTMLInputElement>(null);
  const operationInFlightRef = useRef(false);
  const [activeSection, setActiveSection] = useState('details');

  const selectedShipTo = deliveryLocations.find(
    (location) => location.id === form.shipToLocationId,
  );
  const selectedPickup = pickupLocations.find(
    (location) => location.id === form.pickupLocationId,
  );
  const hasCoordinates =
    typeof selectedShipTo?.latitude === 'number' && typeof selectedShipTo.longitude === 'number';
  const validationErrors = useMemo(() => validateForm(form), [form]);
  const isValid = validationErrors.length === 0;
  const isSubmitted = Boolean(quotation && quotation.status !== 'DRAFT');
  const documentTitle = quotation?.reference ?? 'New RFQ';
  const currentSnapshot = useMemo(() => serializeForm(form), [form]);
  const isDirty = currentSnapshot !== lastSavedSnapshot;
  const isSavedDraft = !isSubmitted && Boolean(quotationId) && !isDirty;
  const primaryActionLabel = isSavedDraft ? 'Submit' : 'Save';
  const statusBadgeLabel = isSubmitted
    ? formatQuotationStatus(quotation?.status)
    : 'Draft';
  const formBusy = saving || submitting;
  const allRowsSelected =
    form.items.length > 0 && form.items.every((item) => selectedRows.has(item.key));
  const palletTypeError =
    showValidation && form.palletRequired && !form.palletType.trim()
      ? 'Select a pallet type.'
      : '';
  const palletQuantityError =
    form.palletRequired && (showValidation || palletQuantityTouched || palletQuantityInputError)
      ? getPalletQuantityError(form.palletQuantity, palletQuantityInputError)
      : '';

  useEffect(() => {
    const loadFoundation = async () => {
      setLoading(true);
      setError('');

      try {
        const [pickup, locations, dashboardData] = await Promise.all([
          getPickupLocations(),
          getCustomerLocations(),
          getCustomerDashboard().catch(() => null),
        ]);
        setPickupLocations(pickup);
        setDeliveryLocations(locations);
        setDashboard(dashboardData);

        let nextForm: FormState = {
          ...createInitialForm(),
          pickupLocationId: pickup[0]?.id ?? '',
          shipToLocationId: '',
        };

        const quotationToLoad = routeQuotationId ?? localStorage.getItem(draftStorageKey);
        if (quotationToLoad) {
          const savedQuotation = await getCustomerQuotation(quotationToLoad);
          if (routeQuotationId || savedQuotation.status === 'DRAFT') {
            setQuotationId(savedQuotation.id);
            setQuotation(savedQuotation);
            nextForm = fromQuotation(savedQuotation);
          } else {
            localStorage.removeItem(draftStorageKey);
          }
        }

        if (!quotationToLoad && preselectedProductId) {
          const preselectedProduct = await getCustomerProduct(preselectedProductId).catch(
            () => null,
          );
          if (preselectedProduct) {
            nextForm = {
              ...nextForm,
              items: [
                {
                  ...initialItem(),
                  product: preselectedProduct,
                  quantity: '1',
                },
              ],
            };
            setProductResults([preselectedProduct]);
            setActiveSection('items');
          }
        }

        setForm(nextForm);
        setLastSavedSnapshot(serializeForm(nextForm));
      } catch {
        setError('Unable to load RFQ setup. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadFoundation();
  }, [preselectedProductId, routeQuotationId]);

  useEffect(() => {
    if (!activePickerKey) return;

    const timer = window.setTimeout(async () => {
      setProductsLoading(true);
      try {
        const result = await getCustomerProducts({ search: productSearch });
        setProductResults(result.items);
      } catch {
        setProductResults([]);
      } finally {
        setProductsLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activePickerKey, productSearch]);

  useEffect(() => {
    if (!isDirty || isSubmitted) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty, isSubmitted]);

  const revealValidationError = useCallback(() => {
    const firstError = validationErrors[0];
    const itemError = firstError && form.items.some((item, index) =>
      Object.values(getItemErrors(item, index)).includes(firstError),
    );
    const section = itemError ? 'items' : 'details';
    setActiveSection(section);
    window.requestAnimationFrame(() => {
      const panel = document.getElementById(`rfq-${section}`);
      const control = panel?.querySelector<HTMLElement>('[aria-invalid="true"]:not(select)');
      (control ?? panel)?.focus({ preventScroll: true });
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [form.items, validationErrors]);

  const saveDraft = useCallback(async () => {
    setError('');
    setShowValidation(true);

    if (saving || submitting || operationInFlightRef.current) return null;

    if (!isValid) {
      revealValidationError();
      return null;
    }

    operationInFlightRef.current = true;
    setSaving(true);
    try {
      const payload = toPayload(form);
      const saved = quotationId
        ? await updateCustomerQuotation(quotationId, payload)
        : await createCustomerQuotation(payload);

      setQuotationId(saved.id);
      setQuotation(saved);
      localStorage.setItem(draftStorageKey, saved.id);
      setLastSavedSnapshot(serializeForm(form));
      toast.success('RFQ saved successfully');
      playFeedbackSound('/sounds/rfq-save.mp3');
      return saved;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save RFQ draft.');
      toast.error('Unable to save RFQ');
      return null;
    } finally {
      setSaving(false);
      operationInFlightRef.current = false;
    }
  }, [form, isValid, quotationId, saving, submitting, toast, revealValidationError]);

  const submitQuotation = useCallback(async () => {
    setError('');
    setShowValidation(true);

    if (saving || submitting || operationInFlightRef.current) return;

    if (!isValid) {
      revealValidationError();
      return;
    }

    operationInFlightRef.current = true;
    setSubmitting(true);
    try {
      if (!quotationId || isDirty) {
        setShowSubmitConfirmation(false);
        setError('Please save the RFQ before submitting.');
        toast.error('Unable to submit RFQ');
        return;
      }

      const submitted = await submitCustomerQuotation(quotationId);

      setQuotationId(submitted.id);
      setQuotation(submitted);
      setLastSavedSnapshot(serializeForm(form));
      localStorage.removeItem(draftStorageKey);
      setShowSubmitConfirmation(false);
      toast.success('RFQ submitted successfully');
      playFeedbackSound('/sounds/rfq-submit.mp3');
      navigate(`/customer/quotations/${submitted.id}`, { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to submit RFQ request.',
      );
      toast.error('Unable to submit RFQ');
    } finally {
      setSubmitting(false);
      operationInFlightRef.current = false;
    }
  }, [form, isDirty, isValid, navigate, quotationId, saving, submitting, toast, revealValidationError]);

  if (!canManageQuotation) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        Your role does not have permission to create RFQs.
      </section>
    );
  }

  if (loading) return <QuotationSkeleton />;

  const updateItem = (key: string, patch: Partial<FormItem>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  };

  const addRow = () => {
    setForm((current) => ({ ...current, items: [...current.items, initialItem()] }));
  };

  const removeSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setForm((current) => {
      const remaining = current.items.filter((item) => !selectedRows.has(item.key));
      return { ...current, items: remaining.length > 0 ? remaining : [initialItem()] };
    });
    setSelectedRows(new Set());
  };

  const removeRow = (key: string) => {
    setForm((current) => {
      const remaining = current.items.filter((item) => item.key !== key);
      return { ...current, items: remaining.length > 0 ? remaining : [initialItem()] };
    });
    setSelectedRows((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const updateForm = (patch: Partial<FormState>) => {
    if ('palletQuantity' in patch) setPalletQuantityInputError('');
    setForm((current) => ({ ...current, ...patch }));
  };

  const openRequestedDatePicker = () => {
    const input = requestedDateInputRef.current;
    if (!input || input.disabled) return;

    input.focus();
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Some browsers only allow showPicker during direct user activation; focus keeps native input access.
    }
  };

  const updatePalletRequired = (checked: boolean) => {
    setPalletQuantityTouched(false);
    setPalletQuantityInputError('');
    updateForm(
      checked
        ? { palletRequired: true }
        : { palletRequired: false, palletType: '', palletQuantity: '' },
    );
  };

  const updatePalletQuantity = (value: string) => {
    if (!digitsOnly(value)) {
      setPalletQuantityInputError('Enter a valid whole number of pallets.');
      return;
    }
    setPalletQuantityInputError('');
    updateForm({ palletQuantity: value });
  };

  const handlePalletQuantityKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isPermittedTextInputKey(event)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      setPalletQuantityInputError('Enter a valid whole number of pallets.');
    }
  };

  const handlePalletQuantityPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = event.clipboardData.getData('text');
    if (!digitsOnly(pastedValue)) {
      event.preventDefault();
      setPalletQuantityInputError('Enter a valid whole number of pallets.');
    }
  };

  const openPreview = async (action: QuotationPreviewAction) => {
    setMoreMenuOpen(false);
    let printableQuotation = quotation;

    if (!printableQuotation || (printableQuotation.status === 'DRAFT' && isDirty)) {
      printableQuotation = await saveDraft();
    }

    if (!printableQuotation) return;
    setPreviewQuotation(printableQuotation);
    setPreviewAction(action);
  };

  const handleKeyboardShortcuts = (event: KeyboardEvent<HTMLDivElement>) => {
    const shortcutKey = event.key.toLowerCase();
    const isModifierShortcut = event.ctrlKey || event.metaKey;

    if (isModifierShortcut && shortcutKey === 's') {
      event.preventDefault();
      if (isSubmitted || saving || submitting) return;
      if (isSavedDraft) setShowSubmitConfirmation(true);
      else void saveDraft();
      return;
    }

    if (isModifierShortcut && event.key === 'Enter') {
      event.preventDefault();
      if (isSubmitted || saving || submitting) return;
      setShowValidation(true);
      if (isSavedDraft && isValid) setShowSubmitConfirmation(true);
      return;
    }

    if (event.altKey && shortcutKey === 'a') {
      event.preventDefault();
      if (isSubmitted || saving || submitting) return;
      addRow();
      return;
    }

    if (event.key === 'Escape') {
      setMoreMenuOpen(false);
      setActivePickerKey(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-3 text-[var(--customer-text)] [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-[var(--customer-primary)]" onKeyDown={handleKeyboardShortcuts}>
      <DetailBreadcrumb
        listLabel="RFQs"
        listPath="/customer/quotations"
        current={documentTitle}
      />
      <section className={`overflow-visible bg-[var(--customer-surface)] transition-opacity ${formBusy ? 'opacity-75' : 'opacity-100'}`} aria-busy={formBusy}>
        <DocumentHeader
          number={documentTitle}
          status={
            <DocumentStateBadge
              persisted={Boolean(quotationId)}
              status={quotation?.status ?? null}
              label={statusBadgeLabel}
            />
          }
          className="min-h-[58px] bg-[var(--customer-surface)] px-5 py-3"
          actions={
            <>
            {!isSubmitted && (
              <Button
                type="button"
                onClick={() => {
                  if (isSavedDraft) setShowSubmitConfirmation(true);
                  else void saveDraft();
                }}
                disabled={saving || submitting}
                aria-busy={saving || submitting}
                className="h-9 gap-2 rounded-lg bg-[#54247a] px-5 text-sm font-semibold text-white hover:bg-[#472066]"
              >
                {saving || submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {saving ? 'Saving' : 'Submitting'}
                  </>
                ) : (
                  primaryActionLabel
                )}
              </Button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((current) => !current)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--customer-border)] bg-[var(--customer-surface)] text-[var(--customer-text-secondary)] transition hover:border-[var(--customer-primary)] hover:text-[var(--customer-primary)]"
                aria-label="RFQ actions"
                aria-expanded={moreMenuOpen}
                aria-haspopup="menu"
              >
                <MoreVertical size={17} />
              </button>
              {moreMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-lg border border-[var(--customer-border)] bg-[var(--customer-surface)] p-1.5 shadow-xl shadow-slate-900/10"
                >
                  <QuotationMenuItem
                    icon={<Eye size={15} />}
                    onClick={() => void openPreview('preview')}
                  >
                    Preview
                  </QuotationMenuItem>
                  <QuotationMenuItem
                    icon={<Printer size={15} />}
                    onClick={() => void openPreview('print')}
                  >
                    {isSubmitted ? 'Print' : 'Print Draft'}
                  </QuotationMenuItem>
                  <QuotationMenuItem
                    icon={<Download size={15} />}
                    onClick={() => void openPreview('download')}
                  >
                    Download PDF
                  </QuotationMenuItem>
                </div>
              )}
            </div>
            </>
          }
        />

        <div role="tablist" aria-label="RFQ sections" className="mx-4 flex border-b border-[var(--customer-border)] sm:mx-5">
          {(['Details', 'Items', 'Review'] as const).map((label) => {
            const section = label.toLowerCase();
            return (
              <button
                key={section}
                type="button"
                role="tab"
                id={`rfq-tab-${section}`}
                aria-controls={`rfq-${section}`}
                aria-selected={activeSection === section}
                tabIndex={activeSection === section ? 0 : -1}
                onClick={() => {
                  setActiveSection(section);
                  setActivePickerKey(null);
                }}
                onKeyDown={(event) => {
                  const tabs = ['details', 'items', 'review'];
                  const index = tabs.indexOf(section);
                  const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
                  if (next === null) return;
                  event.preventDefault();
                  document.getElementById(`rfq-tab-${tabs[next]}`)?.click();
                  document.getElementById(`rfq-tab-${tabs[next]}`)?.focus();
                }}
                className={`border-b-2 px-5 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--customer-primary)] sm:px-8 ${activeSection === section ? 'border-[var(--customer-primary)] text-[var(--customer-primary)]' : 'border-transparent text-[var(--customer-text-muted)] hover:text-[var(--customer-text)]'}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {(error || isSubmitted) && (
          <div className="border-b border-[var(--customer-border)] px-5 py-3">
            {error ? (
              <InlineMessage tone="error" message={error} />
            ) : (
              <InlineMessage
                tone="success"
                message="This RFQ is pending Sales review and is now read-only."
              />
            )}
          </div>
        )}

        <div id="rfq-details" role="tabpanel" hidden={activeSection !== 'details'} tabIndex={0} aria-labelledby="rfq-tab-details" className="scroll-mt-5 focus-visible:outline focus-visible:outline-[var(--customer-primary)]">
          <DocumentSection title="Customer Information">
            <dl className="grid grid-cols-1 gap-5 sm:flex sm:flex-wrap [&>div]:w-full sm:[&>div]:w-[200px] sm:[&>div:last-child]:w-[240px]">
              <InfoField label="Company" value={account?.companyName} />
              <InfoField label="Contact Person" value={user?.name} />
              <InfoField label="Customer ID" value={account?.id} compact copyable />
            </dl>
          </DocumentSection>

          <DocumentSection title="RFQ Details">
            <div
              className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-start [&>*]:w-full sm:[&>*:first-child]:w-[280px] sm:[&>*:nth-child(2)]:w-[240px] sm:[&>*:nth-child(3)]:w-[340px]"
            >
              <Field
                label="Requested Delivery Date"
                controlId="rfq-requested-date"
                errorId="rfq-requested-date-error"
                error={showValidation ? getRequestedDateError(form) : ''}
              >
                <div className="relative">
                  <button
                    type="button"
                    disabled={isSubmitted}
                    onClick={openRequestedDatePicker}
                    className="absolute right-1 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-[var(--customer-text-secondary)] transition hover:text-[var(--customer-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--customer-primary)] disabled:pointer-events-none disabled:opacity-50"
                    aria-label="Open requested delivery date picker"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </button>
                  <Input
                    ref={requestedDateInputRef}
                    id="rfq-requested-date"
                    type="date"
                    min={today}
                    value={form.requestedDate}
                    disabled={isSubmitted}
                    onChange={(event) => updateForm({ requestedDate: event.target.value })}
                    className="pl-3 pr-10 leading-5 [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:opacity-0"
                    aria-describedby={showValidation && getRequestedDateError(form) ? 'rfq-requested-date-error' : undefined}
                    aria-invalid={Boolean(showValidation && getRequestedDateError(form))}
                  />
                </div>
              </Field>

              <Field label="Fulfilment">
                <Select
                  value={form.fulfilmentType}
                  disabled={isSubmitted}
                  onValueChange={(value) =>
                    updateForm({ fulfilmentType: value as QuotationFulfilmentType })
                  }
                >
                  <SelectTrigger className="rounded-md" aria-label="Fulfilment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DELIVERY">Delivery</SelectItem>
                    <SelectItem value="PICKUP">Pick-Up</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {form.fulfilmentType === 'DELIVERY' ? (
                <div className="sm:col-span-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 w-full [&_.ts-control]:!border-[var(--customer-border)] [&_.ts-control]:!shadow-none [&_.ts-wrapper.focus_.ts-control]:!ring-2 [&_.ts-wrapper.focus_.ts-control]:!ring-[var(--customer-primary-soft)]">
                      <Field
                        label="Delivery Location"
                        errorId="rfq-delivery-location-error"
                        error={
                          showValidation && !form.shipToLocationId
                            ? 'Delivery location is required.'
                            : ''
                        }
                      >
                        <NativeTomSelect
                          value={form.shipToLocationId}
                          disabled={isSubmitted}
                          onChange={(event) => updateForm({ shipToLocationId: event.target.value })}
                          className={fieldClass}
                          aria-label="Delivery Location"
                          aria-invalid={showValidation && !form.shipToLocationId}
                          aria-describedby={showValidation && !form.shipToLocationId ? 'rfq-delivery-location-error' : undefined}
                          placeholder=""
                          searchPlaceholder="Search delivery locations..."
                        >
                          <option value="">Select delivery location</option>
                          {deliveryLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name} - {location.city}, {location.region}
                            </option>
                          ))}
                        </NativeTomSelect>
                      </Field>
                    </div>
                    {hasCoordinates && selectedShipTo && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${selectedShipTo.latitude}&mlon=${selectedShipTo.longitude}#map=16/${selectedShipTo.latitude}/${selectedShipTo.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--customer-primary)] hover:text-[var(--customer-primary-hover)]"
                      >
                        <MapPin size={14} /> View Map <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <Field
                    label="Pickup From"
                    error={
                      showValidation && !form.pickupLocationId ? 'Pickup location is required.' : ''
                    }
                  >
                    <NativeTomSelect
                      value={form.pickupLocationId}
                      aria-label="Pickup From"
                      disabled={isSubmitted}
                      onChange={(event) => updateForm({ pickupLocationId: event.target.value })}
                      className={fieldClass}
                    >
                      <option value="">Select pickup location</option>
                      {pickupLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} - {location.city}
                        </option>
                      ))}
                    </NativeTomSelect>
                  </Field>
                </div>
              )}
            </div>
          </DocumentSection>
      <DocumentSection title="Pallet Details">
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-3">
                <p
                  id="pallet-required-label"
                  className="text-sm font-semibold text-[var(--customer-text)]"
                >
                  Pallet Required
                </p>
                <Switch
                  checked={form.palletRequired}
                  disabled={isSubmitted}
                  onCheckedChange={updatePalletRequired}
                  aria-labelledby="pallet-required-label"
                />
              </div>
              <div>
                <p className="mt-0.5 text-xs text-[var(--customer-text-muted)]">
                  Add pallets to this RFQ
                </p>
              </div>
            </div>

            {form.palletRequired && (
              <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-start">
                <div className="w-full sm:w-[300px]">
                  <Field
                    label="Pallet Type"
                    error={palletTypeError}
                    required
                    errorId="pallet-type-error"
                  >
                    <NativeTomSelect
                      value={form.palletType}
                      dropdownPlacement="bottom"
                      disabled={isSubmitted}
                      onChange={(event) => updateForm({ palletType: event.target.value })}
                      className={fieldClass}
                      aria-label="Pallet Type"
                      aria-required="true"
                      aria-invalid={Boolean(palletTypeError)}
                      aria-describedby={palletTypeError ? 'pallet-type-error' : undefined}
                      placeholder="Select pallet type"
                      searchPlaceholder="Search pallet types..."
                    >
                      <option value="">Select pallet type</option>
                      {palletTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </NativeTomSelect>
                  </Field>
                </div>
                <div className="w-full sm:w-[180px]">
                  <Field
                    label="Pallet Quantity"
                    error={palletQuantityError}
                    required
                    errorId="pallet-quantity-error"
                  >
                    <Input
                      type="text"
                      inputMode="numeric"
                      aria-required="true"
                      pattern="[0-9]*"
                      autoComplete="off"
                      value={form.palletQuantity}
                      disabled={isSubmitted}
                      onKeyDown={handlePalletQuantityKeyDown}
                      onPaste={handlePalletQuantityPaste}
                      onBlur={() => setPalletQuantityTouched(true)}
                      onChange={(event) => updatePalletQuantity(event.target.value)}
                      aria-invalid={Boolean(palletQuantityError)}
                      aria-describedby={palletQuantityError ? 'pallet-quantity-error' : undefined}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
      </DocumentSection>
          <DocumentSection title="Commercial Request">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  id="special-price-requested-label"
                  className="text-sm font-semibold text-[var(--customer-text)]"
                >
                  Request Special Price
                </p>
                <p className="mt-0.5 text-xs text-[var(--customer-text-muted)]">
                  Ask Sales to review this RFQ for a special commercial rate.
                </p>
              </div>
              <Switch
                checked={form.specialPriceRequested}
                disabled={isSubmitted}
                onCheckedChange={(specialPriceRequested) => updateForm({ specialPriceRequested })}
                aria-labelledby="special-price-requested-label"
              />
            </div>
          </DocumentSection>
          <DocumentSection title="Special Instructions">
            <div>
              <label htmlFor="rfq-notes" className="sr-only">
                Special Instructions
              </label>
              <Textarea
                id="rfq-notes"
                aria-describedby={showValidation && form.notes.length > 1000 ? 'rfq-notes-error' : undefined}
                value={form.notes}
                maxLength={1000}
                rows={3}
                disabled={isSubmitted}
                onChange={(event) => updateForm({ notes: event.target.value })}
                className="min-h-[72px] resize-y"
                aria-invalid={showValidation && form.notes.length > 1000}
              />
              {showValidation && form.notes.length > 1000 && (
                <p id="rfq-notes-error" className="mt-1 text-xs font-medium text-[var(--customer-danger)]">
                  Use 1000 characters or fewer.
                </p>
              )}
              <p className="mt-1 text-right text-[11px] text-[var(--customer-text-muted)]">{form.notes.length} / 1000</p>
            </div>
          </DocumentSection>
        </div>
      </section>

      <div id="rfq-items" role="tabpanel" hidden={activeSection !== 'items'} tabIndex={0} aria-labelledby="rfq-tab-items" className="focus-visible:outline focus-visible:outline-[var(--customer-primary)]">
      <ItemsTable
        form={form}
        isSubmitted={isSubmitted}
        showValidation={showValidation}
        activePickerKey={activePickerKey}
        productSearch={productSearch}
        productResults={productResults}
        productsLoading={productsLoading}
        selectedRows={selectedRows}
        expandedRows={expandedRows}
        allRowsSelected={allRowsSelected}
        onSetSelectedRows={setSelectedRows}
        onSetExpandedRows={setExpandedRows}
        onSetActivePickerKey={setActivePickerKey}
        onSetProductSearch={setProductSearch}
        onUpdateItem={updateItem}
        onAddRow={addRow}
        onRemoveRow={removeRow}
        onRemoveSelectedRows={removeSelectedRows}
      />
      </div>

      <section id="rfq-review" role="tabpanel" hidden={activeSection !== 'review'} tabIndex={0} aria-labelledby="rfq-tab-review" className="mx-4 scroll-mt-5 py-4 focus-visible:outline focus-visible:outline-[var(--customer-primary)] sm:mx-5">
        <ReviewSummary
          account={account}
          userName={user?.name}
          form={form}
          selectedPickup={selectedPickup}
          selectedShipTo={selectedShipTo}
        />
      </section>

      {showSubmitConfirmation && (
        <ConfirmationDialog
          busy={submitting}
          onCancel={() => setShowSubmitConfirmation(false)}
          onConfirm={() => void submitQuotation()}
        />
      )}
      {previewAction && previewQuotation && account && user && (
        <QuotationPreviewModal
          account={account}
          initialAction={previewAction}
          quotation={previewQuotation}
          user={user}
          phone={dashboard?.administrator.phone ?? dashboard?.contact.phone}
          onClose={() => {
            setPreviewAction(null);
            setPreviewQuotation(null);
          }}
        />
      )}
    </div>
  );
}

const fieldClass =
  'h-10 w-full rounded-md border border-[var(--customer-border)] bg-[var(--customer-input)] px-3 text-sm font-medium text-[var(--customer-text)] outline-none transition placeholder:text-[var(--customer-text-muted)] focus:border-[var(--customer-primary)] focus:ring-2 focus:ring-[var(--customer-primary)] disabled:cursor-not-allowed disabled:opacity-60';
const checkboxClass =
  'h-4 w-4 rounded border-[var(--customer-border)] accent-[var(--customer-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--customer-primary)]';

type ItemsTableProps = {
  form: FormState;
  isSubmitted: boolean;
  showValidation: boolean;
  activePickerKey: string | null;
  productSearch: string;
  productResults: CustomerProduct[];
  productsLoading: boolean;
  selectedRows: Set<string>;
  expandedRows: Set<string>;
  allRowsSelected: boolean;
  onSetSelectedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSetExpandedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSetActivePickerKey: (key: string | null) => void;
  onSetProductSearch: (value: string) => void;
  onUpdateItem: (key: string, patch: Partial<FormItem>) => void;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onRemoveSelectedRows: () => void;
};

function ItemsTable(props: ItemsTableProps) {
  const { form, isSubmitted, selectedRows, expandedRows } = props;
  return (
    <section aria-label="RFQ items" className="mx-4 overflow-visible border-b border-[var(--customer-border)] py-4 sm:mx-5">
      <div className="pb-4">
        <h2 className="text-sm font-semibold text-[var(--customer-primary)]">Items</h2>
      </div>
      <div className={`overflow-x-auto ${props.activePickerKey ? 'pb-72' : ''}`}>
        <div className="min-w-[940px]">
          <div className="grid grid-cols-[44px_170px_minmax(280px,1fr)_130px_110px_130px_48px] items-center border-b border-[var(--customer-border)] bg-[var(--customer-surface-secondary)] px-3 py-2.5 text-xs font-semibold text-[var(--customer-text-secondary)]">
            {!isSubmitted ? (
              <input
                type="checkbox"
                checked={props.allRowsSelected}
                onChange={(event) =>
                  props.onSetSelectedRows(
                    event.target.checked ? new Set(form.items.map((item) => item.key)) : new Set(),
                  )
                }
                aria-label="Select all RFQ items"
                className={checkboxClass}
              />
            ) : (
              <span />
            )}
            <span>Item Code</span>
            <span>Item Name</span>
            <span>Quantity (TON)</span>
            <span>UOM</span>
            <span>Packaging</span>
            <span>Action</span>
          </div>

          {form.items.map((item, index) => (
            <QuotationItemRow
              key={item.key}
              item={item}
              selected={selectedRows.has(item.key)}
              expanded={expandedRows.has(item.key)}
              readOnly={isSubmitted}
              pickerOpen={props.activePickerKey === item.key}
              searchValue={props.activePickerKey === item.key ? props.productSearch : ''}
              products={props.productResults}
              productsLoading={props.productsLoading}
              errors={props.showValidation ? getItemErrors(item, index) : {}}
              onSelectedChange={(selected) =>
                props.onSetSelectedRows((current) => {
                  const next = new Set(current);
                  if (selected) next.add(item.key);
                  else next.delete(item.key);
                  return next;
                })
              }
              onPickerOpen={() => {
                props.onSetProductSearch('');
                props.onSetActivePickerKey(item.key);
              }}
              onPickerClose={() => props.onSetActivePickerKey(null)}
              onSearchChange={props.onSetProductSearch}
              onChange={(patch) => props.onUpdateItem(item.key, patch)}
              onRemove={() => props.onRemoveRow(item.key)}
              onToggleExpanded={() =>
                props.onSetExpandedRows((current) => {
                  const next = new Set(current);
                  if (next.has(item.key)) next.delete(item.key);
                  else next.add(item.key);
                  return next;
                })
              }
            />
          ))}
        </div>
      </div>
      {!isSubmitted && (
        <button
          type="button"
          onClick={props.onAddRow}
          className="my-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--customer-primary)] hover:text-[var(--customer-primary-hover)]"
        >
          <Plus size={15} /> Add Row
        </button>
      )}
      {!isSubmitted && selectedRows.size > 0 && (
        <div className="flex min-h-12 items-center justify-between border-t border-[var(--customer-border)] bg-[var(--customer-surface-secondary)] px-5 py-2">
          <span className="text-xs font-medium text-[var(--customer-text-muted)]">{selectedRows.size} selected</span>
          <button
            type="button"
            onClick={props.onRemoveSelectedRows}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-[var(--customer-danger)] hover:bg-[var(--customer-danger-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={14} /> Remove
          </button>
        </div>
      )}
    </section>
  );
}

type QuotationItemRowProps = {
  item: FormItem;
  selected: boolean;
  expanded: boolean;
  readOnly: boolean;
  pickerOpen: boolean;
  searchValue: string;
  products: CustomerProduct[];
  productsLoading: boolean;
  errors: Partial<Record<'product' | 'quantity', string>>;
  onSelectedChange: (selected: boolean) => void;
  onPickerOpen: () => void;
  onPickerClose: () => void;
  onSearchChange: (value: string) => void;
  onChange: (patch: Partial<FormItem>) => void;
  onRemove: () => void;
  onToggleExpanded: () => void;
};

function QuotationItemRow(props: QuotationItemRowProps) {
  const { item, errors } = props;
  const [quantityInputError, setQuantityInputError] = useState('');
  const quantityError = errors.quantity || quantityInputError;
  const packagingQuantity = item.product
    ? packagingQuantityForTons(Number(item.quantity), item.product.unitWeightKg, item.product.uom)
    : null;

  return (
    <div className="border-b border-[var(--customer-border)] last:border-b-0">
      <div className="grid min-h-[58px] grid-cols-[44px_170px_minmax(280px,1fr)_130px_110px_130px_48px] items-center px-3 text-sm hover:bg-[var(--customer-surface-secondary)]">
        {!props.readOnly ? (
          <input
            type="checkbox"
            checked={props.selected}
            onChange={(event) => props.onSelectedChange(event.target.checked)}
            aria-label={`Select ${item.product?.productName ?? 'blank item'}`}
            className={checkboxClass}
          />
        ) : (
          <span />
        )}

        <div className="relative pr-3">
          {item.product && !props.pickerOpen ? (
            <button
              type="button"
              disabled={props.readOnly}
              onClick={props.onPickerOpen}
              className="w-full truncate text-left text-sm font-semibold text-[var(--customer-text)] disabled:cursor-default"
            >
              {item.product.productCode}
            </button>
          ) : (
            <div className="relative">
              <input
                autoFocus={props.pickerOpen}
                value={props.searchValue}
                disabled={props.readOnly}
                onFocus={props.onPickerOpen}
                onChange={(event) => props.onSearchChange(event.target.value)}
                className={`${fieldClass} h-9 pr-8`}
                aria-label="Search item code or name"
                aria-invalid={Boolean(errors.product)}
                aria-describedby={errors.product ? `product-error-${item.key}` : undefined}
              />
              {props.pickerOpen && (
                <button
                  type="button"
                  onClick={props.onPickerClose}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--customer-text-muted)] hover:text-[var(--customer-text)]"
                  aria-label="Close product picker"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          {props.pickerOpen && !props.readOnly && (
            <ProductPicker
              products={props.products}
              loading={props.productsLoading}
              selectedProductId={item.product?.id}
              onSelect={(product) => {
                props.onChange({
                  product,
                });
                props.onPickerClose();
              }}
            />
          )}
          {errors.product && <RowError id={`product-error-${item.key}`} message={errors.product} />}
        </div>

        <div className="flex min-w-0 items-center gap-3 pr-4">
          {item.product ? (
            <>
              <ProductImage
                image={item.product.image}
                productName={item.product.productName}
                size="thumbnail"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--customer-text)]">
                  {item.product.productName}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[var(--customer-text-muted)]">
                  {item.product.shortDescription || item.product.category}
                </span>
              </span>
            </>
          ) : (
            <span className="text-sm text-[var(--customer-text-muted)]">Item details appear after selection</span>
          )}
        </div>

        <div className="pr-3">
          <CommercialTonInput
            autoComplete="off"
            value={item.quantity}
            disabled={props.readOnly}
            onValueChange={(value) => {
              setQuantityInputError('');
              props.onChange({ quantity: value });
            }}
            onInvalidValue={setQuantityInputError}
            aria-label={`Quantity (TON) for ${item.product?.productName ?? 'blank item'}`}
            aria-describedby={quantityError ? `quantity-error-${item.key}` : undefined}
            className={`${fieldClass} h-9`}
            aria-invalid={Boolean(quantityError)}
          />
          {quantityError && <RowError id={`quantity-error-${item.key}`} message={quantityError} />}
          {packagingQuantity !== null && (
            <p className="mt-1 text-[11px] text-[var(--customer-text-muted)]">
              Equivalent: {formatQuantity(packagingQuantity)} bags
            </p>
          )}
        </div>
        <CompactValue value={item.product ? 'TON' : '—'} />
        <CompactValue value={item.product?.packagingType ?? '—'} />
        {!props.readOnly ? (
          <button
            type="button"
            onClick={props.onRemove}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--customer-text-secondary)] hover:bg-[var(--customer-danger-soft)] hover:text-[var(--customer-danger)]"
            title="Remove item"
            aria-label={`Remove ${item.product?.productName ?? 'blank item'}`}
          >
            <Trash2 size={15} />
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function ProductPicker({
  products,
  loading,
  selectedProductId,
  onSelect,
}: {
  products: CustomerProduct[];
  loading: boolean;
  selectedProductId?: string | undefined;
  onSelect: (product: CustomerProduct) => void;
}) {
  return (
    <div className="absolute left-0 top-11 z-30 max-h-72 w-[390px] overflow-y-auto rounded-lg border border-[var(--customer-border)] bg-[var(--customer-surface)] text-[var(--customer-text)] shadow-xl shadow-slate-900/10">
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-4 text-sm text-[var(--customer-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading products
        </div>
      ) : products.length === 0 ? (
        <p className="px-3 py-4 text-sm text-[var(--customer-text-muted)]">No active products found.</p>
      ) : (
        products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product)}
            className={`flex w-full items-center gap-3 border-b border-[var(--customer-border)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--customer-primary-soft)] ${selectedProductId === product.id ? 'bg-[var(--customer-primary-soft)]' : ''}`}
          >
            <ProductImage
              image={product.image}
              productName={product.productName}
              size="thumbnail"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-[var(--customer-primary)]">
                {product.productCode}
              </span>
              <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--customer-text)]">
                {product.productName}
              </span>
              <span className="mt-0.5 block truncate text-xs text-[var(--customer-text-muted)]">
                {product.packagingType} · {product.uom}
              </span>
            </span>
            {selectedProductId === product.id && <Check size={16} className="text-[var(--customer-primary)]" />}
          </button>
        ))
      )}
    </div>
  );
}

function ReviewSummary({
  account,
  userName,
  form,
  selectedPickup,
  selectedShipTo,
}: {
  account: { companyName?: string | null } | null;
  userName: string | null | undefined;
  form: FormState;
  selectedPickup: PickupLocation | undefined;
  selectedShipTo: CustomerLocation | undefined;
}) {
  const fulfilmentLabel = form.fulfilmentType === 'DELIVERY' ? 'Delivery' : 'Pick-Up';
  const locationLabel =
    form.fulfilmentType === 'DELIVERY'
      ? formatCustomerLocation(selectedShipTo)
      : formatPickupLocation(selectedPickup);
  const visibleItems = form.items.filter((item) => item.product || item.quantity);

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-[var(--customer-primary)]">Review</h2>

      <ReviewSection title="Customer">
        <ReviewRow label="Company" value={account?.companyName} />
        <ReviewRow label="Contact Person" value={userName} />
      </ReviewSection>

      <ReviewSection title="RFQ Details">
        <ReviewRow label="Delivery Date" value={formatReviewDate(form.requestedDate)} />
        <ReviewRow label="Fulfilment" value={fulfilmentLabel} />
        <ReviewRow
          label="Special Price Requested"
          value={form.specialPriceRequested ? 'Yes' : 'No'}
        />
        <ReviewRow
          label={form.fulfilmentType === 'DELIVERY' ? 'Delivery Location' : 'Pickup From'}
          value={locationLabel}
        />
      </ReviewSection>

      <ReviewSection title="Pallet">
        <ReviewRow label="Required" value={form.palletRequired ? 'Yes' : 'No'} />
        {form.palletRequired && (
          <>
            <ReviewRow label="Pallet Type" value={form.palletType} />
            <ReviewRow label="Pallet Quantity" value={form.palletQuantity} />
          </>
        )}
      </ReviewSection>

      <ReviewSection title="Items">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[minmax(240px,1fr)_130px_100px_140px] border-b border-[var(--customer-border)] py-2 text-xs font-semibold text-[var(--customer-text-secondary)]">
              <span>Item</span>
              <span>Quantity</span>
              <span>UOM</span>
              <span>Packaging</span>
            </div>
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => (
                <div
                  key={item.key}
                  className="grid grid-cols-[minmax(240px,1fr)_130px_100px_140px] border-b border-[var(--customer-border)] py-2 text-sm last:border-b-0"
                >
                  <span className="truncate pr-4 font-medium text-[var(--customer-text)]">
                    {item.product?.productName ?? 'Not selected'}
                  </span>
                  <span className="text-[var(--customer-text)]">
                    {item.quantity ? formatCommercialTonValue(Number(item.quantity)) : 'Not provided'}
                  </span>
                  <span className="text-[var(--customer-text-secondary)]">
                    {item.product ? 'TON' : 'Not provided'}
                  </span>
                  <span className="text-[var(--customer-text-secondary)]">
                    {item.product?.packagingType ?? 'Not provided'}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-2 text-sm text-[var(--customer-text-muted)]">No items added</p>
            )}
          </div>
        </div>
      </ReviewSection>

      <ReviewSection title="Special Instructions">
        <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--customer-text)]">
          {form.notes.trim() || 'No special instructions'}
        </p>
      </ReviewSection>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-[var(--customer-border)] pb-4 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--customer-text-secondary)]">
        {title}
      </h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
      <span className="font-medium text-[var(--customer-text-secondary)]">{label}</span>
      <span className="min-w-0 text-[var(--customer-text)]">{value || 'Not provided'}</span>
    </div>
  );
}

function DocumentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-4 border-b border-[var(--customer-border)] py-4 sm:mx-5">
      <h2 className="text-sm font-semibold text-[var(--customer-primary)]">
        {title}
      </h2>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function InfoField({
  label,
  value,
  compact = false,
  copyable = false,
}: {
  label: string;
  value: string | null | undefined;
  compact?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--customer-text-secondary)]">{label}</dt>
      <dd className="mt-1 flex min-w-0 items-center gap-2" title={value ?? undefined}>
        <span
          className={`flex h-10 min-w-0 flex-1 items-center rounded-md border border-[var(--customer-border)] bg-[var(--customer-surface-secondary)] px-3 font-medium text-[var(--customer-text)] ${
            compact
              ? 'text-[13px] leading-5'
              : 'text-sm leading-5'
          }`}
        >
          <span className="truncate">{value || 'Not provided'}</span>
        </span>
        {copyable && value && (
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(value)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--customer-text-secondary)] hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--customer-primary)]"
            title={`Copy ${label}`}
            aria-label={`Copy ${label}`}
          >
            <Copy size={13} />
          </button>
        )}
      </dd>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  required = false,
  errorId,
  controlId,
}: {
  label: string;
  children: ReactNode;
  error?: string | undefined;
  required?: boolean;
  errorId?: string | undefined;
  controlId?: string | undefined;
}) {
  const Wrapper = controlId ? 'div' : 'label';
  const labelContent = (
    <>
      {label}
      {required && (
        <>
          <span aria-hidden="true"> *</span>
          <span className="sr-only"> required</span>
        </>
      )}
    </>
  );
  return (
    <Wrapper className="block min-w-0">
      {controlId ? (
        <label htmlFor={controlId} className="mb-1.5 block text-xs font-medium text-[var(--customer-text-secondary)]">
          {labelContent}
        </label>
      ) : (
        <span className="mb-1.5 block text-xs font-medium text-[var(--customer-text-secondary)]">
          {labelContent}
        </span>
      )}
      {children}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-[var(--customer-danger)]">
          {error}
        </p>
      )}
    </Wrapper>
  );
}

function CompactValue({ value }: { value: string }) {
  return (
    <span className="mr-3 flex h-9 items-center rounded-md bg-[var(--customer-surface-secondary)] px-3 text-xs font-medium text-[var(--customer-text-secondary)]">
      {value}
    </span>
  );
}

function RowError({ message, id }: { message: string; id?: string }) {
  return <p id={id} className="mt-1 text-[11px] font-medium text-[var(--customer-danger)]">{message}</p>;
}

function InlineMessage({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const errorTone = tone === 'error';
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${errorTone ? 'bg-[var(--customer-danger-soft)] text-[var(--customer-danger)]' : 'bg-[var(--customer-success-soft)] text-[var(--customer-success)]'}`}
    >
      {errorTone ? <AlertCircle size={15} /> : <Check size={15} />}
      {message}
    </div>
  );
}

function QuotationMenuItem({
  children,
  icon,
  onClick,
}: {
  children: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-[var(--customer-text-secondary)] transition hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)]"
    >
      {icon}
      {children}
    </button>
  );
}

function ConfirmationDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit RFQ?</DialogTitle>
          <DialogDescription className="leading-6">
            Are you sure you want to submit this RFQ to the Sales Team? Once submitted,
            it cannot be edited.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-9 rounded-lg border-[var(--customer-border)] px-4 text-sm font-semibold text-[var(--customer-text-secondary)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            aria-busy={busy}
            className="h-9 gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-semibold text-white hover:bg-[#472066]"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting
              </>
            ) : (
              'Submit RFQ'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function playFeedbackSound(src: string) {
  if (typeof window === 'undefined') return;
  const audio = new Audio(src);
  audio.volume = 0.28;
  void audio.play().catch(() => undefined);
}

function QuotationSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-64 animate-pulse rounded-lg border border-[var(--customer-border)] bg-[var(--customer-surface)]" />
      <div className="h-72 animate-pulse rounded-lg border border-[var(--customer-border)] bg-[var(--customer-surface)]" />
    </div>
  );
}

function getRequestedDateError(form: FormState) {
  if (!form.requestedDate) return 'Requested delivery date is required.';
  if (form.requestedDate < today) return 'Requested delivery date cannot be in the past.';
  return '';
}

function getItemErrors(item: FormItem, index: number) {
  const errors: Partial<Record<'product' | 'quantity', string>> = {};
  if (!item.product) errors.product = `Item ${index + 1} is required.`;
  if (!isWholeTonQuantity(Number(item.quantity))) errors.quantity = wholeTonQuantityMessage;
  return errors;
}

function getPalletQuantityError(value: string, inputError = '') {
  if (inputError) return inputError;
  if (!value) return 'Enter pallet quantity.';
  if (!digitsOnly(value)) return 'Enter a valid whole number of pallets.';
  if (Number(value) < 1) return 'Pallet quantity must be at least 1.';
  return '';
}

function digitsOnly(value: string) {
  return /^\d*$/.test(value);
}

function isPermittedTextInputKey(event: KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey) return true;
  return [
    'Backspace',
    'Delete',
    'Tab',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
  ].includes(event.key);
}

function validateForm(form: FormState) {
  const errors: string[] = [];
  if (form.fulfilmentType === 'PICKUP' && !form.pickupLocationId)
    errors.push('Pickup location is required.');
  if (!form.shipToLocationId) errors.push('Delivery location is required.');
  if (!form.requestedDate) errors.push('Requested delivery date is required.');
  if (form.requestedDate && form.requestedDate < today)
    errors.push('Requested delivery date cannot be in the past.');
  if (form.palletRequired && !form.palletType.trim()) errors.push('Select a pallet type.');
  const palletQuantityError = form.palletRequired ? getPalletQuantityError(form.palletQuantity) : '';
  if (palletQuantityError) errors.push(palletQuantityError);
  form.items.forEach((item, index) =>
    errors.push(
      ...Object.values(getItemErrors(item, index)).filter((message): message is string =>
        Boolean(message),
      ),
    ),
  );
  if (form.notes.length > 1000)
    errors.push('Special instructions must be 1000 characters or fewer.');
  return errors;
}

function formatReviewDate(value: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatCustomerLocation(location: CustomerLocation | undefined) {
  if (!location) return '';
  return [location.name, location.city, location.region].filter(Boolean).join(' - ');
}

function formatPickupLocation(location: PickupLocation | undefined) {
  if (!location) return '';
  return [location.name, location.city].filter(Boolean).join(' - ');
}

function toPayload(form: FormState): CustomerQuotationPayload {
  const payload: CustomerQuotationPayload = {
    fulfilmentType: form.fulfilmentType,
    shipToLocationId: form.shipToLocationId,
    requestedDate: form.requestedDate,
    specialPriceRequested: form.specialPriceRequested,
    items: form.items.map((item) => {
      const line: CustomerQuotationPayload['items'][number] = {
        productId: item.product?.id ?? '',
        quantityTon: Number(item.quantity),
        palletRequired: form.palletRequired,
      };
      return form.palletRequired
        ? {
            ...line,
            palletType: form.palletType.trim(),
            palletQuantity: Number(form.palletQuantity),
          }
        : line;
    }),
  };
  if (form.fulfilmentType === 'PICKUP') payload.pickupLocationId = form.pickupLocationId;
  if (form.notes.trim()) payload.notes = form.notes.trim();
  return payload;
}

function fromQuotation(quotation: CustomerQuotation): FormState {
  const palletLine = quotation.items.find((item) => item.palletRequired);
  return {
    fulfilmentType: quotation.fulfilmentType,
    pickupLocationId: quotation.pickupLocationId ?? '',
    shipToLocationId: quotation.shipToLocationId ?? '',
    requestedDate: quotation.requestedDate ?? '',
    specialPriceRequested: quotation.specialPriceRequested,
    palletRequired: Boolean(palletLine),
    palletType: palletLine?.palletType ?? '',
    palletQuantity: palletLine?.palletQuantity ? String(palletLine.palletQuantity) : '',
    notes: quotation.notes ?? '',
    items: quotation.items.map((item) => ({
      key: item.id,
      product: {
        ...item.product,
        displayOrder: 0,
        priceDisplay: 'PRICE_ON_REQUEST',
        listPricePerTon: null,
        priceCurrency: 'SAR',
        priceUnit: 'TON',
        isActive: true,
        createdAt: quotation.createdAt,
        updatedAt: quotation.updatedAt,
      },
      quantity: String(item.quantityTon),
    })),
  };
}

function serializeForm(form: FormState) {
  return JSON.stringify({
    fulfilmentType: form.fulfilmentType,
    pickupLocationId: form.pickupLocationId,
    shipToLocationId: form.shipToLocationId,
    requestedDate: form.requestedDate,
    specialPriceRequested: form.specialPriceRequested,
    palletRequired: form.palletRequired,
    palletType: form.palletType,
    palletQuantity: form.palletQuantity,
    notes: form.notes,
    items: form.items.map((item) => ({
      productId: item.product?.id ?? null,
      quantity: item.quantity,
    })),
  });
}

function formatQuotationStatus(status: CustomerQuotation['status'] | undefined) {
  const labels: Record<CustomerQuotation['status'], string> = {
    DRAFT: 'Draft',
    PENDING_SALES_REVIEW: 'Pending Sales Review',
    UNDER_REVIEW: 'Under Review',
    PENDING_HADER_APPROVAL: 'Pending Hader Approval',
    PENDING_PRICE_APPROVAL: 'Pending Price Approval',
    READY_FOR_CUSTOMER: 'Ready for Customer',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    CLARIFICATION_REQUESTED: 'Clarification Requested',
  };
  return status ? labels[status] : 'Draft';
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}
