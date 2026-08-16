import type { ReactNode } from 'react';
export function Alert({
  children,
  variant = 'info',
  title,
}: {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
}) {
  return (
    <div
      className={`ui-alert ui-alert--${variant}`}
      role={variant === 'danger' ? 'alert' : 'status'}
    >
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}
