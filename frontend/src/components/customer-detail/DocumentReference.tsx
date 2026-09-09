import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyDetailValue } from './DetailField';

export function DocumentReference({
  reference,
  entityId,
  routeBase,
  ariaLabel,
  nowrap = false,
}: {
  reference: string | null | undefined;
  entityId: string | null | undefined;
  routeBase: string;
  ariaLabel?: string;
  nowrap?: boolean;
}) {
  if (!reference?.trim() || !entityId) return <EmptyDetailValue />;

  return (
    <Link
      to={`${routeBase}/${encodeURIComponent(entityId)}`}
      aria-label={ariaLabel ?? `Open ${reference}`}
      className={`inline-flex max-w-full items-center gap-1 text-[var(--customer-primary)] underline-offset-4 transition hover:text-[var(--customer-primary-hover)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)] ${nowrap ? 'whitespace-nowrap' : 'break-all'}`}
    >
      {reference}
      <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
    </Link>
  );
}
