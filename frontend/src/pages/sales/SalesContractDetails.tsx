import { ArrowLeft, CheckCircle2, Lock, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  activateSalesContract,
  getSalesContract,
  type SalesContractDetails,
} from '../../services/salesService';

export function SalesContractDetailsPage() {
  const { id } = useParams();
  const [contract, setContract] = useState<SalesContractDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activating, setActivating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError('');
    getSalesContract(id)
      .then(setContract)
      .catch(() => setError('Unable to load contract.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleActivate = async () => {
    if (!contract) return;
    setActivating(true);
    setError('');
    try {
      setContract(await activateSalesContract(contract.id));
      setConfirmOpen(false);
    } catch {
      setError('Unable to activate contract.');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading contract...</div>;
  }

  if (error && !contract) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
        {error}
        <button onClick={load} className="ml-3 font-bold underline">Retry</button>
      </div>
    );
  }

  if (!contract) return null;

  const items = contract.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Link to="/sales/contracts" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#54247a]">
            <ArrowLeft size={16} /> Contracts
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-950">{contract.reference ?? 'Draft Contract'}</h1>
            <StatusBadge status={contract.status} />
          </div>
        </div>
        {contract.status === 'DRAFT' && (
          <button
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#54247a] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#472066]"
          >
            <CheckCircle2 size={16} /> Activate Contract
          </button>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <InfoCard title="Contract Overview">
          <Field label="Contract Number" value={contract.reference} />
          <Field label="Source Quotation" value={contract.sourceQuotation?.reference} />
          <Field label="Customer" value={contract.customerCompanyName} />
          <Field label="Fulfilment" value={contract.fulfilment} />
          <Field label="Hader City" value={contract.deliveryCity} />
          <Field label="Start Date" value={formatDate(contract.startDate)} />
          <Field label="End Date" value={formatDate(contract.endDate)} />
          <Field label="Remaining / Total TON" value={`${formatNumber(contract.remainingQuantityTons)} / ${formatNumber(contract.totalQuantityTons)}`} />
        </InfoCard>
        <InfoCard title="Commercial Summary (Locked)">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-[#f6f2fa] px-3 py-2 text-xs font-bold text-[#54247a]">
            <Lock size={14} /> Inherited from accepted quotation
          </div>
          <Field label="Product Price / TON" value={formatMoney(contract.productPrice)} />
          <Field label="Hader Delivery / TON" value={formatMoney(contract.deliveryPrice)} />
          <Field label="Customer Rate / TON" value={formatMoney(contract.customerRate)} />
          <Field label="VAT" value={formatMoney(contract.vatAmount)} />
          <Field label="Grand Total" value={formatMoney(contract.grandTotal)} strong />
        </InfoCard>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-[#54247a]">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Packaging</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3">Equivalent TON</th>
                <th className="px-4 py-3">Customer Rate / TON</th>
                <th className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={`${item.productCode}-${index}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{item.productName ?? 'Not provided'}</p>
                    <p className="text-xs text-slate-500">{item.productCode}</p>
                  </td>
                  <td className="px-4 py-3">{item.packagingType}</td>
                  <td className="px-4 py-3">{formatNumber(item.quantity)}</td>
                  <td className="px-4 py-3">{item.uom}</td>
                  <td className="px-4 py-3">{formatNumber(item.equivalentTons)}</td>
                  <td className="px-4 py-3">{formatMoney(item.customerRate)}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <InfoCard title="History">
        <div className="space-y-3">
          {(contract.statusHistory ?? []).map((event) => (
            <div key={event.id} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 rounded-full bg-[#54247a]" />
              <div>
                <p className="font-semibold text-slate-900">{event.action.replaceAll('_', ' ')}</p>
                <p className="text-xs text-slate-500">
                  {event.changedByName ?? 'Sales user'} · {formatDateTime(event.createdAt)}
                </p>
                {event.reason && <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{event.reason}</p>}
              </div>
            </div>
          ))}
          {(contract.statusHistory ?? []).length === 0 && <p className="text-sm text-slate-500">No history available.</p>}
        </div>
      </InfoCard>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#f6f2fa] p-2 text-[#54247a]">
                <RotateCcw size={20} />
              </span>
              <div>
                <h2 className="font-bold text-slate-950">Activate Contract</h2>
                <p className="mt-1 text-sm text-slate-500">Commercial terms remain locked from the accepted quotation.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold">Cancel</button>
              <button onClick={handleActivate} disabled={activating} className="rounded-lg bg-[#54247a] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {activating ? 'Activating...' : 'Yes, Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-[#54247a]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-sm ${strong ? 'font-bold text-[#54247a]' : 'font-semibold text-slate-900'}`}>{value ?? '—'}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{status.replaceAll('_', ' ')}</span>;
}

function formatMoney(value?: number | null) {
  return value == null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} SAR`;
}

function formatNumber(value?: number | null) {
  return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
