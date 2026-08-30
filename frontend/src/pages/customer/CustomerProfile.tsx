import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  formatSaudiPhoneNumber,
  getSaudiPhoneLocalDigits,
  isSaudiPhoneNumber,
} from '../../context/RegistrationContext';
import {
  getCustomerProfile,
  updateCustomerProfile,
  type CustomerProfileData,
} from '../../services/customerProfileService';

export function CustomerProfile() {
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ administratorName: '', contactPhone: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCustomerProfile();
      setProfile(data);
      setForm({
        administratorName: data.administrator.name,
        contactPhone: data.administrator.phone ?? '',
      });
    } catch {
      setError('Unable to load your customer profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.administratorName.trim()) next.administratorName = 'Name is required.';
    if (!isSaudiPhoneNumber(form.contactPhone)) {
      next.contactPhone = 'Enter a valid Saudi mobile number.';
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveProfile = async () => {
    if (!validate()) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await updateCustomerProfile({
        administratorName: form.administratorName.trim(),
        contactPhone: toApiSaudiPhone(form.contactPhone),
      });
      setProfile(data);
      setEditing(false);
      setSuccess('Profile updated successfully.');
    } catch {
      setError('Unable to save profile changes. Please review the form and try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setFormErrors({});
    setForm({
      administratorName: profile?.administrator.name ?? '',
      contactPhone: profile?.administrator.phone ?? '',
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Customer Profile</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Portal-owned company and administrator information
            </p>
          </div>
          {!editing && profile && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#472066]"
            >
              Edit Profile
            </button>
          )}
        </div>
      </section>

      {loading ? (
        <ProfileSkeleton />
      ) : error ? (
        <StateMessage message={error} actionLabel="Retry" onAction={() => void loadProfile()} />
      ) : profile ? (
        <>
          {success && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {success}
            </div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
            <h2 className="border-b border-slate-100 pb-4 text-base font-bold text-slate-950">
              Company Information
            </h2>
            <dl className="grid gap-x-6 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Company Name" value={profile.account.companyName} />
              <Field label="Registration Reference" value={profile.registration.reference} />
              <Field label="Account Status" value={formatAccountStatus(profile.account.status)} />
              <Field label="Activation Date" value={formatDate(profile.account.activatedAt)} />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
            <h2 className="border-b border-slate-100 pb-4 text-base font-bold text-slate-950">
              Administrator Information
            </h2>

            {editing ? (
              <div className="space-y-5 pt-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <TextInput
                    label="Name"
                    value={form.administratorName}
                    error={formErrors.administratorName}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, administratorName: value }))
                    }
                  />
                  <PhoneInput
                    label="Phone"
                    value={form.contactPhone}
                    error={formErrors.contactPhone}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, contactPhone: value }))
                    }
                  />
                </div>

                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Field label="Email" value={profile.administrator.email} />
                  <Field label="Role" value={formatCustomerRole(profile.administrator.role)} />
                </dl>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <dl className="grid gap-x-6 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Name" value={profile.administrator.name} />
                <Field label="Email" value={profile.administrator.email} />
                <Field label="Phone" value={profile.administrator.phone} />
                <Field label="Role" value={formatCustomerRole(profile.administrator.role)} />
              </dl>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((item) => (
        <section
          key={item}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6"
        >
          <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-x-6 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StateMessage({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value || 'Not provided'}</dd>
    </div>
  );
}

function TextInput({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 h-11 w-full rounded-xl border px-3 text-sm font-medium outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:ring-red-100'
            : 'border-slate-200 focus:border-[#54247a] focus:ring-[#54247a]/10'
        }`}
      />
      {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
    </label>
  );
}

function PhoneInput(props: {
  label: string;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">{props.label}</span>
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

function toApiSaudiPhone(value: string) {
  return `+966${getSaudiPhoneLocalDigits(value)}`;
}

function formatAccountStatus(status: string | null | undefined) {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'INACTIVE') return 'Inactive';
  return 'Not provided';
}

function formatCustomerRole(role: string | null | undefined) {
  if (role === 'CUSTOMER_ADMIN') return 'Customer Administrator';
  return 'Not provided';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
