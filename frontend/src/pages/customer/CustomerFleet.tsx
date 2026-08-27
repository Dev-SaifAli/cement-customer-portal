import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Pencil,
  Plus,
  PowerOff,
  Search,
  Truck,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import {
  createCustomerDriver,
  createCustomerTruck,
  getCustomerDrivers,
  getCustomerTrucks,
  getFleetDocumentUrl,
  updateCustomerDriver,
  updateCustomerTruck,
  uploadFleetDocument,
  type CustomerDriver,
  type CustomerTruck,
  type DriverPayload,
  type FleetPagination,
  type FleetStatus,
  type TruckPayload,
} from '../../services/customerFleetService';

type Tab = 'trucks' | 'drivers';
type FleetRecord = CustomerTruck | CustomerDriver;
const emptyPagination: FleetPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
const vehicleTypes = ['Flatbed Truck', 'Bulk Tanker', 'Trailer', 'Tipper Truck', 'Other'];
const formControlClass =
  'customer-input customer-border customer-text h-11 w-full rounded-lg border px-3 outline-none focus:border-[#54247a] focus:ring-1 focus:ring-[#54247a]';

export function CustomerFleet() {
  const [tab, setTab] = useState<Tab>('trucks');
  const [trucks, setTrucks] = useState<CustomerTruck[]>([]);
  const [drivers, setDrivers] = useState<CustomerDriver[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | FleetStatus>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<FleetRecord | null>(null);
  const [editing, setEditing] = useState<FleetRecord | null>(null);
  const [deactivating, setDeactivating] = useState<FleetRecord | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'trucks') {
        const data = await getCustomerTrucks(page, search, status);
        setTrucks(data.trucks);
        setPagination(data.pagination);
      } else {
        const data = await getCustomerDrivers(page, search, status);
        setDrivers(data.drivers);
        setPagination(data.pagination);
      }
    } catch {
      setError(`Unable to load ${tab}. Please try again.`);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, tab]);

  useEffect(() => {
    void load();
  }, [load]);
  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
    setSearchInput('');
    setSearch('');
    setStatus('');
    setError('');
    setNotice('');
    setViewing(null);
    setEditing(null);
  };
  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  };
  const deactivate = async () => {
    if (!deactivating) return;
    try {
      if (isTruck(deactivating)) await updateCustomerTruck(deactivating.id, { status: 'INACTIVE' });
      else await updateCustomerDriver(deactivating.id, { status: 'INACTIVE' });
      setDeactivating(null);
      showNotice('Record deactivated.');
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to deactivate record.',
      );
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold customer-text">My Trucks &amp; Drivers</h1>
          <p className="mt-1 text-sm customer-text-muted">
            Manage your vehicles and drivers for pickup orders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#54247a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#472066]"
        >
          <Plus size={16} /> Add {tab === 'trucks' ? 'Truck' : 'Driver'}
        </button>
      </header>

      {(error || notice) && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          <AlertCircle size={16} />
          {error || notice}
        </div>
      )}

      <section className="customer-surface customer-border overflow-hidden rounded-xl border shadow-sm">
        <div className="flex border-b customer-border">
          <TabButton
            active={tab === 'trucks'}
            onClick={() => changeTab('trucks')}
            icon={<Truck size={17} />}
            label="Trucks"
          />
          <TabButton
            active={tab === 'drivers'}
            onClick={() => changeTab('drivers')}
            icon={<UserRound size={17} />}
            label="Drivers"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b customer-border p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 customer-text-muted" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={
                tab === 'trucks' ? 'Search ID, plate or type' : 'Search ID, name, mobile or license'
              }
              className="customer-input h-10 w-full rounded-lg border pl-9 pr-3 text-sm outline-none focus:border-[#54247a]"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as '' | FleetStatus);
                setPage(1);
              }}
              className="customer-input h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <span className="text-sm font-semibold customer-text-muted">
              {pagination.total} {tab === 'trucks' ? 'Trucks' : 'Drivers'}
            </span>
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : tab === 'trucks' ? (
          <TruckTable
            trucks={trucks}
            onView={setViewing}
            onEdit={setEditing}
            onDeactivate={setDeactivating}
          />
        ) : (
          <DriverTable
            drivers={drivers}
            onView={setViewing}
            onEdit={setEditing}
            onDeactivate={setDeactivating}
          />
        )}

        {!loading && pagination.total > 0 && (
          <Pagination pagination={pagination} onPage={setPage} />
        )}
      </section>

      {(formOpen || editing) &&
        (tab === 'trucks' ? (
          <TruckForm
            truck={editing && isTruck(editing) ? editing : null}
            onClose={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSaved={async () => {
              setFormOpen(false);
              setEditing(null);
              showNotice('Truck saved.');
              await load();
            }}
          />
        ) : (
          <DriverForm
            driver={editing && !isTruck(editing) ? editing : null}
            onClose={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSaved={async () => {
              setFormOpen(false);
              setEditing(null);
              showNotice('Driver saved.');
              await load();
            }}
          />
        ))}
      {viewing && <ViewDialog record={viewing} onClose={() => setViewing(null)} />}
      {deactivating && (
        <ConfirmDialog
          record={deactivating}
          onClose={() => setDeactivating(null)}
          onConfirm={() => void deactivate()}
        />
      )}
    </div>
  );
}

function TruckTable({
  trucks,
  onView,
  onEdit,
  onDeactivate,
}: {
  trucks: CustomerTruck[];
  onView: (r: CustomerTruck) => void;
  onEdit: (r: CustomerTruck) => void;
  onDeactivate: (r: CustomerTruck) => void;
}) {
  if (!trucks.length)
    return (
      <EmptyState
        icon={<Truck size={25} />}
        title="No trucks available"
        message="Add your first customer-owned truck to build the fleet directory."
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="customer-surface-secondary customer-text-muted text-xs uppercase">
          <tr>
            <Th>Truck ID</Th>
            <Th>Plate Number</Th>
            <Th>Vehicle Type</Th>
            <Th>Capacity</Th>
            <Th>Carrier / Owner</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y customer-divide">
          {trucks.map((truck) => (
            <tr key={truck.id} className="customer-row-hover">
              <Td className="font-semibold text-[#54247a]">{truck.truckNumber}</Td>
              <Td className="font-semibold">{truck.plateNumber}</Td>
              <Td>{truck.vehicleType}</Td>
              <Td>{formatTon(truck.capacityTon)}</Td>
              <Td>{truck.carrierName || 'Not provided'}</Td>
              <Td>
                <Status status={truck.status} />
              </Td>
              <Td>
                <Actions
                  record={truck}
                  onView={onView}
                  onEdit={onEdit}
                  onDeactivate={onDeactivate}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DriverTable({
  drivers,
  onView,
  onEdit,
  onDeactivate,
}: {
  drivers: CustomerDriver[];
  onView: (r: CustomerDriver) => void;
  onEdit: (r: CustomerDriver) => void;
  onDeactivate: (r: CustomerDriver) => void;
}) {
  if (!drivers.length)
    return (
      <EmptyState
        icon={<UserRound size={25} />}
        title="No drivers available"
        message="Add the drivers authorized to operate your customer-owned fleet."
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="customer-surface-secondary customer-text-muted text-xs uppercase">
          <tr>
            <Th>Driver ID</Th>
            <Th>Name</Th>
            <Th>Mobile</Th>
            <Th>License Number</Th>
            <Th>License Expiry</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y customer-divide">
          {drivers.map((driver) => (
            <tr key={driver.id} className="customer-row-hover">
              <Td className="font-semibold text-[#54247a]">{driver.driverNumber}</Td>
              <Td className="font-semibold">{driver.name}</Td>
              <Td>{driver.mobile}</Td>
              <Td>{driver.licenseNumber}</Td>
              <Td>{driver.licenseExpiry ? formatDate(driver.licenseExpiry) : 'Not provided'}</Td>
              <Td>
                <Status status={driver.status} />
              </Td>
              <Td>
                <Actions
                  record={driver}
                  onView={onView}
                  onEdit={onEdit}
                  onDeactivate={onDeactivate}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TruckForm({
  truck,
  onClose,
  onSaved,
}: {
  truck: CustomerTruck | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<TruckPayload>({
    plateNumber: truck?.plateNumber ?? '',
    vehicleType: truck?.vehicleType ?? '',
    capacityTon: truck?.capacityTon ?? 0,
    carrierName: truck?.carrierName ?? '',
    status: truck?.status ?? 'ACTIVE',
  });
  const [registration, setRegistration] = useState<File | null>(null);
  const [insurance, setInsurance] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!form.plateNumber.trim() || !form.vehicleType || form.capacityTon <= 0) {
      setError('Plate number, vehicle type and a capacity above zero are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = truck
        ? await updateCustomerTruck(truck.id, form)
        : await createCustomerTruck(form);
      if (registration) await uploadFleetDocument('trucks', saved.id, 'registration', registration);
      if (insurance) await uploadFleetDocument('trucks', saved.id, 'insurance', insurance);
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save truck.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={truck ? 'Edit Truck' : 'Add Truck'} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plate Number *">
          <input
            value={form.plateNumber}
            onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
            className={formControlClass}
          />
        </Field>
        <Field label="Vehicle Type *">
          <select
            value={form.vehicleType}
            onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
            className={formControlClass}
          >
            <option value="">Select vehicle type</option>
            {vehicleTypes.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Capacity (TON) *">
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={form.capacityTon || ''}
            onChange={(e) => setForm({ ...form, capacityTon: Number(e.target.value) })}
            className={formControlClass}
          />
        </Field>
        <Field label="Carrier / Owner">
          <input
            value={form.carrierName ?? ''}
            onChange={(e) => setForm({ ...form, carrierName: e.target.value })}
            className={formControlClass}
          />
        </Field>
        <Field label="Registration Document">
          <FileInput onChange={setRegistration} />
        </Field>
        <Field label="Insurance Document">
          <FileInput onChange={setInsurance} />
        </Field>
      </div>
      <FormFooter error={error} saving={saving} onClose={onClose} onSave={() => void save()} />
    </Modal>
  );
}

function DriverForm({
  driver,
  onClose,
  onSaved,
}: {
  driver: CustomerDriver | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<DriverPayload>({
    name: driver?.name ?? '',
    mobile: driver?.mobile ?? '+9665',
    licenseNumber: driver?.licenseNumber ?? '',
    licenseExpiry: driver?.licenseExpiry ?? '',
    status: driver?.status ?? 'ACTIVE',
  });
  const [license, setLicense] = useState<File | null>(null);
  const [identity, setIdentity] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!form.name.trim() || !/^\+9665\d{8}$/.test(form.mobile) || !form.licenseNumber.trim()) {
      setError('Name, valid Saudi mobile and license number are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: DriverPayload = {
        name: form.name,
        mobile: form.mobile,
        licenseNumber: form.licenseNumber,
        status: form.status,
        ...(form.licenseExpiry ? { licenseExpiry: form.licenseExpiry } : {}),
      };
      const saved = driver
        ? await updateCustomerDriver(driver.id, payload)
        : await createCustomerDriver(payload);
      if (license) await uploadFleetDocument('drivers', saved.id, 'license', license);
      if (identity) await uploadFleetDocument('drivers', saved.id, 'identity', identity);
      if (photo) await uploadFleetDocument('drivers', saved.id, 'photo', photo);
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save driver.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={driver ? 'Edit Driver' : 'Add Driver'} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Driver Name *">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={formControlClass}
          />
        </Field>
        <Field label="Saudi Mobile *">
          <input
            value={form.mobile}
            onChange={(e) =>
              setForm({ ...form, mobile: e.target.value.replace(/[^+\d]/g, '').slice(0, 13) })
            }
            placeholder="+9665XXXXXXXX"
            className={formControlClass}
          />
        </Field>
        <Field label="License Number *">
          <input
            value={form.licenseNumber}
            onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
            className={formControlClass}
          />
        </Field>
        <Field label="License Expiry">
          <input
            type="date"
            value={form.licenseExpiry ?? ''}
            onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
            className={formControlClass}
          />
        </Field>
        <Field label="License Copy">
          <FileInput onChange={setLicense} />
        </Field>
        <Field label="Identity Document">
          <FileInput onChange={setIdentity} />
        </Field>
        <Field label="Driver Photo (Optional)">
          <FileInput onChange={setPhoto} images />
        </Field>
      </div>
      <FormFooter error={error} saving={saving} onClose={onClose} onSave={() => void save()} />
    </Modal>
  );
}

function ViewDialog({ record, onClose }: { record: FleetRecord; onClose: () => void }) {
  const truck = isTruck(record);
  const entity = truck ? 'trucks' : 'drivers';
  const openDocument = async (id: string) => {
    const response = await fetch(getFleetDocumentUrl(entity, record.id, id), {
      credentials: 'include',
    });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  return (
    <Modal title={truck ? record.truckNumber : record.driverNumber} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        {truck ? (
          <>
            <Detail label="Plate Number" value={record.plateNumber} />
            <Detail label="Vehicle Type" value={record.vehicleType} />
            <Detail label="Capacity" value={formatTon(record.capacityTon)} />
            <Detail label="Carrier / Owner" value={record.carrierName || 'Not provided'} />
          </>
        ) : (
          <>
            <Detail label="Name" value={record.name} />
            <Detail label="Mobile" value={record.mobile} />
            <Detail label="License Number" value={record.licenseNumber} />
            <Detail
              label="License Expiry"
              value={record.licenseExpiry ? formatDate(record.licenseExpiry) : 'Not provided'}
            />
          </>
        )}
        <Detail label="Status" value={record.status === 'ACTIVE' ? 'Active' : 'Inactive'} />
      </div>
      <div className="mt-5 border-t customer-border pt-4">
        <h3 className="text-sm font-semibold customer-text">Documents</h3>
        {record.attachments.length ? (
          <div className="mt-2 space-y-2">
            {record.attachments.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => void openDocument(file.id)}
                className="customer-row-hover flex w-full items-center gap-3 rounded-lg border customer-border px-3 py-2 text-left text-sm"
              >
                <FileText size={17} className="text-[#54247a]" />
                <span className="min-w-0 flex-1 truncate customer-text">{file.fileName}</span>
                <Eye size={16} className="customer-text-muted" />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm customer-text-muted">No documents uploaded.</p>
        )}
      </div>
    </Modal>
  );
}

function Actions({
  record,
  onView,
  onEdit,
  onDeactivate,
}: {
  record: FleetRecord;
  onView: (r: never) => void;
  onEdit: (r: never) => void;
  onDeactivate: (r: never) => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <IconButton label="View" onClick={() => onView(record as never)} icon={<Eye size={15} />} />
      <IconButton
        label="Edit"
        onClick={() => onEdit(record as never)}
        icon={<Pencil size={15} />}
      />
      {record.status === 'ACTIVE' && (
        <IconButton
          label="Deactivate"
          danger
          onClick={() => onDeactivate(record as never)}
          icon={<PowerOff size={15} />}
        />
      )}
    </div>
  );
}
function IconButton({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`rounded-md border p-2 transition ${danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'customer-border customer-text-muted customer-row-hover'}`}
    >
      {icon}
    </button>
  );
}
function Status({ status }: { status: FleetStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium">
      <span
        className={`h-2 w-2 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`}
      />
      {status === 'ACTIVE' ? 'Active' : 'Inactive'}
    </span>
  );
}
function Pagination({
  pagination,
  onPage,
}: {
  pagination: FleetPagination;
  onPage: (page: number) => void;
}) {
  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t customer-border px-4 py-3 text-sm customer-text-muted">
      <span>
        Showing {start}–{end} of {pagination.total}
      </span>
      <div className="flex gap-2">
        <button
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="rounded-md border customer-border p-2 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="flex min-w-9 items-center justify-center rounded-md border border-[#54247a] px-3 font-semibold text-[#54247a]">
          {pagination.page}
        </span>
        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
          className="rounded-md border customer-border p-2 disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold ${active ? 'border-[#54247a] text-[#54247a]' : 'border-transparent customer-text-muted hover:text-[#54247a]'}`}
    >
      {icon}
      {label}
    </button>
  );
}
function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <div className="rounded-xl bg-[#f4edf7] p-3 text-[#54247a]">{icon}</div>
      <h2 className="mt-3 font-semibold customer-text">{title}</h2>
      <p className="mt-1 max-w-sm text-sm customer-text-muted">{message}</p>
    </div>
  );
}
function TableSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-lg customer-surface-secondary" />
      ))}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <section className="customer-surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border customer-border shadow-xl">
        <header className="flex items-center justify-between border-b customer-border px-5 py-4">
          <h2 className="text-lg font-bold customer-text">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-2 customer-row-hover customer-text-muted"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium customer-text">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
function FileInput({
  onChange,
  images = false,
}: {
  onChange: (file: File | null) => void;
  images?: boolean;
}) {
  return (
    <label className={`${formControlClass} flex cursor-pointer items-center gap-2`}>
      <Upload size={16} />
      <span className="truncate text-sm customer-text-muted">Choose file</span>
      <input
        className="sr-only"
        type="file"
        accept={images ? '.jpg,.jpeg,.png' : '.pdf,.jpg,.jpeg,.png'}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
function FormFooter({
  error,
  saving,
  onClose,
  onSave,
}: {
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-5 border-t customer-border pt-4">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border customer-border px-4 py-2 text-sm font-semibold customer-text"
        >
          Cancel
        </button>
        <button
          disabled={saving}
          onClick={onSave}
          className="rounded-lg bg-[#54247a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#472066] disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
function ConfirmDialog({
  record,
  onClose,
  onConfirm,
}: {
  record: FleetRecord;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const reference = isTruck(record) ? record.truckNumber : record.driverNumber;
  return (
    <Modal title={`Deactivate ${reference}?`} onClose={onClose}>
      <div className="flex gap-3">
        <PowerOff className="mt-0.5 text-red-600" />
        <div>
          <p className="font-semibold customer-text">
            This record will no longer be available for future operational selection.
          </p>
          <p className="mt-1 text-sm customer-text-muted">
            Historical information and audit history will be preserved.
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border customer-border px-4 py-2 text-sm font-semibold customer-text"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Deactivate
        </button>
      </div>
    </Modal>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg customer-surface-secondary p-3">
      <p className="text-xs font-medium uppercase customer-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold customer-text">{value}</p>
    </div>
  );
}
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-3 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 customer-text ${className}`}>{children}</td>;
}
function isTruck(record: FleetRecord): record is CustomerTruck {
  return 'truckNumber' in record;
}
function formatTon(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} TON`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}
