import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Edit3, Eye, MapPin, Plus, Star, Trash2, X } from 'lucide-react';
import { LocationPickerMap } from '../../components/registration/LocationPickerMap';
import { SearchableTomSelect } from '../../components/ui/SearchableTomSelect';
import type { Coordinates } from '../../config/map';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  formatSaudiPhoneNumber,
  getSaudiPhoneLocalDigits,
  isSaudiPhoneNumber,
} from '../../context/RegistrationContext';
import {
  CustomerLocationsApiError,
  createCustomerLocation,
  deleteCustomerLocation,
  getCustomerLocations,
  getCustomerLocationCities,
  setPrimaryCustomerLocation,
  updateCustomerLocation,
  type CustomerLocation,
  type CustomerLocationPayload,
  type CustomerLocationCity,
} from '../../services/customerLocationsService';
import type { NormalizedLocationData } from '../../services/locationReverseGeocodingService';

type LocationForm = {
  name: string;
  siteId: string;
  streetAddress: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  contactPerson: string;
  contactPhone: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
  isPrimary: boolean;
};

type MapTarget = { type: 'form' } | { type: 'view'; location: CustomerLocation } | null;

const emptyForm: LocationForm = {
  name: '',
  siteId: '',
  streetAddress: '',
  city: '',
  region: '',
  country: 'Saudi Arabia',
  postalCode: '',
  contactPerson: '',
  contactPhone: '',
  isPrimary: false,
};

const regions = [
  'Riyadh',
  'Makkah',
  'Madinah',
  'Eastern Province',
  'Asir',
  'Tabuk',
  'Qassim',
  'Hail',
  'Jazan',
  'Najran',
  'Al Bahah',
  'Al Jawf',
  'Northern Borders',
];

export function CustomerLocations() {
  const { user } = useCustomerAuth();
  const canManageLocations = user?.role === 'CUSTOMER_ADMIN';
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [cities, setCities] = useState<CustomerLocationCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [mapTarget, setMapTarget] = useState<MapTarget>(null);
  const cityOptions = useMemo(
    () => Array.from(new Set([form.city, ...cities.map((city) => city.name)].filter(Boolean))),
    [cities, form.city],
  );
  const regionOptions = useMemo(
    () => Array.from(new Set([form.region, ...regions].filter(Boolean))),
    [form.region],
  );

  const editingLocation = useMemo(
    () => locations.find((location) => location.id === editingId) ?? null,
    [editingId, locations],
  );

  const loadLocations = async () => {
    setLoading(true);
    setError('');
    try {
      setLocations(await getCustomerLocations());
    } catch {
      setError('Unable to load delivery locations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLocations();
    void getCustomerLocationCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  const updateField = (field: keyof LocationForm, value: string | boolean | number | undefined) => {
    const next = { ...form, [field]: value };
    setForm(next);
    setFormErrors((errors) =>
      errors[field] ? { ...errors, [field]: validateLocationField(next, field) } : errors,
    );
  };

  const validateField = (field: keyof LocationForm) => {
    setFormErrors((current) => ({ ...current, [field]: validateLocationField(form, field) }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
  };

  const startEdit = (location: CustomerLocation) => {
    setEditingId(location.id);
    setForm({
      name: location.name,
      siteId: location.siteId,
      streetAddress: location.streetAddress,
      city: location.city,
      region: location.region,
      country: location.country,
      postalCode: location.postalCode,
      contactPerson: location.contactPerson,
      contactPhone: location.contactPhone,
      latitude: location.latitude,
      longitude: location.longitude,
      isPrimary: location.isPrimary,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Location name is required.';
    if (!form.streetAddress.trim()) next.streetAddress = 'Street address is required.';
    if (!form.city.trim()) next.city = 'City is required.';
    if (!form.region.trim()) next.region = 'Region is required.';
    if (!form.country.trim()) next.country = 'Country is required.';
    if (form.postalCode && !/^\d{5}$/.test(form.postalCode)) {
      next.postalCode = 'Enter a valid 5-digit postal code.';
    }
    if (!form.contactPerson.trim()) next.contactPerson = 'Contact person is required.';
    if (!isSaudiPhoneNumber(form.contactPhone)) {
      next.contactPhone = 'Enter a valid Saudi mobile number.';
    }
    if (
      (form.latitude === undefined) !== (form.longitude === undefined) ||
      (form.latitude !== undefined && (form.latitude < -90 || form.latitude > 90)) ||
      (form.longitude !== undefined && (form.longitude < -180 || form.longitude > 180))
    ) {
      next.coordinates = 'Selected map coordinates are invalid.';
    }

    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveLocation = async () => {
    if (!validate()) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = toPayload(form);
      const nextLocations = editingId
        ? await updateCustomerLocation(editingId, payload)
        : await createCustomerLocation(payload);
      setLocations(nextLocations);
      resetForm();
      setSuccess(editingId ? 'Delivery location updated.' : 'Delivery location added.');
    } catch (saveError) {
      if (saveError instanceof CustomerLocationsApiError && saveError.errors) {
        setFormErrors(saveError.errors);
      }
      setError('Unable to save delivery location. Please review the form and try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeLocation = async (location: CustomerLocation) => {
    if (!window.confirm(`Delete "${location.name}"?`)) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      setLocations(await deleteCustomerLocation(location.id));
      if (editingId === location.id) resetForm();
      setSuccess('Delivery location deleted.');
    } catch {
      setError('Unable to delete this location. At least one delivery location is required.');
    } finally {
      setSaving(false);
    }
  };

  const makePrimary = async (location: CustomerLocation) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      setLocations(await setPrimaryCustomerLocation(location.id));
      setSuccess('Primary delivery location updated.');
    } catch {
      setError('Unable to update the primary delivery location.');
    } finally {
      setSaving(false);
    }
  };

  const formCoordinates = getCoordinates(form);
  const applySelectedLocation = (
    current: LocationForm,
    location: NormalizedLocationData,
  ): LocationForm => ({
    ...current,
    name: location.locationName ?? current.name,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    streetAddress: location.street ?? location.formattedAddress ?? current.streetAddress,
    city: resolveLocationCity(location.city, cityOptions) ?? current.city,
    region: location.region ?? current.region,
    country: location.country ?? (current.country || 'Saudi Arabia'),
    postalCode: location.postalCode?.replace(/\D/g, '').slice(0, 5) ?? current.postalCode,
  });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Delivery Locations</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Manage delivery destinations linked to your activated customer account.
        </p>
      </section>

      {error && <StateMessage tone="error" message={error} />}
      {success && <StateMessage tone="success" message={success} />}

      {canManageLocations && (
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <MapPin className="h-5 w-5 text-[#54247a]" />
          <h2 className="text-base font-bold text-slate-950">
            {editingLocation ? 'Edit Location' : 'Add Location'}
          </h2>
        </div>

        <div className="grid gap-5 pt-5 md:grid-cols-2">
          <TextInput
            label="Location Name"
            required
            value={form.name}
            error={formErrors.name}
            onChange={(value) => updateField('name', value)}
            onBlur={() => validateField('name')}
          />
          <TextInput
            label="Site ID"
            readOnly
            value={form.siteId || 'Auto-generated when saved'}
            onChange={() => undefined}
          />
          <TextInput
            label="Street Address"
            required
            value={form.streetAddress}
            error={formErrors.streetAddress}
            onChange={(value) => updateField('streetAddress', value)}
            onBlur={() => validateField('streetAddress')}
          />
          <SelectInput
            label="City"
            required
            value={form.city}
            error={formErrors.city}
            options={cityOptions}
            placeholder="Select City"
            onChange={(value) => updateField('city', value)}
            onBlur={() => validateField('city')}
          />
          <SelectInput
            label="Region / Province"
            required
            value={form.region}
            error={formErrors.region}
            options={regionOptions}
            onChange={(value) => updateField('region', value)}
            onBlur={() => validateField('region')}
          />
          <TextInput
            label="Country"
            required
            value="Saudi Arabia"
            error={formErrors.country}
            readOnly
            onChange={() => undefined}
          />
          <TextInput
            label="Postal Code"
            value={form.postalCode}
            error={formErrors.postalCode}
            inputMode="numeric"
            maxLength={5}
            onChange={(value) => updateField('postalCode', value.replace(/\D/g, '').slice(0, 5))}
            onBlur={() => validateField('postalCode')}
          />
          <TextInput
            label="Contact Person"
            required
            value={form.contactPerson}
            error={formErrors.contactPerson}
            onChange={(value) => updateField('contactPerson', value)}
            onBlur={() => validateField('contactPerson')}
          />
          <PhoneInput
            label="Contact Phone"
            required
            value={form.contactPhone}
            error={formErrors.contactPhone}
            onChange={(value) => updateField('contactPhone', value)}
            onBlur={() => validateField('contactPhone')}
          />
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Map Location</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {formCoordinates ? 'Map location selected' : 'No map location selected'}
              </p>
              {formErrors.coordinates && (
                <p className="mt-1 text-xs font-semibold text-red-600">{formErrors.coordinates}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMapTarget({ type: 'form' })}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#54247a] bg-white px-4 py-2.5 text-sm font-bold text-[#54247a] hover:bg-[#f6f2fa]"
            >
              <MapPin size={16} />
              {formCoordinates ? 'View / Update Map' : 'Open Map'}
            </button>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(event) => updateField('isPrimary', event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 accent-[#54247a]"
          />
          <span>
            <span className="font-bold text-slate-900">Primary Delivery Location</span>
            <span className="mt-0.5 block text-xs font-medium text-slate-500">
              Only one delivery location can be primary.
            </span>
          </span>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <X size={16} />
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => void saveLocation()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-60"
          >
            {!editingId && <Plus size={16} />}
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Location'}
          </button>
        </div>
      </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Saved Locations</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {locations.length} {locations.length === 1 ? 'Saved Location' : 'Saved Locations'}
            </p>
          </div>
        </div>

        {loading ? (
          <LocationSkeleton />
        ) : locations.length === 0 ? (
          <p className="py-5 text-sm font-medium text-slate-500">
            No delivery locations available.
          </p>
        ) : (
          <div className="space-y-3 pt-5">
            {locations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                saving={saving}
                canManage={canManageLocations}
                onViewMap={() => setMapTarget({ type: 'view', location })}
                onEdit={() => startEdit(location)}
                onDelete={() => void removeLocation(location)}
                onMakePrimary={() => void makePrimary(location)}
              />
            ))}
          </div>
        )}
      </section>

      {mapTarget?.type === 'form' && (
        <LocationPickerMap
          initialCoordinates={formCoordinates ?? undefined}
          locationLabel={form.name || undefined}
          onCancel={() => setMapTarget(null)}
          onConfirm={(coordinates) => {
            const latitude = Number(coordinates.latitude);
            const longitude = Number(coordinates.longitude);

            if (
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude) ||
              latitude < -90 ||
              latitude > 90 ||
              longitude < -180 ||
              longitude > 180
            ) {
              setFormErrors((current) => ({
                ...current,
                coordinates: 'Selected map coordinates are invalid.',
              }));
              return;
            }

            setForm((current) =>
              applySelectedLocation(current, { ...coordinates, latitude, longitude }),
            );
            setFormErrors((current) => ({
              ...current,
              coordinates: '',
              streetAddress: '',
              city: '',
              region: '',
              country: '',
              postalCode: '',
            }));
            setMapTarget(null);
          }}
        />
      )}

      {mapTarget?.type === 'view' && (
        <LocationPickerMap
          initialCoordinates={getCoordinates(mapTarget.location) ?? undefined}
          locationLabel={mapTarget.location.name}
          onCancel={() => setMapTarget(null)}
          onConfirm={() => setMapTarget(null)}
        />
      )}
    </div>
  );
}

function LocationCard({
  location,
  saving,
  canManage,
  onViewMap,
  onEdit,
  onDelete,
  onMakePrimary,
}: {
  location: CustomerLocation;
  saving: boolean;
  canManage: boolean;
  onViewMap: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMakePrimary: () => void;
}) {
  const coordinates = getCoordinates(location);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-950">{location.name}</h3>
            {location.isPrimary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f4eaf5] px-2 py-0.5 text-xs font-bold text-[#7f1d73]">
                <Star size={12} fill="currentColor" />
                Primary
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">ID: {location.siteId}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {coordinates && (
            <ActionButton onClick={onViewMap} icon={<Eye size={15} />} label="View Map" />
          )}
          {canManage && !location.isPrimary && (
            <ActionButton
              onClick={onMakePrimary}
              icon={<Star size={15} />}
              label="Set Primary"
              disabled={saving}
            />
          )}
          {canManage && (
            <>
              <ActionButton onClick={onEdit} icon={<Edit3 size={15} />} label="Edit" />
              <ActionButton
                onClick={onDelete}
                icon={<Trash2 size={15} />}
                label="Delete"
                tone="danger"
                disabled={saving}
              />
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm font-medium text-slate-600 md:grid-cols-2">
        <p>
          <span className="font-bold text-slate-800">Address:</span> {location.streetAddress},{' '}
          {location.city}, {location.region}, {location.country}
        </p>
        <p>
          <span className="font-bold text-slate-800">Postal Code:</span>{' '}
          {location.postalCode || 'Not provided'}
        </p>
        <p>
          <span className="font-bold text-slate-800">Contact:</span> {location.contactPerson}
        </p>
        <p>
          <span className="font-bold text-slate-800">Phone:</span> {location.contactPhone}
        </p>
        {coordinates && (
          <p className="inline-flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 size={16} />
            Map location selected
          </p>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  tone = 'default',
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${
        tone === 'danger'
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-700 hover:bg-white hover:text-[#54247a]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function resolveLocationCity(city: string | undefined, options: string[]) {
  const normalizedCity = normalizeLocationText(city);
  if (!normalizedCity) return undefined;

  return (
    options.find((option) => normalizeLocationText(option) === normalizedCity) ??
    options.find((option) => {
      const normalizedOption = normalizeLocationText(option);
      return normalizedOption.includes(normalizedCity) || normalizedCity.includes(normalizedOption);
    }) ??
    city?.trim()
  );
}

function normalizeLocationText(value: string | undefined) {
  return (
    value
    ?.normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\b(city|tehsil|district|governorate|governorate of|province|region)\b/giu, '')
    .replace(/\s+/g, ' ')
    .trim()
      .toLowerCase() ?? ''
  );
}

function TextInput(props: {
  label: string;
  value: string;
  required?: boolean;
  error?: string | undefined;
  inputMode?: 'text' | 'numeric' | undefined;
  maxLength?: number | undefined;
  readOnly?: boolean | undefined;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">
        {props.label}
        {props.required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <input
        value={props.value}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        readOnly={props.readOnly}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
        className={`mt-2 h-11 w-full rounded-xl border px-3 text-sm font-medium outline-none focus:ring-2 ${props.readOnly ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'bg-white'} ${
          props.error
            ? 'border-red-400 focus:ring-red-100'
            : 'border-slate-200 focus:border-[#54247a] focus:ring-[#54247a]/10'
        }`}
      />
      {props.error && (
        <span className="mt-1 block text-xs font-semibold text-red-600">{props.error}</span>
      )}
    </label>
  );
}

function SelectInput(props: {
  label: string;
  value: string;
  options: string[];
  required?: boolean;
  error?: string | undefined;
  placeholder?: string | undefined;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">
        {props.label}
        {props.required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <SearchableTomSelect
        value={props.value}
        options={props.options.map((option) => ({ value: option, label: option }))}
        placeholder={props.placeholder ?? props.label}
        ariaLabel={props.label}
        onChange={props.onChange}
        onBlur={props.onBlur}
        wrapperClassName={`mt-2 ${
          props.error
            ? 'registration-region-select-error'
            : ''
        }`}
      />
      {props.error && (
        <span className="mt-1 block text-xs font-semibold text-red-600">{props.error}</span>
      )}
    </label>
  );
}

function PhoneInput(props: {
  label: string;
  value: string;
  required?: boolean;
  error?: string | undefined;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">
        {props.label}
        {props.required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <div
        className={`mt-2 flex h-11 overflow-hidden rounded-xl border bg-white focus-within:ring-2 ${
          props.error
            ? 'border-red-400 focus-within:ring-red-100'
            : 'border-slate-200 focus-within:border-[#54247a] focus-within:ring-[#54247a]/10'
        }`}
      >
        <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
          +966
        </span>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={11}
          value={formatSaudiPhoneNumber(props.value)}
          onChange={(event) => props.onChange(getSaudiPhoneLocalDigits(event.target.value))}
          onBlur={props.onBlur}
          className="min-w-0 flex-1 px-3 text-sm font-medium outline-none"
          placeholder="5XX XXX XXX"
        />
      </div>
      {props.error && (
        <span className="mt-1 block text-xs font-semibold text-red-600">{props.error}</span>
      )}
    </label>
  );
}

function LocationSkeleton() {
  return (
    <div className="space-y-3 pt-5">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-3 w-64 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-3 w-52 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function StateMessage({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const classes =
    tone === 'error'
      ? 'border-red-100 bg-red-50 text-red-700'
      : 'border-emerald-100 bg-emerald-50 text-emerald-700';

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${classes}`}>{message}</div>
  );
}

function toPayload(form: LocationForm): CustomerLocationPayload {
  return {
    name: form.name.trim(),
    streetAddress: form.streetAddress.trim(),
    city: form.city.trim(),
    region: form.region.trim(),
    country: form.country.trim(),
    postalCode: form.postalCode.trim(),
    contactPerson: form.contactPerson.trim(),
    contactPhone: `+966${getSaudiPhoneLocalDigits(form.contactPhone)}`,
    latitude: form.latitude,
    longitude: form.longitude,
    isPrimary: form.isPrimary,
  };
}

function validateLocationField(form: LocationForm, field: keyof LocationForm) {
  if (field === 'name' && !form.name.trim()) return 'Location name is required.';
  if (field === 'streetAddress' && !form.streetAddress.trim()) {
    return 'Street address is required.';
  }
  if (field === 'city' && !form.city.trim()) return 'City is required.';
  if (field === 'region' && !form.region.trim()) return 'Region is required.';
  if (field === 'country' && !form.country.trim()) return 'Country is required.';
  if (field === 'postalCode' && form.postalCode && !/^\d{5}$/.test(form.postalCode)) {
    return 'Enter a valid 5-digit postal code.';
  }
  if (field === 'contactPerson' && !form.contactPerson.trim()) {
    return 'Contact person is required.';
  }
  if (field === 'contactPhone' && !isSaudiPhoneNumber(form.contactPhone)) {
    return 'Enter a valid Saudi mobile number.';
  }
  return '';
}

function getCoordinates(location: {
  latitude?: number | undefined;
  longitude?: number | undefined;
}): Coordinates | null {
  if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return null;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
  };
}
