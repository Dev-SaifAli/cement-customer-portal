import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DetailBreadcrumb({
  listLabel,
  listPath,
  current,
  homePath = '/customer/dashboard',
}: {
  listLabel: string;
  listPath: string;
  current: string;
  homePath?: string;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
        <li>
          <Link
            to={homePath}
            aria-label="Home"
            className="inline-flex text-[var(--customer-text-muted)] transition hover:text-[var(--customer-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
          >
            <Home size={16} aria-hidden="true" />
          </Link>
        </li>
        <li aria-hidden="true" className="text-[var(--customer-text-muted)]">
          <ChevronRight size={15} />
        </li>
        <li>
          <Link
            to={listPath}
            className="text-[var(--customer-text-muted)] transition hover:text-[var(--customer-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
          >
            {listLabel}
          </Link>
        </li>
        <li aria-hidden="true" className="text-[var(--customer-text-muted)]">
          <ChevronRight size={15} />
        </li>
        <li
          aria-current="page"
          className="truncate font-semibold text-[var(--customer-text)]"
          title={current}
        >
          {current}
        </li>
      </ol>
    </nav>
  );
}
