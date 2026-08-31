import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { CalendarDays, ClipboardCheck, Search, Truck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  assignShipment,
  getDispatchFilters,
  getDispatchResources,
  listDispatch,
  type DispatchResource,
  type InternalPagination,
  type Shipment,
} from '../../services/haderDeliveryService';
import { Pager, Skeleton, State, Status, date, text } from './HaderDeliveryRequests';

const emptyPage = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
export function HaderDispatchBoard() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [pagination, setPagination] = useState<InternalPagination>(emptyPage);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [product, setProduct] = useState('');
  const [filterOptions, setFilterOptions] = useState<{
    cities: { id: string; name: string }[];
    products: { id: string; code: string; name: string }[];
  }>({ cities: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState<Shipment | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listDispatch({
        page,
        status: status || undefined,
        haderCityId: city || undefined,
        requestedDate: requestedDate || undefined,
        productId: product || undefined,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch {
      setError('Unable to load the dispatch board.');
    } finally {
      setLoading(false);
    }
  }, [city, page, product, requestedDate, status]);
  useEffect(() => {
    void getDispatchFilters()
      .then(setFilterOptions)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Dispatch Board</h1>
        <p className="mt-1 text-sm text-slate-500">Manage and assign shipments for delivery.</p>
      </header>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Filter value={status} onChange={(v) => updateFilter(setStatus, v)}>
            <option value="">All statuses</option>
            {['CREATED', 'ASSIGNED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED'].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </Filter>
          <Filter value={city} onChange={(v) => updateFilter(setCity, v)}>
            <option value="">All Hader cities</option>
            {filterOptions.cities.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Filter>
          <label className="relative">
            <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={requestedDate}
              onChange={(event) => updateFilter(setRequestedDate, event.target.value)}
              aria-label="Requested date"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#54247a]"
            />
          </label>
          <Filter value={product} onChange={(v) => updateFilter(setProduct, v)}>
            <option value="">All products</option>
            {filterOptions.products.map((option) => (
              <option key={option.id} value={option.id}>
                {option.code} — {option.name}
              </option>
            ))}
          </Filter>
        </div>
        {error ? (
          <State message={error} action={() => void load()} />
        ) : loading ? (
          <Skeleton />
        ) : items.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1450px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      'Shipment Number',
                      'Order Number',
                      'Customer',
                      'Product',
                      'Quantity TON',
                      'Hader City',
                      'Ship-to',
                      'Scheduled Date',
                      'Transporter',
                      'Truck',
                      'Driver',
                      'Status',
                      'Action',
                    ].map((heading) => (
                      <th key={heading} className="px-3 py-3 font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-semibold text-[#54247a]">
                        <Link to={`/hader/dispatch/${shipment.id}`}>{shipment.shipmentNumber}</Link>
                      </td>
                      <td className="px-3 py-3">{shipment.deliveryRequest.order.number}</td>
                      <td className="px-3 py-3 font-medium">
                        {shipment.deliveryRequest.customer.companyName}
                      </td>
                      <td className="px-3 py-3">{shipment.deliveryRequest.product.name}</td>
                      <td className="px-3 py-3 font-semibold">{shipment.quantityTon.toFixed(3)}</td>
                      <td className="px-3 py-3">{shipment.deliveryRequest.haderCity.name}</td>
                      <td className="max-w-44 truncate px-3 py-3">
                        {text(shipment.deliveryRequest.shipTo, 'name') || 'Not provided'}
                      </td>
                      <td className="px-3 py-3">{date(shipment.scheduledDate)}</td>
                      <td className="px-3 py-3">
                        {shipment.assignment?.transporter.name ?? 'Unassigned'}
                      </td>
                      <td className="px-3 py-3">
                        {shipment.assignment?.truck?.plateNumber ?? 'Unassigned'}
                      </td>
                      <td className="px-3 py-3">
                        {shipment.assignment?.driver?.name ?? 'Unassigned'}
                      </td>
                      <td className="px-3 py-3">
                        <Status value={shipment.status} />
                      </td>
                      <td className="px-3 py-3">
                        {shipment.status === 'CREATED' ? (
                          <button
                            onClick={() => setAssigning(shipment)}
                            className="rounded-lg bg-[#54247a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#472066]"
                          >
                            Assign
                          </button>
                        ) : (
                          <Link
                            to={`/hader/dispatch/${shipment.id}`}
                            className="text-xs font-semibold text-[#54247a]"
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 lg:hidden">
              {items.map((shipment) => (
                <article key={shipment.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to={`/hader/dispatch/${shipment.id}`}
                      className="font-bold text-[#54247a]"
                    >
                      {shipment.shipmentNumber}
                    </Link>
                    <Status value={shipment.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold">
                    {shipment.deliveryRequest.customer.companyName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {shipment.deliveryRequest.product.name} · {shipment.quantityTon.toFixed(3)} TON
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {shipment.deliveryRequest.haderCity.name ?? 'City not configured'}
                  </p>
                  {shipment.status === 'CREATED' && (
                    <button
                      onClick={() => setAssigning(shipment)}
                      className="mt-3 w-full rounded-lg bg-[#54247a] px-3 py-2 text-sm font-semibold text-white"
                    >
                      Assign
                    </button>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <State message="No shipments match the selected dispatch filters." />
        )}
        <Pager pagination={pagination} onPage={setPage} />
      </section>
      {assigning && (
        <AssignmentModal
          shipment={assigning}
          onClose={() => setAssigning(null)}
          onAssigned={() => {
            setAssigning(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Filter({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <NativeTomSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#54247a]"
    >
      {children}
    </NativeTomSelect>
  );
}

function AssignmentModal({
  shipment,
  onClose,
  onAssigned,
}: {
  shipment: Shipment;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [transporters, setTransporters] = useState<DispatchResource[]>([]);
  const [trucks, setTrucks] = useState<DispatchResource[]>([]);
  const [drivers, setDrivers] = useState<DispatchResource[]>([]);
  const [transporterId, setTransporterId] = useState('');
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    getDispatchResources()
      .then((resources) => {
        setTransporters(resources.transporters);
        setTrucks(resources.trucks);
        setDrivers(resources.drivers);
      })
      .catch(() => setError('Unable to load active dispatch resources.'))
      .finally(() => setLoading(false));
  }, []);
  const submit = async () => {
    if (!transporterId || !truckId || !driverId) {
      setError('Transporter, truck and driver are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await assignShipment(shipment.id, { transporterId, truckId, driverId });
      onAssigned();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to assign shipment.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <ClipboardCheck size={18} className="text-[#54247a]" /> Assign Shipment
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {shipment.shipmentNumber} · {shipment.quantityTon.toFixed(3)} TON
            </p>
          </div>
          <button onClick={onClose} aria-label="Close assignment">
            <X size={18} />
          </button>
        </header>
        <div className="space-y-4 p-5">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {loading ? (
            <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <>
              <ResourceSelect
                label="Transporter"
                value={transporterId}
                onChange={setTransporterId}
                options={transporters.map((item) => ({
                  id: item.id,
                  label: item.companyName || item.name || 'Transporter',
                }))}
              />
              <ResourceSelect
                label="Truck"
                value={truckId}
                onChange={setTruckId}
                options={trucks.map((item) => ({
                  id: item.id,
                  label: `${item.plateNumber} · ${item.vehicleType} · ${item.capacityTon} TON`,
                }))}
              />
              <ResourceSelect
                label="Driver"
                value={driverId}
                onChange={setDriverId}
                options={drivers.map((item) => ({
                  id: item.id,
                  label: `${item.name} · ${item.mobile} · ${item.licenseNumber}`,
                }))}
              />
            </>
          )}
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={loading || saving}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#54247a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Truck size={16} /> {saving ? 'Assigning...' : 'Assign Shipment'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ResourceSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="block text-sm font-semibold">
      {label} <span className="text-red-600">*</span>
      <NativeTomSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeTomSelect>
    </label>
  );
}
