import { ArrowLeft, MapPin } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LocationPickerMap } from '../../components/registration/LocationPickerMap';
import { SearchableTomSelect } from '../../components/ui/SearchableTomSelect';
import { listHaderBoundaryCities } from '../../services/haderZoneService';
import {
  createPickupLocation,
  getPickupLocation,
  PickupLocationRequestError,
  updatePickupLocation,
  type PickupLocationInput,
} from '../../services/pickupLocationsService';

const empty: PickupLocationInput = {
  name: '',
  cityId: '',
  address: '',
  postalCode: null,
  latitude: null,
  longitude: null,
  status: 'ACTIVE',
};

export function AdminPickupLocationDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState(empty);
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<PickupLocationFieldErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const postalCodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listHaderBoundaryCities().then((rows) =>
      setCities(rows.filter((city) => city.isActive)),
    );

    if (id) {
      void getPickupLocation(id)
        .then((item) =>
          setForm({
            name: item.name,
            cityId: item.cityId,
            address: item.address,
            postalCode: item.postalCode,
            latitude: item.latitude,
            longitude: item.longitude,
            status: item.status,
          }),
        )
        .catch(() => setError('Unable to load pickup location.'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: city.name })),
    [cities],
  );

  const validateAndSetField = <FieldName extends PickupLocationField>(
    field: FieldName,
    value: PickupLocationInput[FieldName],
  ) => {
    const fieldError = validatePickupLocationField(field, value);
    setFields((current) => {
      if (fieldError) return { ...current, [field]: fieldError };
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    return fieldError;
  };

  const focusFirstInvalidField = (fieldErrors: PickupLocationFieldErrors) => {
    const firstInvalidField = pickupLocationFieldOrder.find((field) => fieldErrors[field]);
    if (firstInvalidField === 'name') nameRef.current?.focus();
    if (firstInvalidField === 'cityId') {
      cityRef.current?.querySelector<HTMLInputElement>('.ts-control input')?.focus();
    }
    if (firstInvalidField === 'address') addressRef.current?.focus();
    if (firstInvalidField === 'postalCode') postalCodeRef.current?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const frontendErrors = validatePickupLocation(form);
    setFields(frontendErrors);
    if (Object.keys(frontendErrors).length > 0) {
      focusFirstInvalidField(frontendErrors);
      return;
    }

    setSaving(true);

    try {
      if (id) await updatePickupLocation(id, form);
      else await createPickupLocation(form);
      navigate('/admin/pickup-locations');
    } catch (cause) {
      if (cause instanceof PickupLocationRequestError) {
        setError(cause.message);
        setFields(toPickupLocationFieldErrors(cause.fieldErrors));
      } else {
        setError('Unable to save pickup location.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="customer-card rounded-xl border p-8 text-sm">
        Loading pickup location...
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-[1200px] space-y-5">
      <div className="customer-secondary text-sm">
        <Link to="/admin/pickup-locations">Pickup-from Locations</Link>
        <span className="mx-2">/</span>
        <span className="customer-text">
          {editing ? 'Edit Location' : 'New Pickup Location'}
        </span>
      </div>

      <header className="customer-border-soft flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="customer-text text-2xl font-bold">
            {editing ? 'Edit Pickup Location' : 'New Pickup Location'}
          </h1>
          <p className="customer-secondary mt-1 text-sm">
            Configure an approved plant or depot for customer pick-up.
          </p>
        </div>

        <button
          disabled={saving}
          className="customer-primary-bg inline-flex h-11 items-center rounded-lg px-6 font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}

      <section className="customer-card rounded-xl border p-5">
        <h2 className="customer-primary customer-border-soft border-b pb-3 font-bold">
          Location Information
        </h2>
        <div className="mt-5 space-y-5">
<div className="grid w-full max-w-[760px] grid-cols-1 gap-5 sm:grid-cols-2">            <Field label="Location Name" required error={fields.name}>
              <input
                ref={nameRef}
                value={form.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm({ ...form, name });
                  validateAndSetField('name', name);
                }}
                onBlur={() => validateAndSetField('name', form.name)}
                className="customer-input h-11 w-full rounded-lg border px-3"
              />
            </Field>

            <Field label="City" required error={fields.cityId}>
              <div ref={cityRef} onBlur={() => validateAndSetField('cityId', form.cityId)}>
                <SearchableTomSelect
                  value={form.cityId}
                  options={cityOptions}
                  placeholder="Select City"
                  ariaLabel="City"
                  onChange={(cityId) => {
                    setForm({ ...form, cityId });
                    validateAndSetField('cityId', cityId);
                  }}
                />
              </div>
            </Field>
          </div>

          <div className="w-full max-w-[760px]">
            <Field label="Address" required error={fields.address}>
              <textarea
                ref={addressRef}
                value={form.address}
                onChange={(event) => {
                  const address = event.target.value;
                  setForm({ ...form, address });
                  if (fields.address) validateAndSetField('address', address);
                }}
                onBlur={() => validateAndSetField('address', form.address)}
                rows={3}
                className="customer-input w-full resize-y rounded-lg border p-3"
              />
            </Field>
          </div>

<div className="grid w-full max-w-[500px] grid-cols-1 gap-5 sm:grid-cols-2">            <Field label="Postal Code" error={fields.postalCode}>
              <input
                ref={postalCodeRef}
                inputMode="numeric"
                maxLength={5}
                value={form.postalCode ?? ''}
                onChange={(event) => {
                  const rawPostalCode = event.target.value;
                  const numericPostalCode = rawPostalCode.replace(/\D/g, '').slice(0, 5);
                  const postalCode = numericPostalCode || null;
                  setForm({ ...form, postalCode });
                  if (/\D/.test(rawPostalCode)) {
                    setFields((current) => ({
                      ...current,
                      postalCode: 'Postal code must contain exactly 5 digits.',
                    }));
                  } else {
                    validateAndSetField('postalCode', postalCode);
                  }
                }}
                onBlur={() => validateAndSetField('postalCode', form.postalCode)}
                className="customer-input h-11 w-full rounded-lg border px-3"
              />
            </Field>

            <Field label="Status" error={fields.status}>
              <select
                value={form.status}
                onChange={(event) => {
                  const status = event.target.value as PickupLocationInput['status'];
                  setForm({ ...form, status });
                  validateAndSetField('status', status);
                }}
                className="customer-input h-11 w-full rounded-lg border px-3"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </div>
        </div>
      </section>

      <section className="customer-card rounded-xl border p-5">
        <div className="customer-border-soft border-b pb-3">
          <h2 className="customer-primary font-bold">Map Location</h2>
          <p className="customer-secondary mt-1 text-sm">
            Select the operational coordinates for this pickup location.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="customer-border customer-hover customer-text mt-5 flex min-h-28 w-full items-center justify-center gap-3 rounded-xl border border-dashed px-5 font-semibold"
        >
          <MapPin size={20} className="customer-primary" />
          {form.latitude == null ? 'Map / Select Location' : 'Update Map Location'}
        </button>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Latitude">
            <input
              readOnly
              value={form.latitude ?? ''}
              placeholder="Not selected"
              className="customer-input h-11 w-full rounded-lg border px-3"
            />
          </Field>
          <Field label="Longitude">
            <input
              readOnly
              value={form.longitude ?? ''}
              placeholder="Not selected"
              className="customer-input h-11 w-full rounded-lg border px-3"
            />
          </Field>
        </div>
      </section>

      <Link
        to="/admin/pickup-locations"
        className="customer-secondary inline-flex items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft size={16} />
        Back to Pickup Locations
      </Link>

      {mapOpen && (
        <LocationPickerMap
          initialCoordinates={
            form.latitude != null && form.longitude != null
              ? { latitude: form.latitude, longitude: form.longitude }
              : undefined
          }
          locationLabel={form.name || 'pickup location'}
          onCancel={() => setMapOpen(false)}
          onConfirm={(point) => {
            setForm({ ...form, ...point });
            setMapOpen(false);
          }}
        />
      )}
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="customer-text mb-2 block text-sm font-semibold">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#b42318]">{error}</span>}
    </label>
  );
}

type PickupLocationField = 'name' | 'cityId' | 'address' | 'postalCode' | 'status';
type PickupLocationFieldErrors = Partial<Record<PickupLocationField, string>>;

const pickupLocationFieldOrder: PickupLocationField[] = [
  'name',
  'cityId',
  'address',
  'postalCode',
  'status',
];

function validatePickupLocation(form: PickupLocationInput) {
  return pickupLocationFieldOrder.reduce<PickupLocationFieldErrors>((errors, field) => {
    const fieldError = validatePickupLocationField(field, form[field]);
    if (fieldError) errors[field] = fieldError;
    return errors;
  }, {});
}

function toPickupLocationFieldErrors(errors: Record<string, string>) {
  return pickupLocationFieldOrder.reduce<PickupLocationFieldErrors>((result, field) => {
    const message = errors[field];
    if (message) result[field] = message;
    return result;
  }, {});
}

function validatePickupLocationField(
  field: PickupLocationField,
  value: PickupLocationInput[PickupLocationField],
) {
  const textValue = typeof value === 'string' ? value.trim() : '';

  if (field === 'name') {
    if (!textValue) return 'Location name is required.';
    if (!/\p{L}/u.test(textValue) || /\p{N}/u.test(textValue)) {
      return 'Location name must contain a valid name.';
    }
    if (textValue.length > 150) return 'Location name must be 150 characters or fewer.';
  }

  if (field === 'cityId' && !textValue) return 'City is required.';

  if (field === 'address') {
    if (!textValue) return 'Address is required.';
    if (textValue.length > 500) return 'Address must be 500 characters or fewer.';
  }

  if (field === 'postalCode' && textValue && !/^\d{5}$/.test(textValue)) {
    return 'Postal code must contain exactly 5 digits.';
  }

  if (field === 'status' && value !== 'ACTIVE' && value !== 'INACTIVE') {
    return 'Select a valid status.';
  }

  return '';
}
