import type { ReactNode } from 'react';

export function DetailField({
  label,
  value,
  secondary,
  strong = false,
  className = '',
}: {
  label: string;
  value: ReactNode;
  secondary?: ReactNode;
  strong?: boolean;
  className?: string;
}) {
  const empty = isEmptyDetailValue(value);

  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs font-medium text-[var(--customer-text-muted)]">{label}</dt>
      <dd
        className={`mt-1 break-words text-sm ${
          strong
            ? 'font-bold text-[var(--customer-primary)]'
            : 'font-semibold text-[var(--customer-text)]'
        }`}
      >
        {empty ? <EmptyDetailValue /> : value}
      </dd>
      {!empty && secondary !== undefined && secondary !== null && secondary !== '' && (
        <dd className="mt-0.5 break-all text-xs font-medium text-[var(--customer-text-muted)]">
          {secondary}
        </dd>
      )}
    </div>
  );
}

export function EmptyDetailValue() {
  return <span className="text-[var(--customer-text-muted)]">&mdash;</span>;
}

export function isEmptyDetailValue(value: ReactNode) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}
