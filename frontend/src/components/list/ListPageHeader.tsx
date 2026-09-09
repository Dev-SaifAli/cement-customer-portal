import { ChevronRight, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/shadcn';

export function ListPageHeader({
  rootLabel,
  rootTo,
  title,
  createAction,
  action,
}: {
  rootLabel: string;
  rootTo: string;
  title: string;
  createAction?: { label: string; to: string };
  action?: ReactNode;
}) {
  return (
    <header className="flex min-h-10 flex-wrap items-center justify-between gap-3">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm font-medium">
          <li>
            <Link
              to={rootTo}
              className="text-[var(--customer-text-muted)] transition hover:text-[var(--customer-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary)]"
            >
              {rootLabel}
            </Link>
          </li>
          <li aria-hidden="true" className="text-[var(--customer-text-muted)]">
            <ChevronRight size={15} />
          </li>
          <li aria-current="page" className="font-semibold text-[var(--customer-text)]">
            {title}
          </li>
        </ol>
      </nav>

      {action ??
        (createAction && (
          <Button asChild>
            <Link to={createAction.to}>
              <Plus size={16} />
              {createAction.label}
            </Link>
          </Button>
        ))}
    </header>
  );
}
