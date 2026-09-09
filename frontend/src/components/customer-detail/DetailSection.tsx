import type { ReactNode } from 'react';

export function DetailSection({
  title,
  icon,
  children,
  contentClassName = 'grid gap-x-6 gap-y-4 sm:grid-cols-2',
  className = '',
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  className?: string;
}) {
  return (
    <section
      className={`border border-[var(--customer-border)] bg-[var(--customer-surface)] p-5 ${className}`}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--customer-primary)]">
        {icon}
        {title}
      </h2>
      <dl className={`mt-4 ${contentClassName}`}>{children}</dl>
    </section>
  );
}
