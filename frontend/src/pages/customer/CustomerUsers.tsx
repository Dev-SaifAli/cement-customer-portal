import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Edit3,
  Plus,
  Power,
  PowerOff,
  Save,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import {
  formatSaudiPhoneNumber,
  getSaudiPhoneLocalDigits,
  isSaudiPhoneNumber,
} from '../../context/RegistrationContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import type { CustomerRole } from '../../services/customerAuthService';
import {
  createCustomerUser,
  getCustomerUsers,
  updateCustomerUser,
  type CustomerUser,
  type CreateCustomerUserPayload,
} from '../../services/customerUsersService';

type UserForm = {
  name: string;
  email: string;
  phone: string;
  role: CustomerRole;
  isActive: boolean;
};

type UserFilters = {
  name: string;
  email: string;
  phone: string;
  role: '' | CustomerRole;
  status: '' | 'active' | 'inactive';
};

const pageSize = 10;

const emptyForm: UserForm = {
  name: '',
  email: '',
  phone: '',
  role: 'PURCHASER',
  isActive: true,
};

const emptyFilters: UserFilters = {
  name: '',
  email: '',
  phone: '',
  role: '',
  status: '',
};

const roleOptions: Array<{ value: CustomerRole; label: string }> = [
  { value: 'PURCHASER', label: 'Purchaser' },
  { value: 'FINANCE_USER', label: 'Finance User' },
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'CUSTOMER_ADMIN', label: 'Customer Administrator' },
];

export function CustomerUsers() {
  const { user } = useCustomerAuth();
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CustomerUser | null>(null);
  const [editingUser, setEditingUser] = useState<CustomerUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<CustomerUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editForm, setEditForm] = useState<UserForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<UserFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isCustomerAdmin = user?.role === 'CUSTOMER_ADMIN';

  const filteredUsers = useMemo(() => {
    return users.filter((customerUser) => {
      const matchesName = includesValue(customerUser.name, filters.name);
      const matchesEmail = includesValue(customerUser.email, filters.email);
      const matchesPhone = includesValue(customerUser.phone ?? '', filters.phone);
      const matchesRole = !filters.role || customerUser.role === filters.role;
      const matchesStatus =
        !filters.status ||
        (filters.status === 'active' ? customerUser.isActive : !customerUser.isActive);

      return matchesName && matchesEmail && matchesPhone && matchesRole && matchesStatus;
    });
  }, [filters, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allVisibleSelected =
    visibleUsers.length > 0 &&
    visibleUsers.every((customerUser) => selectedIds.has(customerUser.id));

  useEffect(() => {
    const loadUsers = async () => {
      if (!isCustomerAdmin) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        setUsers(await getCustomerUsers());
      } catch {
        setError('Unable to load customer users. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadUsers();
  }, [isCustomerAdmin]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [filters]);

  const updateFilter = (field: keyof UserFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const updateForm = (field: keyof UserForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: '' }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setFormErrors({});
    setTemporaryPassword('');
  };

  const openCreateForm = () => {
    resetForm();
    setError('');
    setSuccess('');
    setFormOpen(true);
  };

  const closeCreateForm = () => {
    setFormOpen(false);
    resetForm();
  };

  const openEditForm = (customerUser: CustomerUser) => {
    setSelectedUser(null);
    setError('');
    setSuccess('');
    setEditForm({
      name: customerUser.name,
      email: customerUser.email,
      phone: customerUser.phone ?? '',
      role: customerUser.role,
      isActive: customerUser.isActive,
    });
    setEditFormErrors({});
    setEditingUser(customerUser);
  };

  const closeEditForm = () => {
    setEditingUser(null);
    setEditForm(emptyForm);
    setEditFormErrors({});
  };

  const createUser = async () => {
    if (!validateForm(form)) return;

    setSaving(true);
    setError('');
    setSuccess('');
    setTemporaryPassword('');

    try {
      const result = await createCustomerUser(toPayload(form));
      setUsers((current) => [...current, result.user]);
      setTemporaryPassword(result.temporaryPassword);
      setSuccess('Customer user created. Share the temporary password securely.');
      setForm(emptyForm);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to create customer user. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const saveUserChanges = async () => {
    if (!editingUser || !validateEditableForm(editForm)) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updatedUser = await updateCustomerUser(editingUser.id, {
        name: editForm.name.trim(),
        phone: toSaudiPhone(editForm.phone),
        role: editForm.role,
        isActive: editForm.isActive,
      });
      applyUpdatedUser(updatedUser);
      closeEditForm();
      setSuccess('Customer user updated.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update customer user. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updatedUser = await updateCustomerUser(statusTarget.id, {
        isActive: !statusTarget.isActive,
      });
      applyUpdatedUser(updatedUser);
      setStatusTarget(null);
      setSelectedUser(null);
      setSuccess(updatedUser.isActive ? 'Customer user activated.' : 'Customer user deactivated.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update customer user status. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const validateForm = (value: UserForm) => {
    const next: Record<string, string> = {};
    if (!value.name.trim()) next.name = 'Full name is required.';
    if (!isValidEmail(value.email)) next.email = 'Enter a valid email address.';
    if (!isSaudiPhoneNumber(value.phone)) next.phone = 'Enter a valid Saudi mobile number.';
    if (!roleOptions.some((role) => role.value === value.role)) next.role = 'Select a valid role.';

    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateEditableForm = (value: UserForm) => {
    const next: Record<string, string> = {};
    if (!value.name.trim()) next.name = 'Full name is required.';
    if (!isSaudiPhoneNumber(value.phone)) next.phone = 'Enter a valid Saudi mobile number.';
    if (!roleOptions.some((role) => role.value === value.role)) next.role = 'Select a valid role.';

    setEditFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const applyUpdatedUser = (updatedUser: CustomerUser) => {
    setUsers((current) =>
      current.map((customerUser) =>
        customerUser.id === updatedUser.id ? updatedUser : customerUser,
      ),
    );
  };

  const toggleRow = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleUsers.forEach((customerUser) => next.delete(customerUser.id));
      } else {
        visibleUsers.forEach((customerUser) => next.add(customerUser.id));
      }
      return next;
    });
  };

  if (!isCustomerAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Customer Users"
          description="User management is available to Customer Administrators only."
        />
        <section className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-5 text-sm font-semibold text-amber-800 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p>You do not have permission to manage customer users.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer Users"
        description="Manage portal users for your customer account."
        action={
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#472066]"
          >
            <Plus size={16} />
            Add User
          </button>
        }
      />

      {error && <StateMessage tone="error" message={error} />}
      {success && <StateMessage tone="success" message={success} />}

      {formOpen && (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-950">Add Customer User</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                A secure temporary password will be generated after creation.
              </p>
            </div>
            <button
              type="button"
              onClick={closeCreateForm}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close add user form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-5 pt-5 md:grid-cols-2">
            <TextInput
              label="Full Name"
              required
              value={form.name}
              error={formErrors.name}
              onChange={(value) => updateForm('name', value)}
            />
            <TextInput
              label="Email"
              required
              type="email"
              value={form.email}
              error={formErrors.email}
              onChange={(value) => updateForm('email', value)}
            />
            <PhoneInput
              label="Phone"
              required
              value={form.phone}
              error={formErrors.phone}
              onChange={(value) => updateForm('phone', value)}
            />
            <SelectInput
              label="Role"
              required
              value={form.role}
              error={formErrors.role}
              options={roleOptions}
              onChange={(value) => updateForm('role', value as CustomerRole)}
            />
            <SelectInput
              label="Status"
              value={form.isActive ? 'active' : 'inactive'}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              onChange={(value) => updateForm('isActive', value === 'active')}
            />
          </div>

          {temporaryPassword && (
            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-bold text-emerald-800">Temporary password</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-950 ring-1 ring-emerald-100">
                  {temporaryPassword}
                </code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(temporaryPassword)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  <Copy size={15} />
                  Copy
                </button>
              </div>
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Share this password securely. It will not be shown again after you close this form.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeCreateForm}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createUser()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-60"
            >
              <Plus size={16} />
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#54247a]" />
            <h2 className="text-sm font-bold text-slate-950">Users</h2>
          </div>
          <p className="text-sm font-bold text-slate-700">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'User' : 'Users'}
          </p>
        </div>

        {loading ? (
          <UsersSkeleton />
        ) : users.length === 0 ? (
          <EmptyState message="No customer users available." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-xs font-bold uppercase tracking-[0.04em] text-slate-500">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="h-4 w-4 rounded border-slate-300 accent-[#54247a]"
                        aria-label="Select visible users"
                      />
                    </th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Phone</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                  <tr className="border-t border-slate-200 bg-white">
                    <td className="px-4 py-2" />
                    <td className="px-3 py-2">
                      <FilterInput
                        value={filters.name}
                        placeholder="Name"
                        onChange={(value) => updateFilter('name', value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <FilterInput
                        value={filters.email}
                        placeholder="Email"
                        onChange={(value) => updateFilter('email', value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <FilterInput
                        value={filters.phone}
                        placeholder="Phone"
                        onChange={(value) => updateFilter('phone', value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <FilterSelect
                        value={filters.role}
                        onChange={(value) => updateFilter('role', value)}
                        options={[{ value: '', label: 'All Roles' }, ...roleOptions]}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <FilterSelect
                        value={filters.status}
                        onChange={(value) => updateFilter('status', value)}
                        options={[
                          { value: '', label: 'All Statuses' },
                          { value: 'active', label: 'Active' },
                          { value: 'inactive', label: 'Inactive' },
                        ]}
                      />
                    </td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleUsers.map((customerUser) => (
                    <tr key={customerUser.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customerUser.id)}
                          onChange={() => toggleRow(customerUser.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-[#54247a]"
                          aria-label={`Select ${customerUser.name}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(customerUser)}
                          className="text-left font-bold text-slate-950 hover:text-[#54247a]"
                        >
                          {customerUser.name}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(customerUser)}
                          className="max-w-[260px] truncate text-left font-medium text-slate-600 hover:text-[#54247a]"
                        >
                          {customerUser.email}
                        </button>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-600">
                        {customerUser.phone ?? 'Not provided'}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">
                        {customerUser.roleLabel}
                      </td>
                      <td className="px-3 py-3">
                        <StatusDot active={customerUser.isActive} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 ? (
              <EmptyState message="No users match the selected filters." />
            ) : (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                total={filteredUsers.length}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </section>

      {selectedUser && (
        <UserDetailsDialog
          user={selectedUser}
          saving={saving}
          onClose={() => setSelectedUser(null)}
          onEdit={() => openEditForm(selectedUser)}
          onToggleStatus={() => setStatusTarget(selectedUser)}
        />
      )}

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          form={editForm}
          errors={editFormErrors}
          saving={saving}
          onClose={closeEditForm}
          onChange={(field, value) => {
            setEditForm((current) => ({ ...current, [field]: value }));
            setEditFormErrors((current) => ({ ...current, [field]: '' }));
          }}
          onSave={() => void saveUserChanges()}
        />
      )}

      {statusTarget && (
        <ConfirmStatusDialog
          user={statusTarget}
          saving={saving}
          onCancel={() => setStatusTarget(null)}
          onConfirm={() => void confirmStatusChange()}
        />
      )}
    </div>
  );
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
        </div>
        {action}
      </div>
    </section>
  );
}

function TextInput(props: {
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  error?: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">
        {props.label}
        {props.required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className={`mt-2 h-11 w-full rounded-xl border px-3 text-sm font-medium outline-none focus:ring-2 ${
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

function PhoneInput(props: {
  label: string;
  value: string;
  required?: boolean;
  error?: string | undefined;
  onChange: (value: string) => void;
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

function SelectInput<TValue extends string>(props: {
  label: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  required?: boolean;
  error?: string | undefined;
  onChange: (value: TValue) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">
        {props.label}
        {props.required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value as TValue)}
        className={`mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:ring-2 ${
          props.error
            ? 'border-red-400 focus:ring-red-100'
            : 'border-slate-200 focus:border-[#54247a] focus:ring-[#54247a]/10'
        }`}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {props.error && (
        <span className="mt-1 block text-xs font-semibold text-red-600">{props.error}</span>
      )}
    </label>
  );
}

function FilterInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-9 w-full min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10"
    />
  );
}

function FilterSelect<TValue extends string>({
  value,
  options,
  onChange,
}: {
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as TValue)}
      className="h-9 w-full min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
      <span
        className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`}
        aria-hidden="true"
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function UserDetailsDialog({
  user,
  saving,
  onClose,
  onEdit,
  onToggleStatus,
}: {
  user: CustomerUser;
  saving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{user.name}</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close user details"
          >
            <X size={18} />
          </button>
        </div>

        <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Name" value={user.name} />
          <Field label="Email" value={user.email} />
          <Field label="Phone" value={user.phone} />
          <Field label="Role" value={user.roleLabel} />
          <Field label="Status" value={user.isActive ? 'Active' : 'Inactive'} />
          <Field
            label="Password State"
            value={user.passwordMustChange ? 'Temporary password' : 'Set'}
          />
        </dl>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={saving}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-60 ${
              user.isActive
                ? 'border-red-200 text-red-700 hover:bg-red-50'
                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {user.isActive ? <PowerOff size={16} /> : <Power size={16} />}
            {user.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-60"
          >
            <Edit3 size={16} />
            Edit User
          </button>
        </div>
      </section>
    </div>
  );
}

function EditUserDialog({
  user,
  form,
  errors,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  user: CustomerUser;
  form: UserForm;
  errors: Record<string, string>;
  saving: boolean;
  onClose: () => void;
  onChange: (field: keyof UserForm, value: string | boolean) => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Edit Customer User</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Login email is read-only for now: {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-60"
            aria-label="Close edit user form"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
          <TextInput
            label="Full Name"
            required
            value={form.name}
            error={errors.name}
            onChange={(value) => onChange('name', value)}
          />
          <label className="block">
            <span className="text-sm font-bold text-slate-900">Email</span>
            <input
              type="email"
              value={form.email}
              readOnly
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-500 outline-none"
            />
          </label>
          <PhoneInput
            label="Phone"
            required
            value={form.phone}
            error={errors.phone}
            onChange={(value) => onChange('phone', value)}
          />
          <SelectInput
            label="Role"
            required
            value={form.role}
            error={errors.role}
            options={roleOptions}
            onChange={(value) => onChange('role', value as CustomerRole)}
          />
          <SelectInput
            label="Status"
            value={form.isActive ? 'active' : 'inactive'}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            onChange={(value) => onChange('isActive', value === 'active')}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#472066] disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </section>
    </div>
  );
}

function ConfirmStatusDialog({
  user,
  saving,
  onCancel,
  onConfirm,
}: {
  user: CustomerUser;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDeactivation = user.isActive;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/20">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-xl p-2 ${
              isDeactivation ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {isDeactivation ? <PowerOff size={20} /> : <Power size={20} />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              {isDeactivation ? 'Deactivate user?' : 'Activate user?'}
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-600">
              {isDeactivation
                ? `${user.name} will no longer be able to sign in to the Customer Portal.`
                : `${user.name} will be able to sign in again if their password is valid.`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${
              isDeactivation ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isDeactivation ? <PowerOff size={16} /> : <Power size={16} />}
            {saving ? 'Updating...' : isDeactivation ? 'Deactivate User' : 'Activate User'}
          </button>
        </div>
      </section>
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

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function UsersSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="grid gap-4 rounded-xl border border-slate-100 p-3 md:grid-cols-5"
        >
          {Array.from({ length: 5 }, (__, cellIndex) => (
            <div key={cellIndex} className="h-4 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-6 text-sm font-semibold text-slate-500">
      <AlertCircle size={17} />
      {message}
    </div>
  );
}

function StateMessage({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const classes =
    tone === 'error'
      ? 'border-red-100 bg-red-50 text-red-700'
      : 'border-emerald-100 bg-emerald-50 text-emerald-700';
  const icon = tone === 'error' ? <AlertCircle size={17} /> : <Check size={17} />;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${classes}`}
    >
      {icon}
      {message}
    </div>
  );
}

function toPayload(form: UserForm): CreateCustomerUserPayload {
  return {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    phone: toSaudiPhone(form.phone),
    role: form.role,
    isActive: form.isActive,
  };
}

function toSaudiPhone(value: string) {
  return `+966${getSaudiPhoneLocalDigits(value)}`;
}

function includesValue(value: string, filter: string) {
  return value.toLowerCase().includes(filter.trim().toLowerCase());
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
