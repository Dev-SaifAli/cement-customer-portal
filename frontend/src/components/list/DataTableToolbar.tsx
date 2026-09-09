import type { ReactNode } from 'react';

export function DataTableToolbar({ search, actions }: { search: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--customer-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      {search}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
