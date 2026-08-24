import { ArrowLeft, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getCustomerContract,
  type CustomerContractDetails,
} from '../../services/customerContractsService';

export function CustomerContractDetailsPage() {
  const { id } = useParams();
  const [contract, setContract] = useState<CustomerContractDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getCustomerContract(id)
      .then((data) => {
        if (!cancelled) setContract(data);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load contract.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <div className="rounded-2xl border border-[#e3e1e8] bg-white p-8 text-sm text-[#64748b]">Loading contract...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm font-semibold text-[#b42318]">{error}</div>;
  }

  if (!contract) return null;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/customer/contracts" className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748b] hover:text-[#54247a]">
          <ArrowLeft size={16} /> Contracts
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#1a1b23]">{contract.reference}</h1>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active
          </span>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <InfoCard title="Contract Information">
          <Field label="Contract Number" value={contract.reference} />
          <Field label="Source Quotation" value={contract.sourceQuotation?.reference} />
          <Field label="Product" value={contract.productName} />
          <Field label="Packaging" value={contract.packaging} />
          <Field label="Fulfilment" value={contract.fulfilment} />
          <Field label="Hader City" value={contract.haderCity} />
          <Field label="Start Date" value={formatDate(contract.startDate)} />
          <Field label="End Date" value={formatDate(contract.endDate)} />
          <Field label="Remaining Quantity" value={`${formatNumber(contract.remainingQuantityTons)} TON`} />
          <Field label="Total Quantity" value={`${formatNumber(contract.totalQuantityTons)} TON`} />
        </InfoCard>
        <InfoCard title="Commercial Terms">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-[#f6f2fa] px-3 py-2 text-xs font-bold text-[#54247a]">
            <Lock size={14} /> Final customer terms
          </div>
          <Field label="Customer Rate / TON" value={formatMoney(contract.customerRate)} strong />
          <Field label="Payment Terms" value={contract.paymentTerms} />
          <Field label="Grand Total" value={formatMoney(contract.grandTotal)} strong />
          <Field label="Commercial Notes" value={contract.commercialNotes} />
        </InfoCard>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e3e1e8] bg-white shadow-sm">
        <div className="border-b border-[#eceaf0] px-5 py-4">
          <h2 className="text-sm font-bold text-[#54247a]">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Packaging</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3">Equivalent TON</th>
                <th className="px-4 py-3">Final Rate / TON</th>
                <th className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eceaf0]">
              {contract.items.map((item, index) => (
                <tr key={`${item.productCode}-${index}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1a1b23]">{item.productName}</p>
                    <p className="text-xs text-[#64748b]">{item.productCode}</p>
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

      <div className="rounded-2xl border border-dashed border-[#e3e1e8] bg-white p-5 text-sm text-[#64748b]">
        Order from Contract will be available in a later module.
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e3e1e8] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-[#54247a]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#64748b]">{label}</p>
      <p className={`mt-1 text-sm ${strong ? 'font-bold text-[#54247a]' : 'font-semibold text-[#1a1b23]'}`}>{value || 'Not provided'}</p>
    </div>
  );
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
