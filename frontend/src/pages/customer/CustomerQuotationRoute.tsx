import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCustomerQuotation,
  type CustomerQuotation,
} from '../../services/customerQuotationsService';
import { CustomerQuotationDetails } from './CustomerQuotationDetails';
import { CustomerQuotationNew } from './CustomerQuotationNew';

export function CustomerQuotationRoute() {
  const { id } = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<CustomerQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    void getCustomerQuotation(id)
      .then(setQuotation)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <QuotationRouteSkeleton />;
  if (error || !quotation) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        Unable to load this quotation. Please return to Quotations and try again.
      </section>
    );
  }

  if (quotation.status === 'DRAFT') return <CustomerQuotationNew />;
  return <CustomerQuotationDetails initialQuotation={quotation} />;
}

function QuotationRouteSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-label="Loading quotation">
      <div className="h-8 w-72 rounded bg-slate-200" />
      <div className="h-24 rounded-xl bg-slate-100" />
      <div className="h-64 rounded-xl bg-slate-100" />
    </div>
  );
}
