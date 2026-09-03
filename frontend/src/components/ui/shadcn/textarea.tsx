import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'flex min-h-[140px] w-full rounded-md border border-[var(--customer-border)] bg-[var(--customer-input)] px-3 py-2 text-sm text-[var(--customer-text)] shadow-sm placeholder:text-[var(--customer-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--customer-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--customer-bg)] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
