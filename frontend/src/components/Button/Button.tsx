import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  loading = false,
  loadingText,
  icon,
  iconPosition = 'right',
  disabled = false,
  className = '',
  ...rest
}: ButtonProps) {
  const classByVariant = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost' };
  return (
    <button
      type={type}
      className={`${classByVariant[variant]} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <>
          <span className="spinner" aria-hidden="true" />
          <span>{loadingText ?? 'Loading…'}</span>
        </>
      ) : (
        <>
          {iconPosition === 'left' && icon}
          <span>{children}</span>
          {iconPosition === 'right' && icon}
        </>
      )}
    </button>
  );
}
