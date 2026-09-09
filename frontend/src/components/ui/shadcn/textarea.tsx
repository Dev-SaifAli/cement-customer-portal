import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'flex min-h-[140px] w-full rounded-md border border-[var(--customer-border,var(--color-border,#e5e2ed))] bg-[var(--customer-input,var(--color-surface,#ffffff))] px-3 py-2 text-sm text-[var(--customer-text,var(--color-text,#1c1625))] shadow-sm placeholder:text-[var(--customer-text-muted,var(--color-text-muted,#746d7f))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--customer-primary,var(--color-primary,#54247a))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--customer-bg,var(--color-background,#f6f5fa))] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
