import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Eye,
  ExternalLink,
  Loader2,
  MapPin,
  MoreVertical,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { getCustomerProducts, type CustomerProduct } from '../../services/customerProductsService';
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
import { packagingQuantityForTons } from '../../utils/commercialQuantity';
import { useNavigate, useParams } from 'react-router-dom';

type FormItem = {
  key: string;
  product: CustomerProduct | null;
  quantity: string;
  palletRequired: boolean;
  palletType: string;
  palletQuantity: string;
};

type FormState = {
  fulfilmentType: QuotationFulfilmentType;
  pickupLocationId: string;
  shipToLocationId: string;
  requestedDate: string;
  notes: string;
  items: FormItem[];
};

const draftStorageKey = 'alsafwa_customer_quotation_draft_id';
const writableRoles = new Set(['CUSTOMER_ADMIN', 'PURCHASER']);
const today = new Date().toISOString().slice(0, 10);

const initialItem = (): FormItem => ({
  key: createClientId(),
  product: null,
  quantity: '',
  palletRequired: false,
  palletType: '',
  palletQuantity: '',
});

const createInitialForm = (): FormState => ({
  fulfilmentType: 'DELIVERY',
  pickupLocationId: '',
  shipToLocationId: '',
  requestedDate: '',
  notes: '',
  items: [initialItem()],
});

export function CustomerQuotationNew() {
  const navigate = useNavigate();
  const { id: routeQuotationId } = useParams<{ id: string }>();
  const { account, user } = useCustomerAuth();
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
  const [savedMessage, setSavedMessage] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [previewAction, setPreviewAction] = useState<QuotationPreviewAction | null>(null);
  const [previewQuotation, setPreviewQuotation] = useState<CustomerQuotation | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const firstInvalidRef = useRef<HTMLDivElement>(null);

  const selectedShipTo = deliveryLocations.find(
    (location) => location.id === form.shipToLocationId,
  );
  const hasCoordinates =
    typeof selectedShipTo?.latitude === 'number' && typeof selectedShipTo.longitude === 'number';
  const validationErrors = useMemo(() => validateForm(form), [form]);
  const isValid = validationErrors.length === 0;
  const isSubmitted = Boolean(quotation && quotation.status !== 'DRAFT');
  const documentTitle = quotation?.reference ?? 'New Quotation';
  const currentSnapshot = useMemo(() => serializeForm(form), [form]);
  const isDirty = currentSnapshot !== lastSavedSnapshot;
  const allRowsSelected =
    form.items.length > 0 && form.items.every((item) => selectedRows.has(item.key));

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
          shipToLocationId: locations.find((location) => location.isPrimary)?.id ?? '',
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

        setForm(nextForm);
        setLastSavedSnapshot(serializeForm(nextForm));
      } catch {
        setError('Unable to load quotation setup. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadFoundation();
  }, [routeQuotationId]);

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

  const saveDraft = useCallback(async () => {
    setError('');
    setSavedMessage('');
    setShowValidation(true);

    if (!isValid) {
      window.requestAnimationFrame(() =>
        firstInvalidRef.current?.scrollIntoView({ behavior: 'smooth' }),
      );
      return null;
    }

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
      setSavedMessage('Saved just now');
      return saved;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save quotation draft.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [form, isValid, quotationId]);

  const submitQuotation = useCallback(async () => {
    setError('');
    setSavedMessage('');
    setShowValidation(true);
    setShowSubmitConfirmation(false);

    if (!isValid) {
      window.requestAnimationFrame(() =>
        firstInvalidRef.current?.scrollIntoView({ behavior: 'smooth' }),
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = toPayload(form);
      const saved = quotationId
        ? await updateCustomerQuotation(quotationId, payload)
        : await createCustomerQuotation(payload);
      const submitted = await submitCustomerQuotation(saved.id);

      setQuotationId(submitted.id);
      setQuotation(submitted);
      setLastSavedSnapshot(serializeForm(form));
      localStorage.removeItem(draftStorageKey);
      navigate(`/customer/quotations/${submitted.id}`, { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to submit quotation request.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, isValid, navigate, quotationId]);

  useEffect(() => {
    const handleKeyboardSave = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's' || isSubmitted)
        return;

      event.preventDefault();
      if (!isDirty && quotationId) {
        setShowSubmitConfirmation(true);
        return;
      }

      void saveDraft();
    };

    window.addEventListener('keydown', handleKeyboardSave);
    return () => window.removeEventListener('keydown', handleKeyboardSave);
  }, [isDirty, isSubmitted, quotationId, saveDraft]);

  if (!canManageQuotation) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        Your role does not have permission to create quotations.
      </section>
    );
  }

  if (loading) return <QuotationSkeleton />;

  const updateItem = (key: string, patch: Partial<FormItem>) => {
    setSavedMessage('');
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  };

  const addRow = () => {
    setSavedMessage('');
    setForm((current) => ({ ...current, items: [...current.items, initialItem()] }));
  };

  const removeSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setSavedMessage('');
    setForm((current) => {
      const remaining = current.items.filter((item) => !selectedRows.has(item.key));
      return { ...current, items: remaining.length > 0 ? remaining : [initialItem()] };
    });
    setSelectedRows(new Set());
  };

  const updateForm = (patch: Partial<FormState>) => {
    setSavedMessage('');
    setForm((current) => ({ ...current, ...patch }));
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

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-3">
      <section className="overflow-visible rounded-lg border border-[#e3e1e8] bg-white">
        <header className="flex min-h-[58px] flex-col gap-3 border-b border-[#eceaf0] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold text-[#1a1b23]">{documentTitle}</h1>
            <StatusDot label={formatQuotationStatus(quotation?.status)} submitted={isSubmitted} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isSubmitted && (
              <div className="hidden items-center gap-4 text-xs font-medium text-[#64748b] md:flex">
                <span>Ctrl + S to save draft</span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  />
                  {saving
                    ? 'Saving...'
                    : isDirty
                      ? 'Unsaved changes'
                      : savedMessage || (quotationId ? 'Saved' : 'Not saved yet')}
                </span>
              </div>
            )}
            {!isSubmitted && (
              <button
                type="button"
                onClick={() => void submitQuotation()}
                disabled={saving || submitting}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[#54247a] px-5 text-sm font-semibold text-white transition hover:bg-[#472066] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((current) => !current)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3e1e8] bg-white text-slate-600 transition hover:border-[#54247a] hover:text-[#54247a]"
                aria-label="Quotation actions"
                aria-expanded={moreMenuOpen}
                aria-haspopup="menu"
              >
                <MoreVertical size={17} />
              </button>
              {moreMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-lg border border-[#e3e1e8] bg-white p-1.5 shadow-xl shadow-slate-900/10"
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
          </div>
        </header>

        {(error || isSubmitted) && (
          <div className="border-b border-[#eceaf0] px-5 py-3">
            {error ? (
              <InlineMessage tone="error" message={error} />
            ) : (
              <InlineMessage
                tone="success"
                message="This quotation is pending Sales review and is now read-only."
              />
            )}
          </div>
        )}

        <div className="grid divide-y divide-[#eceaf0] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <DocumentSection title="Customer Information">
            <dl className="grid gap-3 sm:grid-cols-[minmax(120px,0.8fr)_minmax(110px,0.7fr)_minmax(240px,1.5fr)] sm:gap-3">
              <InfoField label="Company" value={account?.companyName} />
              <InfoField label="Contact Person" value={user?.name} />
              <InfoField label="Customer ID" value={account?.id} compact />
            </dl>
          </DocumentSection>

          <DocumentSection title="Quotation Details">
            <div
              ref={validationErrors.length > 0 ? firstInvalidRef : undefined}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field
                label="Requested Delivery Date"
                error={showValidation ? getRequestedDateError(form) : ''}
              >
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    min={today}
                    value={form.requestedDate}
                    disabled={isSubmitted}
                    onChange={(event) => updateForm({ requestedDate: event.target.value })}
                    className={`${fieldClass} pl-9`}
                  />
                </div>
              </Field>

              <Field label="Fulfilment">
                <select
                  value={form.fulfilmentType}
                  disabled={isSubmitted}
                  onChange={(event) =>
                    updateForm({ fulfilmentType: event.target.value as QuotationFulfilmentType })
                  }
                  className={fieldClass}
                >
                  <option value="DELIVERY">Delivery</option>
                  <option value="PICKUP">Pick-Up</option>
                </select>
              </Field>

              {form.fulfilmentType === 'DELIVERY' ? (
                <div className="sm:col-span-2">
                  <div className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <Field
                        label="Delivery Location"
                        error={
                          showValidation && !form.shipToLocationId
                            ? 'Delivery location is required.'
                            : ''
                        }
                      >
                        <select
                          value={form.shipToLocationId}
                          disabled={isSubmitted}
                          onChange={(event) => updateForm({ shipToLocationId: event.target.value })}
                          className={fieldClass}
                        >
                          <option value="">Select delivery location</option>
                          {deliveryLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name} - {location.city}, {location.region}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    {hasCoordinates && selectedShipTo && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${selectedShipTo.latitude}&mlon=${selectedShipTo.longitude}#map=16/${selectedShipTo.latitude}/${selectedShipTo.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-0.5 inline-flex h-9 shrink-0 items-center gap-1.5 px-2 text-xs font-semibold text-[#54247a] hover:text-[#472066]"
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
                    <select
                      value={form.pickupLocationId}
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
                    </select>
                  </Field>
                </div>
              )}
            </div>
          </DocumentSection>
        </div>
      </section>

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
        onRemoveSelectedRows={removeSelectedRows}
      />

      <section className="rounded-lg border border-[#e3e1e8] bg-white px-5 py-4">
        <Field
          label="Special Instructions"
          error={showValidation && form.notes.length > 1000 ? 'Use 1000 characters or fewer.' : ''}
        >
          <textarea
            value={form.notes}
            maxLength={1000}
            rows={3}
            disabled={isSubmitted}
            onChange={(event) => updateForm({ notes: event.target.value })}
            placeholder="Optional delivery/site requirements or quotation comments"
            className="w-full resize-y rounded-lg border border-[#e3e1e8] bg-white px-3 py-2.5 text-sm text-[#1a1b23] outline-none transition placeholder:text-slate-400 focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10 disabled:bg-slate-50"
          />
          <p className="mt-1 text-right text-[11px] text-slate-400">{form.notes.length} / 1000</p>
        </Field>
      </section>

      <p className="px-1 text-xs font-medium text-[#64748b]">
        Last saved: {quotationId ? savedMessage || 'Draft available' : 'Not saved yet'}
      </p>

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
  'h-10 w-full rounded-lg border border-[#e3e1e8] bg-white px-3 text-sm font-medium text-[#1a1b23] outline-none transition placeholder:text-slate-400 focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10 disabled:bg-slate-50 disabled:text-slate-600';
const checkboxClass =
  'h-4 w-4 rounded border-slate-300 text-[#54247a] accent-[#54247a] focus:ring-[#54247a]';

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
  onRemoveSelectedRows: () => void;
};

function ItemsTable(props: ItemsTableProps) {
  const { form, isSubmitted, selectedRows, expandedRows } = props;
  return (
    <section className="overflow-visible rounded-lg border border-[#e3e1e8] bg-white">
      <div className="border-b border-[#eceaf0] px-5 py-3">
        <h2 className="text-sm font-semibold text-[#54247a]">Items</h2>
      </div>
      <div className={`overflow-x-auto ${props.activePickerKey ? 'pb-72' : ''}`}>
        <div className="min-w-[940px]">
          <div className="grid grid-cols-[44px_170px_minmax(280px,1fr)_130px_110px_130px_48px] items-center border-b border-[#e3e1e8] bg-[#f8fafc] px-3 py-2.5 text-xs font-semibold text-[#4b4d5c]">
            {!isSubmitted ? (
              <input
                type="checkbox"
                checked={props.allRowsSelected}
                onChange={(event) =>
                  props.onSetSelectedRows(
                    event.target.checked ? new Set(form.items.map((item) => item.key)) : new Set(),
                  )
                }
                aria-label="Select all quotation items"
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
            <span />
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
          className="mx-4 my-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#54247a] hover:text-[#472066]"
        >
          <Plus size={15} /> Add Row
        </button>
      )}
      {!isSubmitted && (
        <div className="flex min-h-12 items-center justify-between border-t border-[#eceaf0] bg-[#fdfbfd] px-5 py-2">
          <span className="text-xs font-medium text-[#64748b]">{selectedRows.size} selected</span>
          <button
            type="button"
            disabled={selectedRows.size === 0}
            onClick={props.onRemoveSelectedRows}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
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
  errors: Partial<Record<'product' | 'quantity' | 'palletType' | 'palletQuantity', string>>;
  onSelectedChange: (selected: boolean) => void;
  onPickerOpen: () => void;
  onPickerClose: () => void;
  onSearchChange: (value: string) => void;
  onChange: (patch: Partial<FormItem>) => void;
  onToggleExpanded: () => void;
};

function QuotationItemRow(props: QuotationItemRowProps) {
  const { item, errors } = props;
  const bagProduct = item.product?.packagingType.toLowerCase().includes('bag') ?? false;
  const packagingQuantity = item.product
    ? packagingQuantityForTons(Number(item.quantity), item.product.unitWeightKg, item.product.uom)
    : null;

  return (
    <div className="border-b border-[#eceaf0] last:border-b-0">
      <div className="grid min-h-[58px] grid-cols-[44px_170px_minmax(280px,1fr)_130px_110px_130px_48px] items-center px-3 text-sm hover:bg-[#fdfbfd]">
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
              className="w-full truncate text-left text-sm font-semibold text-[#1a1b23] disabled:cursor-default"
            >
              {item.product.productCode}
            </button>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus={props.pickerOpen}
                value={props.searchValue}
                disabled={props.readOnly}
                onFocus={props.onPickerOpen}
                onChange={(event) => props.onSearchChange(event.target.value)}
                placeholder="Search item"
                className={`${fieldClass} h-9 pl-8 pr-8`}
              />
              {props.pickerOpen && (
                <button
                  type="button"
                  onClick={props.onPickerClose}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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
                const nextIsBag = product.packagingType.toLowerCase().includes('bag');
                props.onChange({
                  product,
                  palletRequired: nextIsBag ? item.palletRequired : false,
                  palletType: nextIsBag ? item.palletType : '',
                  palletQuantity: nextIsBag ? item.palletQuantity : '',
                });
                props.onPickerClose();
              }}
            />
          )}
          {errors.product && <RowError message={errors.product} />}
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
                <span className="block truncate text-sm font-semibold text-[#1a1b23]">
                  {item.product.productName}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[#64748b]">
                  {item.product.shortDescription || item.product.category}
                </span>
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-400">Select an item</span>
          )}
        </div>

        <div className="pr-3">
          <input
            type="number"
            min="0"
            step="0.001"
            inputMode="decimal"
            value={item.quantity}
            disabled={props.readOnly}
            onChange={(event) => props.onChange({ quantity: event.target.value })}
            placeholder="0"
            className={`${fieldClass} h-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
          />
          {errors.quantity && <RowError message={errors.quantity} />}
          {packagingQuantity !== null && (
            <p className="mt-1 text-[11px] text-[#64748b]">
              Equivalent: {formatQuantity(packagingQuantity)} bags
            </p>
          )}
        </div>
        <CompactValue value={item.product ? 'TON' : '—'} />
        <CompactValue value={item.product?.packagingType ?? '—'} />
        <button
          type="button"
          disabled={!bagProduct}
          onClick={props.onToggleExpanded}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-[#f6f2fa] hover:text-[#54247a] disabled:cursor-default disabled:opacity-25"
          aria-label="Toggle additional item options"
        >
          <ChevronDown size={16} className={`transition ${props.expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {props.expanded && bagProduct && (
        <div className="grid gap-4 border-t border-[#eceaf0] bg-[#f8fafc] px-14 py-3 sm:grid-cols-3">
          <label className="flex h-10 items-center gap-2 text-sm font-medium text-[#1a1b23]">
            <input
              type="checkbox"
              checked={item.palletRequired}
              disabled={props.readOnly}
              onChange={(event) => props.onChange({ palletRequired: event.target.checked })}
              className={checkboxClass}
            />
            Pallet Required
          </label>
          {item.palletRequired && (
            <>
              <Field label="Pallet Type" error={errors.palletType}>
                <input
                  value={item.palletType}
                  disabled={props.readOnly}
                  onChange={(event) => props.onChange({ palletType: event.target.value })}
                  className={fieldClass}
                />
              </Field>
              <Field label="Pallet Quantity" error={errors.palletQuantity}>
                <input
                  type="number"
                  min="1"
                  value={item.palletQuantity}
                  disabled={props.readOnly}
                  onChange={(event) => props.onChange({ palletQuantity: event.target.value })}
                  className={fieldClass}
                />
              </Field>
            </>
          )}
        </div>
      )}
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
    <div className="absolute left-0 top-11 z-30 max-h-72 w-[390px] overflow-y-auto rounded-lg border border-[#e3e1e8] bg-white shadow-xl shadow-slate-900/10">
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-4 text-sm text-[#64748b]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading products
        </div>
      ) : products.length === 0 ? (
        <p className="px-3 py-4 text-sm text-[#64748b]">No active products found.</p>
      ) : (
        products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product)}
            className={`flex w-full items-center gap-3 border-b border-[#eceaf0] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f6f2fa] ${selectedProductId === product.id ? 'bg-[#f6f2fa]' : ''}`}
          >
            <ProductImage
              image={product.image}
              productName={product.productName}
              size="thumbnail"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-[#54247a]">
                {product.productCode}
              </span>
              <span className="mt-0.5 block truncate text-sm font-semibold text-[#1a1b23]">
                {product.productName}
              </span>
              <span className="mt-0.5 block truncate text-xs text-[#64748b]">
                {product.packagingType} · {product.uom}
              </span>
            </span>
            {selectedProductId === product.id && <Check size={16} className="text-[#54247a]" />}
          </button>
        ))
      )}
    </div>
  );
}

function DocumentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 py-5">
      <h2 className="border-b border-[#eceaf0] pb-3 text-sm font-semibold text-[#54247a]">
        {title}
      </h2>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function InfoField({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | null | undefined;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[#64748b]">{label}</dt>
      <dd
        className={`mt-1 font-semibold text-[#1a1b23] ${
          compact ? 'break-all text-[11px] leading-4' : 'truncate text-sm'
        }`}
        title={value ?? undefined}
      >
        {value || 'Not provided'}
      </dd>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string | undefined;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#4b4d5c]">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-[#b42318]">{error}</p>}
    </label>
  );
}

function CompactValue({ value }: { value: string }) {
  return (
    <span className="mr-3 flex h-9 items-center rounded-lg border border-[#e3e1e8] bg-[#f8fafc] px-3 text-xs font-medium text-[#4b4d5c]">
      {value}
    </span>
  );
}

function RowError({ message }: { message: string }) {
  return <p className="mt-1 truncate text-[10px] font-medium text-[#b42318]">{message}</p>;
}

function StatusDot({ label, submitted }: { label: string; submitted: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4b4d5c]">
      <span className={`h-1.5 w-1.5 rounded-full ${submitted ? 'bg-amber-500' : 'bg-slate-500'}`} />
      {label}
    </span>
  );
}

function InlineMessage({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const errorTone = tone === 'error';
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${errorTone ? 'bg-[#fdecec] text-[#b42318]' : 'bg-emerald-50 text-emerald-700'}`}
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
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-[#f6f2fa] hover:text-[#54247a]"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-confirmation-title"
        className="w-full max-w-md rounded-xl border border-[#e3e1e8] bg-white p-5 shadow-2xl"
      >
        <h2 id="submit-confirmation-title" className="text-lg font-semibold text-[#1a1b23]">
          Submit Quotation?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#4b4d5c]">
          Once submitted, this quotation will be sent to the Sales Team for review and cannot be
          freely edited.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-[#e3e1e8] px-4 text-sm font-semibold text-[#4b4d5c] hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#54247a] px-4 text-sm font-semibold text-white hover:bg-[#472066] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuotationSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-64 animate-pulse rounded-lg border border-[#e3e1e8] bg-white" />
      <div className="h-72 animate-pulse rounded-lg border border-[#e3e1e8] bg-white" />
    </div>
  );
}

function getRequestedDateError(form: FormState) {
  if (!form.requestedDate) return 'Requested delivery date is required.';
  if (form.requestedDate < today) return 'Requested delivery date cannot be in the past.';
  return '';
}

function getItemErrors(item: FormItem, index: number) {
  const errors: Partial<Record<'product' | 'quantity' | 'palletType' | 'palletQuantity', string>> =
    {};
  if (!item.product) errors.product = `Item ${index + 1} is required.`;
  if (!item.quantity || Number(item.quantity) <= 0)
    errors.quantity = 'Quantity (TON) must be greater than zero.';
  if (item.palletRequired && !item.palletType.trim())
    errors.palletType = 'Pallet type is required.';
  if (item.palletRequired && (!item.palletQuantity || Number(item.palletQuantity) <= 0))
    errors.palletQuantity = 'Pallet quantity must be greater than zero.';
  return errors;
}

function validateForm(form: FormState) {
  const errors: string[] = [];
  if (form.fulfilmentType === 'PICKUP' && !form.pickupLocationId)
    errors.push('Pickup location is required.');
  if (!form.shipToLocationId) errors.push('Delivery location is required.');
  if (!form.requestedDate) errors.push('Requested delivery date is required.');
  if (form.requestedDate && form.requestedDate < today)
    errors.push('Requested delivery date cannot be in the past.');
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

function toPayload(form: FormState): CustomerQuotationPayload {
  const payload: CustomerQuotationPayload = {
    fulfilmentType: form.fulfilmentType,
    shipToLocationId: form.shipToLocationId,
    requestedDate: form.requestedDate,
    items: form.items.map((item) => {
      const line: CustomerQuotationPayload['items'][number] = {
        productId: item.product?.id ?? '',
        quantityTon: Number(item.quantity),
        palletRequired: item.palletRequired,
      };
      return item.palletRequired
        ? {
            ...line,
            palletType: item.palletType.trim(),
            palletQuantity: Number(item.palletQuantity),
          }
        : line;
    }),
  };
  if (form.fulfilmentType === 'PICKUP') payload.pickupLocationId = form.pickupLocationId;
  if (form.notes.trim()) payload.notes = form.notes.trim();
  return payload;
}

function fromQuotation(quotation: CustomerQuotation): FormState {
  return {
    fulfilmentType: quotation.fulfilmentType,
    pickupLocationId: quotation.pickupLocationId ?? '',
    shipToLocationId: quotation.shipToLocationId ?? '',
    requestedDate: quotation.requestedDate ?? '',
    notes: quotation.notes ?? '',
    items: quotation.items.map((item) => ({
      key: item.id,
      product: {
        ...item.product,
        displayOrder: 0,
        priceDisplay: 'PRICE_ON_REQUEST',
        isActive: true,
        createdAt: quotation.createdAt,
        updatedAt: quotation.updatedAt,
      },
      quantity: String(item.quantityTon),
      palletRequired: item.palletRequired,
      palletType: item.palletType ?? '',
      palletQuantity: item.palletQuantity ? String(item.palletQuantity) : '',
    })),
  };
}

function serializeForm(form: FormState) {
  return JSON.stringify({
    fulfilmentType: form.fulfilmentType,
    pickupLocationId: form.pickupLocationId,
    shipToLocationId: form.shipToLocationId,
    requestedDate: form.requestedDate,
    notes: form.notes,
    items: form.items.map((item) => ({
      productId: item.product?.id ?? null,
      quantity: item.quantity,
      palletRequired: item.palletRequired,
      palletType: item.palletType,
      palletQuantity: item.palletQuantity,
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
