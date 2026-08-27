import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  FileText,
  Info,
  Lock,
  PackageCheck,
  Truck,
  Warehouse,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  getCustomerContract,
  type CustomerContractDetails,
} from '../../services/customerContractsService';
import { createCustomerOrder, type CustomerOrder } from '../../services/customerOrdersService';
import {
  getActiveCustomerDrivers,
  getActiveCustomerTrucks,
  type CustomerDriver,
  type CustomerTruck,
} from '../../services/customerFleetService';
import { createClientId } from '../../utils/createClientId';

const steps = [
  'Contract & Quantity',
  'Delivery / Pickup',
  'Review Order',
  'Confirm Order',
  'Order Submitted',
];

export function CustomerCreateOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const requestId = useRef(createClientId());
  const [contract, setContract] = useState<CustomerContractDetails | null>(null);
  const [step, setStep] = useState(1);
  const [quantity, setQuantity] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [trucks, setTrucks] = useState<CustomerTruck[]>([]);
  const [drivers, setDrivers] = useState<CustomerDriver[]>([]);
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getCustomerContract(id)
      .then((data) => {
        if (!cancelled) setContract(data);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load the active contract.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (contract?.fulfilment !== 'PICKUP') return;
    let cancelled = false;
    setFleetLoading(true);
    setFleetError('');
    Promise.all([getActiveCustomerTrucks(), getActiveCustomerDrivers()])
      .then(([activeTrucks, activeDrivers]) => {
        if (!cancelled) {
          setTrucks(activeTrucks);
          setDrivers(activeDrivers);
        }
      })
      .catch(() => {
        if (!cancelled) setFleetError('Unable to load your active trucks and drivers.');
      })
      .finally(() => {
        if (!cancelled) setFleetLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contract?.fulfilment]);

  const requestedTons = Number(quantity) || 0;
  const remaining = contract?.remainingQuantityTons ?? 0;
  const remainingAfter = Math.max(0, remaining - requestedTons);
  const rate = contract?.customerRate ?? 0;
  const subtotal = round(requestedTons * rate);
  const vat = round(subtotal * 0.15);
  const grandTotal = round(subtotal + vat);
  const item = contract?.items[0];
  const selectedTruck = trucks.find((truck) => truck.id === truckId);
  const selectedDriver = drivers.find((driver) => driver.id === driverId);
  const mayCreate = user?.role === 'CUSTOMER_ADMIN' || user?.role === 'PURCHASER';

  const quantityError = useMemo(() => {
    if (!quantity) return 'Enter the requested quantity.';
    if (!Number.isFinite(requestedTons) || requestedTons <= 0)
      return 'Quantity must be greater than 0.';
    if (requestedTons > remaining) return `Quantity cannot exceed ${formatNumber(remaining)} TON.`;
    return '';
  }, [quantity, remaining, requestedTons]);

  if (loading) return <LoadingCard />;
  if (error || !contract) return <ErrorCard message={error || 'Contract was not found.'} />;
  if (!mayCreate)
    return (
      <ErrorCard message="Customer Administrator or Purchaser access is required to create an order." />
    );

  const goNext = () => {
    setError('');
    if (step === 1 && quantityError) return setError(quantityError);
    if (step === 2 && contract.fulfilment === 'DELIVERY' && !preferredDate) {
      return setError('Preferred delivery date is required.');
    }
    if (step === 2 && contract.fulfilment === 'PICKUP') {
      if (fleetLoading) return setError('Please wait while your fleet is loading.');
      if (fleetError) return setError(fleetError);
      if (!truckId) return setError('Select a truck for this pickup order.');
      if (!driverId) return setError('Select a driver for this pickup order.');
      if (selectedTruck && requestedTons > selectedTruck.capacityTon) {
        return setError('Selected truck capacity is lower than order quantity.');
      }
    }
    setStep((current) => Math.min(4, current + 1));
  };

  const submit = async () => {
    if (!id || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const order = await createCustomerOrder(id, {
        clientRequestId: requestId.current,
        requestedQuantityTons: requestedTons,
        preferredDeliveryDate: contract.fulfilment === 'DELIVERY' ? preferredDate : null,
        deliveryNotes: notes.trim() || null,
        truckId: contract.fulfilment === 'PICKUP' ? truckId : null,
        driverId: contract.fulfilment === 'PICKUP' ? driverId : null,
      });
      setCreatedOrder(order);
      setStep(5);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 5 && createdOrder) {
    return (
      <div className="customer-card mx-auto max-w-2xl rounded-2xl border p-6 text-center sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check size={32} strokeWidth={2.5} />
        </span>
        <h1 className="customer-text mt-5 text-2xl font-bold">Order Created Successfully</h1>
        <p className="customer-secondary mt-2 text-sm">
          Your order request has been submitted for processing.
        </p>
        <div className="customer-surface-secondary customer-border mt-6 rounded-xl border p-4 text-left">
          <p className="customer-muted text-xs font-semibold uppercase tracking-wide">
            Order Number
          </p>
          <p className="customer-primary mt-1 text-xl font-bold">{createdOrder.orderNumber}</p>
          <p className="customer-secondary mt-3 text-sm">
            Status: <strong>Submitted</strong>
          </p>
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={`/customer/orders/${createdOrder.id}`}
            className="customer-primary-bg inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-bold text-white"
          >
            View Order
          </Link>
          <Link
            to="/customer/contracts"
            className="customer-border customer-surface customer-text inline-flex h-11 items-center justify-center rounded-lg border px-5 text-sm font-bold"
          >
            Back to Contracts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <nav className="customer-secondary flex flex-wrap items-center gap-2 text-xs font-semibold">
          <Link to="/customer/contracts" className="hover:text-[var(--customer-primary)]">
            Contracts
          </Link>
          <span>/</span>
          <Link
            to={`/customer/contracts/${contract.id}`}
            className="hover:text-[var(--customer-primary)]"
          >
            Contract Details
          </Link>
          <span>/</span>
          <span className="customer-primary">Create Order</span>
        </nav>
        <h1 className="customer-text mt-3 text-2xl font-bold">Create Order from Contract</h1>
        <p className="customer-secondary mt-1 text-sm">
          Place a new order against your active contract.
        </p>
      </div>

      <Progress current={step} />
      <ContractStrip contract={contract} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {step === 1 && (
            <Section
              icon={<PackageCheck size={18} />}
              title="1. Order Quantity (TON)"
              subtitle="Enter quantity you want to order"
            >
              <label className="customer-text text-sm font-semibold" htmlFor="requested-quantity">
                Requested Quantity (TON) <span className="text-red-600">*</span>
              </label>
              <div className="customer-border customer-input mt-2 flex overflow-hidden rounded-lg border focus-within:ring-2 focus-within:ring-[var(--customer-primary)]">
                <input
                  id="requested-quantity"
                  type="number"
                  min="0.001"
                  max={remaining}
                  step="0.001"
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    setError('');
                  }}
                  className="customer-input customer-text min-w-0 flex-1 px-3 py-3 outline-none"
                  placeholder="0.000"
                />
                <span className="customer-surface-secondary customer-border flex items-center border-l px-4 text-sm font-bold">
                  TON
                </span>
              </div>
              <p className="customer-muted mt-1.5 text-xs">
                Maximum allowed: {formatNumber(remaining)} TON
              </p>
              <div className="customer-surface-secondary mt-5 grid items-center gap-3 rounded-xl p-4 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <Metric
                  label="Remaining Contract Quantity"
                  value={`${formatNumber(remaining)} TON`}
                />
                <span className="customer-secondary text-xl">−</span>
                <Metric label="Requested Quantity" value={`${formatNumber(requestedTons)} TON`} />
                <span className="customer-secondary text-xl">=</span>
                <Metric
                  label="Remaining After Order"
                  value={`${formatNumber(remainingAfter)} TON`}
                  success
                />
              </div>
              <div className="customer-primary-soft customer-primary mt-4 flex gap-2 rounded-lg px-3 py-3 text-xs font-medium">
                <Info size={16} className="shrink-0" /> You can place orders up to the remaining
                contract quantity only.
              </div>
            </Section>
          )}

          {step === 2 && (
            <Section
              icon={<Truck size={18} />}
              title="2. Delivery / Pickup Selection"
              subtitle="Fulfilment is locked by your contract"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <LockedChoice
                  active={contract.fulfilment === 'DELIVERY'}
                  icon={<Truck size={19} />}
                  title="Hader Delivery"
                  description="Delivery to the contracted ship-to location"
                />
                <LockedChoice
                  active={contract.fulfilment === 'PICKUP'}
                  icon={<Warehouse size={19} />}
                  title="Pick-Up"
                  description="Pick up from the contracted location"
                />
              </div>
              {contract.fulfilment === 'DELIVERY' ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <ReadOnly label="Hader City" value={contract.haderCity} />
                  <ReadOnly label="Ship-to Address" value={formatShipTo(contract.shipTo)} />
                  <label className="customer-text text-sm font-semibold">
                    Preferred Delivery Date <span className="text-red-600">*</span>
                    <input
                      type="date"
                      min={today()}
                      value={preferredDate}
                      onChange={(event) => {
                        setPreferredDate(event.target.value);
                        setError('');
                      }}
                      className="customer-input customer-border customer-text mt-2 block h-11 w-full rounded-lg border px-3"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <label className="customer-text text-sm font-semibold">
                      Delivery Notes <span className="customer-muted font-normal">(Optional)</span>
                      <textarea
                        value={notes}
                        maxLength={1000}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        className="customer-input customer-border customer-text mt-2 block w-full rounded-lg border px-3 py-2.5"
                        placeholder="Enter delivery instructions or notes"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <ReadOnly
                    label="Pickup Location"
                    value={
                      contract.pickupLocation
                        ? [contract.pickupLocation.name, contract.pickupLocation.city]
                            .filter(Boolean)
                            .join(', ')
                        : null
                    }
                  />
                  <div className="customer-border rounded-xl border p-4">
                    <h3 className="customer-text text-sm font-bold">Pickup Vehicle Details</h3>
                    {fleetLoading ? (
                      <p className="customer-secondary mt-3 text-sm">Loading active fleet...</p>
                    ) : fleetError ? (
                      <p className="mt-3 text-sm font-semibold text-red-600">{fleetError}</p>
                    ) : (
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <label className="customer-text text-sm font-semibold">
                          Truck <span className="text-red-600">*</span>
                          <select
                            value={truckId}
                            onChange={(event) => {
                              setTruckId(event.target.value);
                              setError('');
                            }}
                            disabled={!trucks.length}
                            className="customer-input customer-border customer-text mt-2 block h-11 w-full rounded-lg border px-3 disabled:opacity-60"
                          >
                            <option value="">Select truck</option>
                            {trucks.map((truck) => (
                              <option key={truck.id} value={truck.id}>
                                {truck.plateNumber} — {truck.vehicleType} —{' '}
                                {formatNumber(truck.capacityTon)} TON
                              </option>
                            ))}
                          </select>
                          {!trucks.length && (
                            <span className="mt-2 block text-xs font-medium text-amber-700">
                              No active trucks available. Add a truck before creating pickup orders.{' '}
                              <Link to="/customer/fleet" className="customer-primary font-bold">
                                Manage fleet
                              </Link>
                            </span>
                          )}
                        </label>
                        <label className="customer-text text-sm font-semibold">
                          Driver <span className="text-red-600">*</span>
                          <select
                            value={driverId}
                            onChange={(event) => {
                              setDriverId(event.target.value);
                              setError('');
                            }}
                            disabled={!drivers.length}
                            className="customer-input customer-border customer-text mt-2 block h-11 w-full rounded-lg border px-3 disabled:opacity-60"
                          >
                            <option value="">Select driver</option>
                            {drivers.map((driver) => (
                              <option key={driver.id} value={driver.id}>
                                {driver.name} — {driver.mobile} — {driver.licenseNumber}
                              </option>
                            ))}
                          </select>
                          {!drivers.length && (
                            <span className="mt-2 block text-xs font-medium text-amber-700">
                              No active drivers available. Add a driver before creating pickup
                              orders.{' '}
                              <Link to="/customer/fleet" className="customer-primary font-bold">
                                Manage fleet
                              </Link>
                            </span>
                          )}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Section>
          )}

          {(step === 3 || step === 4) && (
            <Section
              icon={step === 3 ? <FileText size={18} /> : <CheckCircle2 size={18} />}
              title={step === 3 ? '3. Review Order' : '4. Confirm Order'}
              subtitle={
                step === 3
                  ? 'Verify the order details before confirmation'
                  : 'Confirm submission of this order request'
              }
            >
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <ReadOnly label="Contract Number" value={contract.reference} />
                <ReadOnly label="Product" value={contract.productName} />
                <ReadOnly label="Packaging" value={contract.packaging} />
                <ReadOnly label="Requested Quantity" value={`${formatNumber(requestedTons)} TON`} />
                <ReadOnly label="Fulfilment" value={formatFulfilment(contract.fulfilment)} />
                <ReadOnly
                  label={contract.fulfilment === 'DELIVERY' ? 'Ship-to' : 'Pickup From'}
                  value={
                    contract.fulfilment === 'DELIVERY'
                      ? formatShipTo(contract.shipTo)
                      : contract.pickupLocation?.name
                  }
                />
                {contract.fulfilment === 'DELIVERY' && (
                  <ReadOnly label="Preferred Delivery Date" value={formatDate(preferredDate)} />
                )}
                {contract.fulfilment === 'PICKUP' && (
                  <>
                    <ReadOnly
                      label="Pickup Truck"
                      value={
                        selectedTruck
                          ? `${selectedTruck.plateNumber} — ${selectedTruck.vehicleType} — ${formatNumber(selectedTruck.capacityTon)} TON`
                          : null
                      }
                    />
                    <ReadOnly
                      label="Pickup Driver"
                      value={
                        selectedDriver
                          ? `${selectedDriver.name} — ${selectedDriver.mobile} — ${selectedDriver.licenseNumber}`
                          : null
                      }
                    />
                  </>
                )}
                <ReadOnly label="Customer Rate / TON" value={formatMoney(rate)} />
              </div>
              {step === 4 && (
                <div className="customer-primary-soft customer-primary mt-5 flex gap-3 rounded-xl p-4 text-sm">
                  <Lock size={18} className="shrink-0" />
                  <span>
                    By submitting, you confirm the requested quantity and fulfilment details.
                    Pricing remains locked to the contract.
                  </span>
                </div>
              )}
            </Section>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {error}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                step === 1
                  ? navigate(`/customer/contracts/${contract.id}`)
                  : setStep((current) => current - 1)
              }
              className="customer-border customer-surface customer-text inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-bold"
            >
              <ArrowLeft size={16} /> {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={goNext}
                className="customer-primary-bg inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-bold text-white"
              >
                {step === 2 ? 'Review Order' : 'Next'} <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="customer-primary-bg inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Order Request'} <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>

        <OrderSummary
          contract={contract}
          itemName={item?.productName ?? contract.productName}
          quantity={requestedTons}
          subtotal={subtotal}
          vat={vat}
          grandTotal={grandTotal}
        />
      </div>
    </div>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-5 gap-1">
      {steps.map((label, index) => {
        const number = index + 1;
        const complete = number < current;
        const active = number === current;
        return (
          <li key={label} className="min-w-0 text-center">
            <div className="flex items-center">
              <span
                className={`h-px flex-1 ${index ? 'customer-border bg-[var(--customer-border)]' : ''}`}
              />
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${complete || active ? 'border-[var(--customer-primary)] bg-[var(--customer-primary)] text-white' : 'customer-border customer-surface customer-secondary'}`}
              >
                {complete ? <Check size={15} /> : number}
              </span>
              <span
                className={`h-px flex-1 ${index < steps.length - 1 ? 'bg-[var(--customer-border)]' : ''}`}
              />
            </div>
            <span
              className={`mt-2 hidden truncate text-[11px] font-semibold sm:block ${active ? 'customer-primary' : 'customer-secondary'}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ContractStrip({ contract }: { contract: CustomerContractDetails }) {
  const total = contract.totalQuantityTons;
  const used = Math.max(0, total - contract.remainingQuantityTons);
  return (
    <section className="customer-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2 xl:grid-cols-6">
      <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-1">
        <span className="customer-primary-soft customer-primary flex h-11 w-11 items-center justify-center rounded-xl">
          <Building2 size={21} />
        </span>
        <div>
          <p className="customer-muted text-xs">Contract Number</p>
          <p className="customer-text font-bold">{contract.reference}</p>
          <p className="mt-1 text-[10px] font-bold uppercase text-emerald-600">Active</p>
        </div>
      </div>
      <StripField label="Product" value={contract.productName} />
      <StripField label="Packaging" value={contract.packaging} />
      <StripField label="Total Quantity" value={`${formatNumber(total)} TON`} />
      <StripField label="Used Quantity" value={`${formatNumber(used)} TON`} />
      <div className="rounded-xl border border-[var(--customer-primary)]/30 bg-[var(--customer-primary-soft)] px-4 py-3">
        <p className="customer-primary text-xs">Remaining Quantity</p>
        <p className="customer-primary mt-1 text-lg font-bold">
          {formatNumber(contract.remainingQuantityTons)} TON
        </p>
      </div>
    </section>
  );
}

function OrderSummary({
  contract,
  itemName,
  quantity,
  subtotal,
  vat,
  grandTotal,
}: {
  contract: CustomerContractDetails;
  itemName: string | null;
  quantity: number;
  subtotal: number;
  vat: number;
  grandTotal: number;
}) {
  return (
    <aside className="customer-card rounded-2xl border p-5 xl:sticky xl:top-20">
      <h2 className="customer-text flex items-center gap-2 text-base font-bold">
        <FileText size={18} className="customer-primary" /> Order Summary
      </h2>
      <div className="mt-5 space-y-3">
        <SummaryRow label="Contract Number" value={contract.reference} />
        <SummaryRow label="Product" value={itemName} />
        <SummaryRow label="Packaging" value={contract.packaging} />
        <SummaryRow label="Contract Rate" value={`${formatMoney(contract.customerRate)} / TON`} />
      </div>
      <div className="customer-border-soft my-5 border-t" />
      <div className="space-y-3">
        <SummaryRow label="Requested Quantity" value={`${formatNumber(quantity)} TON`} />
        <SummaryRow label="Rate (SAR / TON)" value={formatMoney(contract.customerRate)} />
        <SummaryRow label="Subtotal" value={formatMoney(subtotal)} />
        <SummaryRow label="VAT (15%)" value={formatMoney(vat)} />
        <div className="customer-border-soft border-t pt-3">
          <SummaryRow label="Grand Total" value={formatMoney(grandTotal)} strong />
        </div>
      </div>
      <div className="customer-primary-soft customer-primary mt-6 flex gap-3 rounded-xl p-4 text-xs leading-5">
        <Lock size={17} className="shrink-0" />
        <span>
          <strong className="block">Pricing is locked as per the contract.</strong>You cannot change
          price, product, packaging or ship-to address.
        </span>
      </div>
    </aside>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="customer-card rounded-2xl border p-5">
      <div className="mb-5 flex gap-3">
        <span className="customer-primary-soft customer-primary flex h-9 w-9 items-center justify-center rounded-lg">
          {icon}
        </span>
        <div>
          <h2 className="customer-text text-base font-bold">{title}</h2>
          <p className="customer-muted mt-0.5 text-xs">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
function LockedChoice({
  active,
  icon,
  title,
  description,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${active ? 'border-[var(--customer-primary)] bg-[var(--customer-primary-soft)]' : 'customer-border customer-surface-secondary opacity-55'}`}
    >
      <div className="flex gap-3">
        <span className={active ? 'customer-primary' : 'customer-muted'}>{icon}</span>
        <div>
          <p className="customer-text text-sm font-bold">{title}</p>
          <p className="customer-secondary mt-1 text-xs">{description}</p>
          {active && (
            <p className="customer-primary mt-2 text-[10px] font-bold uppercase">
              Contract selection · Locked
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  success = false,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div>
      <p className="customer-muted text-[11px]">{label}</p>
      <p className={`mt-1 text-sm font-bold ${success ? 'text-emerald-600' : 'customer-text'}`}>
        {value}
      </p>
    </div>
  );
}
function StripField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="self-center">
      <p className="customer-muted text-xs">{label}</p>
      <p className="customer-text mt-1 text-sm font-bold">{value || 'Not provided'}</p>
    </div>
  );
}
function ReadOnly({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="customer-muted text-xs font-medium">{label}</p>
      <p className="customer-text mt-1 text-sm font-semibold">{value || 'Not provided'}</p>
    </div>
  );
}
function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string | null | undefined;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="customer-secondary">{label}</span>
      <span
        className={`text-right ${strong ? 'customer-primary text-lg font-bold' : 'customer-text font-semibold'}`}
      >
        {value || 'Not provided'}
      </span>
    </div>
  );
}
function LoadingCard() {
  return (
    <div className="customer-card rounded-2xl border p-8 text-sm customer-secondary">
      Loading contract...
    </div>
  );
}
function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
      {message}
    </div>
  );
}
function formatShipTo(value: CustomerContractDetails['shipTo']) {
  return value
    ? [value.name, value.city, value.region].filter(Boolean).join(', ') || 'Not provided'
    : 'Not provided';
}
function formatFulfilment(value: string) {
  return value === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up';
}
function formatNumber(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function formatMoney(value: number) {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}
function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(value: string) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not provided';
}
