import type { ReactNode } from 'react';
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const message = error ?? hint;
  return (
    <div className="ui-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {message && <small className={error ? 'ui-field__error' : undefined}>{message}</small>}
    </div>
  );
}
