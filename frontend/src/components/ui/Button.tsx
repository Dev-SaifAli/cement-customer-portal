import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}
export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button className={`ui-button ui-button--${variant}`} disabled={disabled || loading} {...props}>
      {loading ? 'Loading…' : children}
    </button>
  );
}
