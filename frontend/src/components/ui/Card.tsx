import type { ReactNode } from 'react';
export function Card({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-card">
      {title && (
        <header className="ui-card__header">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      <div className="ui-card__body">{children}</div>
    </section>
  );
}
