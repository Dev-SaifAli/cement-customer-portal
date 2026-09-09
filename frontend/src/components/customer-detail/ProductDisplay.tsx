export function ProductDisplay({
  name,
  code,
  compact = false,
}: {
  name: string | null | undefined;
  code: string | null | undefined;
  compact?: boolean;
}) {
  return (
    <span className="block min-w-0">
      <span
        className={`block font-semibold text-[var(--customer-text)] ${compact ? 'truncate whitespace-nowrap' : 'break-words'}`}
        title={compact ? (name ?? undefined) : undefined}
      >
        {name?.trim() || '—'}
      </span>
      {code?.trim() && (
        <span className={`mt-0.5 block text-xs font-medium text-[var(--customer-text-muted)] ${compact ? 'truncate whitespace-nowrap' : 'break-all'}`}>
          {code}
        </span>
      )}
    </span>
  );
}
