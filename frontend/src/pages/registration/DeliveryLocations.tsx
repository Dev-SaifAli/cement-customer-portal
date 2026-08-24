import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Map,
  UserRound,
  Plus,
  Trash2,
  Edit3,
  Save,
  CheckCircle2,
  Eye,
  Star,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrandHeader } from '../../components/registration/BrandHeader';
import { LocationPickerMap } from '../../components/registration/LocationPickerMap';
import { SaveDraftButton } from '../../components/registration/SaveDraftButton';
import { SaveStatus } from '../../components/registration/SaveStatus';
import { formatCoordinates, isValidCoordinates } from '../../config/map';
import {
  formatSaudiPhoneNumber,
  getSaudiPhoneDigitsRemaining,
  getSaudiPhoneLocalDigits,
  isDeliveryLocationValid,
  isSaudiPhoneNumber,
  useRegistration,
  type DeliveryLocation,
} from '../../context/RegistrationContext';
import { createClientId } from '../../utils/createClientId';

type DeliveryLocationForm = {
  name: string;
  streetAddress: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  contactPerson: string;
  contactPhone: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
  isPrimary?: boolean | undefined;
};

type MapTarget =
  | { type: 'form' }
  | { type: 'location'; locationId: string; locationName: string; coordinates: Coordinates }
  | null;

type Coordinates = {
  latitude: number;
  longitude: number;
};

const emptyForm: DeliveryLocationForm = {
  name: '',
  streetAddress: '',
  city: '',
  region: '',
  country: 'Saudi Arabia',
  postalCode: '',
  contactPerson: '',
  contactPhone: '',
};

const SAUDI_REGIONS = [
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

export default function DeliveryLocations() {
  const navigate = useNavigate();
  const { continueRegistration, data, setCurrentStep, setDeliveryLocations } = useRegistration();
  const locations = data.deliveryLocations;
  const hasValidLocations = locations.length > 0 && locations.every(isDeliveryLocationValid);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mapTarget, setMapTarget] = useState<MapTarget>(null);
  const [locationToDelete, setLocationToDelete] = useState<DeliveryLocation | null>(null);

  useEffect(() => setCurrentStep(4), [setCurrentStep]);

  const updateField = (field: keyof DeliveryLocationForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) newErrors.name = 'Location name is required.';
    if (!form.streetAddress.trim()) newErrors.streetAddress = 'Street address is required.';
    if (!form.city.trim()) newErrors.city = 'City is required.';
    if (!form.region.trim()) newErrors.region = 'Region is required.';
    if (!form.contactPerson.trim()) newErrors.contactPerson = 'Contact person is required.';
    if (!form.contactPhone.trim()) newErrors.contactPhone = 'Contact phone is required.';
    else if (!isSaudiPhoneNumber(form.contactPhone)) {
      newErrors.contactPhone = 'Enter a valid Saudi mobile number.';
    }
    if (!areOptionalCoordinatesValid(form)) {
      newErrors.coordinates = 'Selected map coordinates are invalid.';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setForm(emptyForm);
    setErrors({});
    setEditingId(null);
  };

  const addLocation = () => {
    if (!validate()) return;

    if (editingId) {
      setDeliveryLocations(
        normalizePrimaryLocations(
          locations.map((location) =>
            location.id === editingId
              ? {
                  ...location,
                  name: form.name,
                  streetAddress: form.streetAddress,
                  city: form.city,
                  region: form.region,
                  country: form.country,
                  postalCode: form.postalCode,
                  contactPerson: form.contactPerson,
                  contactPhone: form.contactPhone,
                  latitude: form.latitude,
                  longitude: form.longitude,
                  isPrimary: form.isPrimary,
                }
              : location,
          ),
          form.isPrimary ? editingId : undefined,
        ),
      );
    } else {
      const newLocation: DeliveryLocation = {
        id: createClientId(),
        name: form.name,
        siteId: `LOC-${Math.floor(100 + Math.random() * 900)}-${form.city
          .slice(0, 3)
          .toUpperCase()}`,
        streetAddress: form.streetAddress,
        city: form.city,
        region: form.region,
        country: form.country,
        postalCode: form.postalCode,
        contactPerson: form.contactPerson,
        contactPhone: form.contactPhone,
        latitude: form.latitude,
        longitude: form.longitude,
        isPrimary: locations.length === 0 || form.isPrimary,
      };

      setDeliveryLocations(normalizePrimaryLocations([...locations, newLocation], newLocation.id));
    }

    resetForm();
  };

  const editLocation = (location: DeliveryLocation) => {
    setEditingId(location.id);

    setForm({
      name: location.name,
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

    window.scrollTo({
      top: 180,
      behavior: 'smooth',
    });
  };

  const confirmDeleteLocation = () => {
    if (!locationToDelete) return;

    setDeliveryLocations(
      normalizePrimaryLocations(
        locations.filter((location) => location.id !== locationToDelete.id),
      ),
    );

    if (editingId === locationToDelete.id) {
      resetForm();
    }

    setLocationToDelete(null);
  };

  const setPrimaryLocation = (id: string) => {
    setDeliveryLocations(normalizePrimaryLocations(locations, id));
  };

  const handleContinue = () => {
    if (!hasValidLocations) {
      alert('Please add at least one complete and valid delivery location.');
      return;
    }

    void continueRegistration(() => navigate('/register/admin'));
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#292929]">
      {/* Header */}
      <BrandHeader />

      {/* Progress */}
      <RegistrationProgress />

      {/* Main */}
      <main className="px-6 lg:px-10 pb-10">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(400px,1fr)] gap-8 max-w-[1500px] mx-auto">
          {/* Left: Add location */}
          <section className="bg-white border border-[#e1d8e2] rounded-md shadow-sm">
            <div className="p-8">
              {/* Title */}
              <div className="flex items-start gap-4 pb-6 border-b border-[#e5dfe5]">
                <div className="mt-1">
                  <MapPin size={36} strokeWidth={1.8} className="text-[#54247a]" />
                </div>

                <div>
                  <h1 className="text-[27px] font-bold tracking-tight">
                    {editingId ? 'Edit Project Site' : 'Add Project Site'}
                  </h1>

                  <p className="mt-1 text-[16px] text-[#6c666c]">
                    Register delivery destinations for your cement orders.
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="pt-6 space-y-6">
                <FormInput
                  label="Location Name / Site ID"
                  required
                  placeholder="e.g. North Terminal Extension"
                  value={form.name}
                  error={errors.name}
                  onChange={(value) => updateField('name', value)}
                />

                <FormInput
                  label="Street Address"
                  required
                  placeholder="Plot number, Street name"
                  value={form.streetAddress}
                  error={errors.streetAddress}
                  autoComplete="shipping street-address"
                  onChange={(value) => updateField('streetAddress', value)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormInput
                    label="City"
                    required
                    placeholder="e.g. Jeddah"
                    value={form.city}
                    error={errors.city}
                    autoComplete="shipping address-level2"
                    onChange={(value) => updateField('city', value)}
                  />

                  <FormSelect
                    label="Region / Province"
                    required
                    value={form.region}
                    error={errors.region}
                    autoComplete="shipping address-level1"
                    onChange={(value) => updateField('region', value)}
                    options={SAUDI_REGIONS}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormInput
                    label="Country"
                    value={form.country}
                    disabled
                    autoComplete="shipping country-name"
                    onChange={() => {}}
                  />

                  <FormInput
                    label="Postal Code"
                    placeholder="e.g. 21442"
                    value={form.postalCode}
                    autoComplete="shipping postal-code"
                    onChange={(value) => updateField('postalCode', value)}
                  />
                </div>

                <div className="rounded-md border border-[#e5dfe5] bg-[#fbfafb] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-[14px] font-semibold text-[#3f3940]">Map Location</h2>
                        <span className="rounded-full bg-[#eee9ee] px-2 py-0.5 text-xs font-semibold text-[#6c666c]">
                          Optional
                        </span>
                      </div>
                      {getFormCoordinates(form) ? (
                        <div className="mt-2 space-y-1">
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#087443]">
                            <CheckCircle2 size={16} />
                            Map location selected
                          </p>
                          <details className="text-xs text-[#777177]">
                            <summary className="cursor-pointer">Coordinates</summary>
                            <span>{formatCoordinates(getFormCoordinates(form)!)}</span>
                          </details>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-[#777177]">No map location selected</p>
                      )}
                      {errors.coordinates && (
                        <p className="mt-1 text-xs text-red-600">{errors.coordinates}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMapTarget({ type: 'form' })}
                      className="inline-flex w-fit items-center gap-2 rounded-md border border-[#5b2a7a] bg-[#faf7fb] px-5 py-2.5 text-sm font-semibold text-[#5b2a7a] transition-colors hover:bg-[#f3eaf7]"
                    >
                      <MapPin size={17} />
                      {getFormCoordinates(form) ? 'View / Update Map Location' : 'Open Map'}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[#e5dfe5] bg-white px-4 py-3 text-sm text-[#625c62]">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isPrimary)}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, isPrimary: event.target.checked }))
                    }
                    className="mt-1 h-4 w-4 rounded border-[#d6cbd7] accent-[#54247a]"
                  />
                  <span>
                    <span className="font-semibold text-[#3f3940]">Primary Delivery Location</span>
                    <span className="mt-0.5 block text-xs text-[#777177]">
                      Optional. Only one saved location can be marked as primary.
                    </span>
                  </span>
                </label>

                {/* Site Contact */}
                <div className="pt-5 border-t border-[#e5dfe5]">
                  <div className="flex items-center gap-2 mb-5">
                    <UserRound size={20} className="text-[#6b646b]" />

                    <h2 className="font-semibold text-[16px] text-[#625c62]">
                      Site Contact Information
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput
                      label="Contact Person"
                      required
                      placeholder="Site Manager Name"
                      value={form.contactPerson}
                      error={errors.contactPerson}
                      onChange={(value) => updateField('contactPerson', value)}
                    />

                    <FormInput
                      label="Contact Phone"
                      required
                      isPhone
                      placeholder="5XX XXX XXX"
                      value={form.contactPhone}
                      error={errors.contactPhone}
                      onChange={(value) => updateField('contactPhone', value)}
                    />
                  </div>
                </div>

                {/* Add button */}
                <div className="flex justify-end pt-1">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="mr-3 px-5 py-3 rounded-md border border-[#cfc6d0] text-[#625c62] font-semibold hover:bg-[#faf7fb]"
                    >
                      Cancel Edit
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={addLocation}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-[#7c6e7d] text-[#625c62] font-semibold hover:bg-[#faf7fb] transition-colors"
                  >
                    {editingId ? <Save size={18} /> : <Plus size={18} />}

                    {editingId ? 'Update Location' : 'Add Location to List'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Right: Added Locations */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <Map size={20} className="text-[#625c62]" />

                <h2 className="font-bold text-[17px]">Added Locations</h2>
              </div>

              <span className="px-3 py-1 rounded-full bg-[#eee9ee] text-[13px] text-[#625c62]">
                {locations.length} {locations.length === 1 ? 'Site' : 'Sites'}
              </span>
            </div>

            {locations.length === 0 ? (
              <div className="bg-white border border-dashed border-[#d3c9d5] rounded-md p-10 text-center">
                <MapPin size={35} className="mx-auto text-[#9b8fa0] mb-3" />

                <h3 className="font-semibold text-[#4e494e]">No delivery locations yet</h3>

                <p className="text-sm text-[#777177] mt-1">
                  Add your first project site using the form.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {locations.map((location) => (
                  <LocationCard
                    key={location.id}
                    location={location}
                    onViewMap={() => {
                      const coordinates = getFormCoordinates(location);
                      if (!coordinates) return;
                      setMapTarget({
                        type: 'location',
                        locationId: location.id,
                        locationName: location.name,
                        coordinates,
                      });
                    }}
                    onEdit={() => editLocation(location)}
                    onDelete={() => setLocationToDelete(location)}
                    onMakePrimary={() => setPrimaryLocation(location.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Bottom actions */}
        <div className="max-w-[1500px] mx-auto mt-10 pt-6 border-t border-[#ddd6dd] flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/register/documents')}
            className="flex items-center gap-2 text-[#625c62] font-medium hover:text-[#54247a]"
          >
            <ArrowLeft size={20} />
            Back
          </button>

          <div className="flex items-center gap-4">
            <SaveStatus />
            <SaveDraftButton className="px-7 py-3 border border-[#817782] rounded-md bg-white text-[#494349] font-semibold hover:bg-[#faf7fb] disabled:cursor-not-allowed disabled:opacity-60">
              Save Draft
            </SaveDraftButton>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!hasValidLocations}
              className="px-7 py-3 rounded-md bg-[#54247a] text-white font-semibold flex items-center gap-3 hover:bg-[#472066] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue to Customer Administrator
              <ArrowRight size={19} />
            </button>
          </div>
        </div>
      </main>

      {mapTarget && (
        <LocationPickerMap
          initialCoordinates={getMapTargetCoordinates(mapTarget, form) ?? undefined}
          locationLabel={getMapTargetLabel(mapTarget, form)}
          onCancel={() => setMapTarget(null)}
          onConfirm={(coordinates) => {
            if (mapTarget.type === 'form') {
              setForm((current) => ({
                ...current,
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
              }));
              setErrors((current) => ({ ...current, coordinates: '' }));
            } else {
              setDeliveryLocations(
                locations.map((location) =>
                  location.id === mapTarget.locationId
                    ? {
                        ...location,
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude,
                      }
                    : location,
                ),
              );
            }
            setMapTarget(null);
          }}
        />
      )}

      {locationToDelete && (
        <DeleteLocationDialog
          location={locationToDelete}
          onCancel={() => setLocationToDelete(null)}
          onDelete={confirmDeleteLocation}
        />
      )}
    </div>
  );
}

function getFormCoordinates(location: Pick<DeliveryLocation, 'latitude' | 'longitude'>) {
  if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return null;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

function areOptionalCoordinatesValid(location: Pick<DeliveryLocation, 'latitude' | 'longitude'>) {
  const hasLatitude = location.latitude !== undefined;
  const hasLongitude = location.longitude !== undefined;

  if (hasLatitude !== hasLongitude) return false;

  const coordinates = getFormCoordinates(location);

  return coordinates === null || isValidCoordinates(coordinates);
}

function getMapTargetCoordinates(mapTarget: MapTarget, form: DeliveryLocationForm) {
  if (!mapTarget) return null;
  if (mapTarget.type === 'location') return mapTarget.coordinates;

  return getFormCoordinates(form);
}

function getMapTargetLabel(mapTarget: MapTarget, form: DeliveryLocationForm) {
  if (!mapTarget) return undefined;
  if (mapTarget.type === 'location') return mapTarget.locationName;

  return form.name || form.city || undefined;
}

function normalizePrimaryLocations(locations: DeliveryLocation[], primaryId?: string) {
  if (locations.length === 0) return locations;

  const selectedPrimaryId =
    primaryId ??
    locations.find((location) => location.isPrimary)?.id ??
    locations.find((location) => isDeliveryLocationValid(location))?.id ??
    locations[0]?.id;

  return locations.map((location) => ({
    ...location,
    isPrimary: location.id === selectedPrimaryId,
  }));
}

/* -------------------------------------------------------
   Progress
------------------------------------------------------- */

function RegistrationProgress() {
  const steps = [
    { number: 1, label: 'Company Info', completed: true },
    { number: 2, label: 'Contact Info', completed: true },
    { number: 3, label: 'Documents', completed: true },
    { number: 4, label: 'Delivery Locations', active: true },
    { number: 5, label: 'Customer Admin' },
    { number: 6, label: 'Review & Submit' },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-6 pt-8 pb-10">
      <div className="flex items-start">
        {steps.map((step, index) => {
          const nextStep = steps[index + 1];

          return (
            <div key={step.number} className="flex-1 flex items-start">
              <div className="flex flex-col items-center min-w-[110px]">
                <div
                  className={`
                  w-9 h-9 rounded-full flex items-center justify-center
                  font-semibold text-sm
                  ${
                    step.completed
                      ? 'bg-[#008b68] text-white'
                      : step.active
                        ? 'bg-[#54247a] text-white'
                        : 'bg-[#eeeceb] text-[#686368]'
                  }
                `}
                >
                  {step.completed ? '✓' : step.number}
                </div>

                <span
                  className={`
                  mt-2 text-sm text-center whitespace-nowrap
                  ${step.active ? 'font-bold text-[#54247a]' : 'font-medium text-[#625c62]'}
                `}
                >
                  {step.label}
                </span>
              </div>

              {nextStep && (
                <div
                  className={`
                  h-px flex-1 mt-[18px]
                  ${nextStep.active || nextStep.completed ? 'bg-[#54247a]' : 'bg-[#ddd8dd]'}
                `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   Location Card
------------------------------------------------------- */

function LocationCard({
  location,
  onViewMap,
  onEdit,
  onDelete,
  onMakePrimary,
}: {
  location: DeliveryLocation;
  onViewMap: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMakePrimary: () => void;
}) {
  const coordinates = getFormCoordinates(location);

  return (
    <div className="bg-white border border-[#e1dce1] rounded-md shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex justify-between gap-4">
        <div className="flex gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#f1dcff] flex items-center justify-center shrink-0">
            <MapPin size={23} fill="#54247a" className="text-[#54247a]" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-[17px]">{location.name}</h3>
              {location.isPrimary && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f4edf7] px-2 py-0.5 text-xs font-bold text-[#54247a]">
                  <Star size={12} fill="currentColor" />
                  Primary
                </span>
              )}
            </div>

            <p className="text-sm text-[#777177] mt-0.5">ID: {location.siteId}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-1">
          {coordinates && (
            <button
              type="button"
              onClick={onViewMap}
              title="View map"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-semibold text-[#625c62] hover:bg-[#f3edf5] hover:text-[#54247a]"
            >
              <Eye size={16} />
              View Map
            </button>
          )}

          {!location.isPrimary && (
            <button
              type="button"
              onClick={onMakePrimary}
              title="Make primary"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-semibold text-[#625c62] hover:bg-[#f3edf5] hover:text-[#54247a]"
            >
              <Star size={16} />
              Primary
            </button>
          )}

          <button
            type="button"
            onClick={onEdit}
            title="Edit location"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-semibold text-[#625c62] hover:bg-[#f3edf5] hover:text-[#54247a]"
          >
            <Edit3 size={17} />
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            title="Delete location"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-semibold text-[#625c62] hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={17} />
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 text-[14px] text-[#625c62]">
        <div className="flex gap-2">
          <Map size={17} className="shrink-0 mt-0.5" />
          <span>
            {location.streetAddress}, {location.city}, {location.region}
          </span>
        </div>

        <div className="flex gap-2">
          <UserRound size={17} className="shrink-0 mt-0.5" />
          <span>
            {location.contactPerson} • {location.contactPhone}
          </span>
        </div>

        {coordinates && (
          <div className="flex gap-2 text-[#087443]">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>Map location selected</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteLocationDialog({
  location,
  onCancel,
  onDelete,
}: {
  location: DeliveryLocation;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Delete delivery location"
    >
      <div className="w-full max-w-md rounded-xl border border-[#e1d8e2] bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Trash2 size={20} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#292929]">Delete Delivery Location?</h2>
            <p className="mt-2 text-sm leading-6 text-[#625c62]">
              Are you sure you want to remove "{location.name}"?
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[#cfc6d0] px-5 py-2.5 text-sm font-semibold text-[#625c62] hover:bg-[#faf7fb]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   Form Input
------------------------------------------------------- */

function FormInput({
  label,
  required,
  placeholder,
  value,
  error,
  disabled,
  isPhone,
  autoComplete,
  onChange,
}: {
  label: string;
  required?: boolean | undefined;
  placeholder?: string | undefined;
  value: string;
  error?: string | undefined;
  disabled?: boolean | undefined;
  isPhone?: boolean | undefined;
  autoComplete?: string | undefined;
  onChange: (value: string) => void;
}) {
  const digitsRemaining = isPhone ? getSaudiPhoneDigitsRemaining(value) : 0;
  const hasInvalidPhonePrefix = Boolean(
    isPhone && digitsRemaining === 0 && !isSaudiPhoneNumber(value),
  );

  return (
    <div>
      <label className="block text-[14px] font-semibold mb-2">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>

      <div
        className={`flex h-[43px] overflow-hidden rounded-sm border bg-white transition-colors ${
          error
            ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-100'
            : 'border-[#d6cbd7] focus-within:border-[#54247a] focus-within:ring-2 focus-within:ring-[#54247a]/10'
        } ${disabled ? 'bg-[#f1efef] text-[#6e696e] cursor-not-allowed' : ''}`}
      >
        {isPhone && (
          <div className="flex items-center border-r border-[#d6cbd7] bg-[#f8f7f7] px-3 text-[15px] text-[#625c62]">
            +966
          </div>
        )}

        <input
          type={isPhone ? 'tel' : 'text'}
          inputMode={isPhone ? 'numeric' : undefined}
          maxLength={isPhone ? 11 : undefined}
          value={isPhone ? formatSaudiPhoneNumber(value) : value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) =>
            onChange(isPhone ? getSaudiPhoneLocalDigits(e.target.value) : e.target.value)
          }
          className={`
            min-w-0 flex-1 px-3 text-[15px] outline-none
            placeholder:text-[#b6adb6]
            ${disabled ? 'cursor-not-allowed bg-[#f1efef]' : 'bg-white'}
          `}
        />
      </div>

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {isPhone && !error && (
        <p
          className={`mt-1 text-xs font-medium ${
            hasInvalidPhonePrefix
              ? 'text-red-600'
              : digitsRemaining === 0
                ? 'text-[#008c68]'
                : 'text-[#777177]'
          }`}
        >
          {hasInvalidPhonePrefix
            ? 'Saudi mobile number must start with 5.'
            : digitsRemaining === 0
              ? 'Phone number complete.'
              : `${digitsRemaining} digit${digitsRemaining === 1 ? '' : 's'} remaining after +966.`}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   Select
------------------------------------------------------- */

function FormSelect({
  label,
  required,
  value,
  error,
  options,
  autoComplete,
  onChange,
}: {
  label: string;
  required?: boolean | undefined;
  value: string;
  error?: string | undefined;
  options: string[];
  autoComplete?: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-[14px] font-semibold mb-2">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>

      <select
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full h-[43px] px-3 rounded-sm border bg-white
          outline-none text-[15px]
          ${
            error
              ? 'border-red-500'
              : 'border-[#d6cbd7] focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10'
          }
        `}
      >
        <option value="">Select Region</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
