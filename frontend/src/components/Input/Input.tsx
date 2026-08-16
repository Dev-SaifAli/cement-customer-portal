import type { InputHTMLAttributes, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label?: string;
  required?: boolean;
  icon?: ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
  rightSlot?: ReactNode;
}

export default function Input({
  id,
  label,
  required = false,
  icon,
  error = '',
  hint = '',
  rightSlot,
  className = '',
  ...rest
}: InputProps) {
  return (
    <div className="field">
      {label && (
        <label htmlFor={id}>
          {label} {required && <span className="req">*</span>}
        </label>
      )}
      <div className="input-wrap">
        {icon && <span className="icon-left">{icon}</span>}
        <input
          id={id}
          className={[
            icon ? 'has-icon' : '',
            rightSlot ? 'has-icon-right' : '',
            error ? 'err' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-message` : undefined}
          {...rest}
        />
        {rightSlot}
      </div>
      {error && (
        <div id={`${id}-message`} className="form-msg error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      {!error && hint && (
        <div id={`${id}-message`} className="form-msg hint">
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}
