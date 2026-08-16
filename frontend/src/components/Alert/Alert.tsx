import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface AlertProps {
  variant?: 'error' | 'warn' | 'success';
  children: ReactNode;
}

export default function Alert({ variant = 'error', children }: AlertProps) {
  return (
    <div className={`alert ${variant} alert-fade`} role={variant === 'error' ? 'alert' : 'status'}>
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
