import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CommercialTonInput } from '../../components/ui/CommercialTonInput';
import {
  createOrderPalletState,
  OrderPalletFields,
  type OrderPalletState,
  validateOrderPallet,
} from '../../components/orders/OrderPalletFields';
import { DetailBreadcrumb } from '../../components/customer-detail/DetailBreadcrumb';
import {
  DocumentHeader,
  DocumentStateBadge,
} from '../../components/customer-detail/DocumentHeader';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../../components/ui/shadcn';
import { createOperationalContractOrder, getOperationalContract, type OperationalContract } from '../../services/operationalContractsService';
import { formatCommercialTons, isWholeTonQuantity, wholeTonQuantityMessage } from '../../utils/commercialQuantity';
import { useSalesAuth } from '../../context/SalesAuthContext';
import { getOperationalPortalPresentation } from '../../utils/operationalPortal';
import { getSalesLandingPath } from '../../utils/salesRouting';

export function HaderContractDetails() {
  const { id } = useParams();
  const { user } = useSalesAuth();
  const { basePath, contractsLabel } = getOperationalPortalPresentation(user?.role);
  const [contract, setContract] = useState<OperationalContract | null>(null);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState('');
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [pallet, setPallet] = useState<OrderPalletState>({ palletRequired: false, palletType: '', palletQuantity: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ id: string; orderNumber: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const load = () => id && getOperationalContract(id).then((data) => {
    setContract(data);
    setPallet(createOrderPalletState(data));
  }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load contract.'));
  useEffect(() => { void load(); }, [id]);
  if (!contract) return <p className="text-sm text-[var(--customer-text-muted)]">{error || 'Loading contract...'}</p>;
  const submit = async () => {
    const tons = Number(quantity);
    if (!isWholeTonQuantity(tons)) return setError(wholeTonQuantityMessage);
    if (tons > contract.remainingQuantityTons) return setError('Requested quantity exceeds the remaining contract quantity.');
    if (contract.fulfilment === 'DELIVERY' && !date) return setError('Preferred delivery date is required.');
    if (contract.fulfilment === 'PICKUP' && (!truckId || !driverId)) return setError('Truck and driver are required for pickup orders.');
    const palletError = validateOrderPallet(pallet);
    if (palletError) return setError(palletError);
    setSaving(true); setError(''); setSuccess(null);
    try {
      const order = await createOperationalContractOrder(contract.id, { clientRequestId: crypto.randomUUID(), requestedQuantityTons: tons, preferredDeliveryDate: date || null, truckId: truckId || null, driverId: driverId || null, palletRequired: pallet.palletRequired, palletType: pallet.palletRequired ? pallet.palletType : null, palletQuantity: pallet.palletRequired ? Number(pallet.palletQuantity) : null });
      setSuccess(order); setQuantity(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create order.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-5">
    <DetailBreadcrumb homePath={user ? getSalesLandingPath(user.role) : basePath} listLabel={contractsLabel} listPath={`${basePath}/contracts`} current={contract.reference ?? 'Contract'} />
    <DocumentHeader number={contract.reference ?? 'Contract'} status={<DocumentStateBadge persisted status={contract.status} />} description={`${contract.customer.name} - ${contract.product.name}`} />
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Contract total" value={formatCommercialTons(contract.totalQuantityTons)} /><Metric label="Remaining quantity" value={formatCommercialTons(contract.remainingQuantityTons)} /><Metric label="Fulfilment" value={contract.fulfilment} /></div>
    <Card><CardHeader><CardTitle>Create Order</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="order-quantity">Requested Order Quantity</Label><CommercialTonInput id="order-quantity" value={quantity} onValueChange={setQuantity} onInvalidValue={setError} className="mt-2 h-10 w-full rounded-md border border-[var(--customer-border)] bg-[var(--customer-surface)] px-3" /></div>{contract.fulfilment === 'DELIVERY' ? <div><Label htmlFor="delivery-date">Preferred Delivery Date</Label><Input id="delivery-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2" /></div> : <div className="grid gap-4 sm:grid-cols-2"><SelectField id="pickup-truck" label="Customer Truck" value={truckId} onChange={setTruckId} options={(contract.pickupFleet?.trucks ?? []).map((item) => ({ value: item.id, label: `${item.plateNumber} - ${formatCommercialTons(item.capacityTon)}` }))} /><SelectField id="pickup-driver" label="Customer Driver" value={driverId} onChange={setDriverId} options={(contract.pickupFleet?.drivers ?? []).map((item) => ({ value: item.id, label: item.name }))} /></div>}<OrderPalletFields contractPalletRequired={contract.palletRequired} value={pallet} onChange={(value) => { setPallet(value); setError(''); }} />{error && <p className="text-sm font-semibold text-[var(--customer-danger)]">{error}</p>}{success && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300"><Link to={`${basePath}/orders/${success.id}`} className="underline underline-offset-4">{success.orderNumber}</Link> created successfully.</p>}<Button type="button" onClick={() => void submit()} disabled={saving || contract.remainingQuantityTons <= 0}>{saving ? 'Creating...' : 'Create Order'}</Button></CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <Card><CardContent className="p-4"><p className="text-sm text-[var(--customer-text-muted)]">{label}</p><p className="mt-1 font-semibold text-[var(--customer-text)]">{value}</p></CardContent></Card>; }
function SelectField({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <div><Label htmlFor={id}>{label}</Label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-[var(--customer-border)] bg-[var(--customer-surface)] px-3 text-sm text-[var(--customer-text)]"><option value="">Select</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>; }
