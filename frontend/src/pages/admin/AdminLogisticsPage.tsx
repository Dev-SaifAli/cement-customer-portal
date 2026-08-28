import { Eye, FileUp, Pencil, Plus, Power, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSalesAuth } from '../../context/SalesAuthContext';
import {
  createLogistics,
  getLogisticsReferences,
  listLogistics,
  updateLogistics,
  uploadLogisticsDocument,
  type HaderDriver,
  type HaderTruck,
  type LogisticsKind,
  type LogisticsRecord,
  type LogisticsReferences,
  type Transporter,
  type TransporterCost,
} from '../../services/internalLogisticsService';

const configs = {
  transporters: {
    title: 'Transporters',
    description: 'Manage approved logistics service providers.',
    button: 'Add Transporter',
  },
  'transporter-costs': {
    title: 'Transporter Costs',
    description: 'Maintain internal transportation cost in SAR / TON.',
    button: 'Add Cost',
  },
  fleet: {
    title: 'Hader Delivery Fleet',
    description: 'Manage AlSafwa-owned delivery trucks.',
    button: 'Add Truck',
  },
  drivers: {
    title: 'Hader Drivers',
    description: 'Manage internal delivery drivers and licenses.',
    button: 'Add Driver',
  },
} as const;

export function AdminLogisticsPage({ kind }: { kind: LogisticsKind }) {
  const { user } = useSalesAuth();
  const canManage = user?.role === 'PRICING_ADMIN';
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('');
  const [data, setData] = useState<{
    items: LogisticsRecord[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>({ items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [formOpen, setFormOpen] = useState(false),
    [editing, setEditing] = useState<LogisticsRecord | null>(null),
    [viewing, setViewing] = useState<LogisticsRecord | null>(null),
    [refs, setRefs] = useState<LogisticsReferences>({ transporters: [], cities: [], drivers: [] });
  const config = configs[kind];
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listLogistics(kind, page, search, status));
    } catch {
      setError('Unable to load logistics records.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [kind, page, search, status]);
  useEffect(() => {
    void getLogisticsReferences()
      .then(setRefs)
      .catch(() => undefined);
  }, [kind]);
  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (record: LogisticsRecord) => {
    setEditing(record);
    setFormOpen(true);
  };
  const deactivate = async (record: LogisticsRecord) => {
    if (!confirm('Deactivate this record?')) return;
    try {
      await updateLogistics(kind, record.id, { status: 'INACTIVE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update record.');
    }
  };
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1b23]">{config.title}</h1>
          <p className="mt-1 text-sm text-[#64748b]">{config.description}</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-semibold text-white hover:bg-[#472066]"
          >
            <Plus size={16} />
            {config.button}
          </button>
        )}
      </header>
      <section className="overflow-hidden rounded-xl border border-[#e3e1e8] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e1e8] p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 text-[#94a3b8]" size={17} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={`Search ${config.title.toLowerCase()}`}
              className="h-10 w-full rounded-lg border border-[#e2e8f0] pl-9 pr-3 text-sm outline-none focus:border-[#54247a]"
            />
          </div>
          <div className="flex items-center gap-3">
            {kind !== 'transporter-costs' && (
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-[#e2e8f0] px-3 text-sm"
              >
                <option value="">All statuses</option>
                {statusOptions(kind).map((x) => (
                  <option key={x} value={x}>
                    {label(x)}
                  </option>
                ))}
              </select>
            )}
            <span className="text-sm text-[#64748b]">{data.pagination.total} records</span>
          </div>
        </div>
        {error && (
          <div className="m-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#b42318]">
            <span>{error}</span>
            <button onClick={() => void load()} className="font-semibold">
              Retry
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              <tr>
                {columns(kind).map((c) => (
                  <th key={c} className="px-4 py-3">
                    {c}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns(kind).map((c) => (
                      <td key={c} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                    <td />
                  </tr>
                ))
              ) : data.items.length ? (
                data.items.map((r) => (
                  <Row
                    key={r.id}
                    kind={kind}
                    record={r}
                    canManage={canManage}
                    onView={() => setViewing(r)}
                    onEdit={() => openEdit(r)}
                    onDeactivate={() => void deactivate(r)}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns(kind).length + 1}
                    className="px-4 py-12 text-center text-[#64748b]"
                  >
                    No records available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#e3e1e8] px-4 py-3 text-sm text-[#64748b]">
          <span>
            Showing {data.items.length ? (page - 1) * 10 + 1 : 0}–
            {Math.min(page * 10, data.pagination.total)} of {data.pagination.total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="rounded-lg border border-[#54247a] px-3 py-2 text-[#54247a]">
              {page}
            </span>
            <button
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {formOpen && (
        <LogisticsForm
          kind={kind}
          record={editing}
          refs={refs}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            setRefs(await getLogisticsReferences());
            await load();
          }}
        />
      )}
      {viewing && <Detail record={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function Row({
  kind,
  record,
  canManage,
  onView,
  onEdit,
  onDeactivate,
}: {
  kind: LogisticsKind;
  record: LogisticsRecord;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  const values = rowValues(kind, record);
  return (
    <tr className="hover:bg-[#faf8fc]">
      {values.map((v, i) => (
        <td key={i} className="px-4 py-3 text-[#1a1b23]">
          {i === 0 ? <span className="font-semibold text-[#54247a]">{v}</span> : v}
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <IconButton title="View" onClick={onView}>
            <Eye size={16} />
          </IconButton>
          {canManage && (
            <>
              <IconButton title="Edit" onClick={onEdit}>
                <Pencil size={16} />
              </IconButton>
              {kind !== 'transporter-costs' && (
                <IconButton title="Deactivate" onClick={onDeactivate}>
                  <Power size={16} />
                </IconButton>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded-md border border-[#e2e8f0] p-2 text-[#64748b] hover:border-[#54247a] hover:text-[#54247a]"
    >
      {children}
    </button>
  );
}

function LogisticsForm({
  kind,
  record,
  refs,
  onClose,
  onSaved,
}: {
  kind: LogisticsKind;
  record: LogisticsRecord | null;
  refs: LogisticsReferences;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initial = useMemo(() => toForm(record), [record]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = payloadFor(kind, values);
      const saved = record
        ? await updateLogistics<LogisticsRecord>(kind, record.id, payload)
        : await createLogistics<LogisticsRecord>(kind, payload);
      if (kind !== 'transporter-costs') {
        const entity =
          kind === 'transporters' ? 'transporter' : kind === 'fleet' ? 'truck' : 'driver';
        for (const [type, file] of Object.entries(files))
          await uploadLogisticsDocument(entity, saved.id, type, file);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save record.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold">
            {record ? 'Edit' : 'Add'} {configs[kind].title.replace(/s$/, '')}
          </h2>
          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {fields(kind, refs).map((f) => (
            <Field
              key={f.key}
              field={f}
              value={values[f.key] ?? ''}
              onChange={(v) => set(f.key, v)}
            />
          ))}
          {kind !== 'transporter-costs' &&
            documentTypes(kind).map((type) => (
              <label key={type.key} className="text-sm font-medium text-[#1a1b23]">
                <span className="mb-1 flex items-center gap-2">
                  <FileUp size={15} />
                  {type.label}
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setFiles((v) => ({ ...v, [type.key]: file }));
                  }}
                  className="block w-full text-sm text-[#64748b] file:mr-3 file:rounded-md file:border-0 file:bg-[#f6f2fa] file:px-3 file:py-2 file:font-semibold file:text-[#54247a]"
                />
              </label>
            ))}
        </div>
        {error && <p className="mx-5 rounded-lg bg-red-50 p-3 text-sm text-[#b42318]">{error}</p>}
        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            className="rounded-lg bg-[#54247a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

type FieldDef = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};
function Field({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm font-medium">
      <span className="mb-1 block">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </span>
      {field.options ? (
        <select
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-lg border px-3"
        >
          <option value="">Select</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          required={field.required}
          type={field.type ?? 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-lg border px-3 outline-none focus:border-[#54247a]"
        />
      )}
    </label>
  );
}
function Detail({ record, onClose }: { record: LogisticsRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="flex justify-between">
          <h2 className="text-lg font-bold">Record Details</h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {Object.entries(record)
            .filter(([k]) => !['id'].includes(k))
            .map(([k, v]) => (
              <div key={k} className="rounded-lg bg-[#f8fafc] p-3">
                <dt className="text-xs uppercase text-[#64748b]">{label(k)}</dt>
                <dd className="mt-1 break-words text-sm font-semibold">
                  {String(v ?? 'Not provided')}
                </dd>
              </div>
            ))}
        </dl>
      </div>
    </div>
  );
}

function columns(kind: LogisticsKind) {
  if (kind === 'transporters')
    return ['Transporter ID', 'Company Name', 'Contact Person', 'Phone', 'Email', 'Status'];
  if (kind === 'transporter-costs')
    return [
      'Transporter',
      'Hader City',
      'Product Type',
      'Cost SAR / TON',
      'Updated By',
      'Updated At',
    ];
  if (kind === 'fleet')
    return [
      'Truck ID',
      'Plate Number',
      'Vehicle Type',
      'Capacity TON',
      'Assigned Driver',
      'Status',
    ];
  return ['Driver ID', 'Name', 'Mobile', 'License Number', 'Status'];
}
function rowValues(kind: LogisticsKind, r: LogisticsRecord): React.ReactNode[] {
  if (kind === 'transporters') {
    const x = r as Transporter;
    return [
      x.transporterNumber,
      x.companyName,
      x.contactPerson ?? 'Not provided',
      x.phone,
      x.email ?? 'Not provided',
      <Status value={x.status} />,
    ];
  }
  if (kind === 'transporter-costs') {
    const x = r as TransporterCost;
    return [
      x.companyName ?? x.transporterNumber ?? '—',
      x.haderCityName ?? '—',
      label(x.cementType),
      `${Number(x.costPerTon ?? 0).toFixed(2)} SAR`,
      x.updatedBy ?? '—',
      new Date(x.updatedAt).toLocaleString(),
    ];
  }
  if (kind === 'fleet') {
    const x = r as HaderTruck;
    return [
      x.truckNumber,
      x.plateNumber,
      x.vehicleType,
      formatNumber(x.capacityTon, 3),
      x.assignedDriverName ?? 'Unassigned',
      <Status value={x.status} />,
    ];
  }
  const x = r as HaderDriver;
  return [x.driverNumber, x.name, x.mobile, x.licenseNumber, <Status value={x.status} />];
}
function Status({ value }: { value: string }) {
  const good = ['ACTIVE', 'AVAILABLE'].includes(value);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${good ? 'bg-emerald-500' : value === 'ASSIGNED' ? 'bg-blue-500' : value === 'MAINTENANCE' ? 'bg-amber-500' : 'bg-slate-400'}`}
      />
      {label(value)}
    </span>
  );
}
function formatNumber(value: unknown, fractionDigits: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(fractionDigits) : 'Not provided';
}
function fields(kind: LogisticsKind, refs: LogisticsReferences): FieldDef[] {
  if (kind === 'transporters')
    return [
      { key: 'name', label: 'Transporter Name', required: true },
      { key: 'companyName', label: 'Company Name', required: true },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'phone', label: 'Phone', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'crNumber', label: 'CR Number' },
      { key: 'status', label: 'Status', options: opts(['ACTIVE', 'INACTIVE']) },
    ];
  if (kind === 'transporter-costs')
    return [
      {
        key: 'transporterId',
        label: 'Transporter',
        required: true,
        options: refs.transporters.map((x) => ({
          value: x.id,
          label: `${x.transporter_number} — ${x.company_name}`,
        })),
      },
      {
        key: 'haderCityId',
        label: 'Hader City',
        required: true,
        options: refs.cities.map((x) => ({ value: x.id, label: x.name })),
      },
      {
        key: 'cementType',
        label: 'Product Type',
        required: true,
        options: opts(['STANDARD_CEMENT', 'WHITE_CEMENT']),
      },
      { key: 'costPerTon', label: 'Cost SAR / TON', required: true, type: 'number' },
    ];
  if (kind === 'fleet')
    return [
      { key: 'plateNumber', label: 'Plate Number', required: true },
      { key: 'vehicleType', label: 'Vehicle Type', required: true },
      { key: 'capacityTon', label: 'Capacity TON', required: true, type: 'number' },
      { key: 'modelYear', label: 'Model / Year', type: 'number' },
      {
        key: 'assignedDriverId',
        label: 'Assigned Driver',
        options: refs.drivers.map((x) => ({
          value: x.id,
          label: `${x.driver_number} — ${x.name}`,
        })),
      },
      {
        key: 'status',
        label: 'Status',
        options: opts(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'INACTIVE']),
      },
    ];
  return [
    { key: 'name', label: 'Name', required: true },
    { key: 'mobile', label: 'Mobile', required: true },
    { key: 'licenseNumber', label: 'License Number', required: true },
    { key: 'licenseExpiry', label: 'License Expiry', type: 'date' },
    { key: 'status', label: 'Status', options: opts(['ACTIVE', 'INACTIVE']) },
  ];
}
function payloadFor(kind: LogisticsKind, v: Record<string, string>) {
  const clean = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== ''));
  if (kind === 'fleet') {
    return {
      ...clean,
      capacityTon: Number(v.capacityTon),
      modelYear: v.modelYear ? Number(v.modelYear) : null,
      assignedDriverId: v.assignedDriverId || null,
    };
  }
  if (kind === 'transporter-costs') return { ...clean, costPerTon: Number(v.costPerTon) };
  return clean;
}
function toForm(record: LogisticsRecord | null) {
  if (!record) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) out[k] = v == null ? '' : String(v);
  return out;
}
function statusOptions(kind: LogisticsKind) {
  return kind === 'fleet'
    ? ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'INACTIVE']
    : ['ACTIVE', 'INACTIVE'];
}
function opts(values: string[]) {
  return values.map((value) => ({ value, label: label(value) }));
}
function label(value?: string | null) {
  if (!value) return 'Not provided';
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function documentTypes(kind: LogisticsKind) {
  if (kind === 'transporters')
    return [
      { key: 'CR_DOCUMENT', label: 'CR Document' },
      { key: 'INSURANCE', label: 'Insurance' },
      { key: 'AGREEMENT', label: 'Agreement' },
      { key: 'OTHER_SUPPORTING_DOCUMENT', label: 'Other Supporting Document' },
    ];
  if (kind === 'fleet')
    return [
      { key: 'REGISTRATION', label: 'Registration' },
      { key: 'INSURANCE', label: 'Insurance' },
    ];
  return [
    { key: 'LICENSE', label: 'License' },
    { key: 'IDENTITY', label: 'Identity Document' },
  ];
}
