import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--customer-primary)] text-white hover:bg-[var(--customer-primary-hover)]',
        secondary:
          'border-transparent bg-[var(--customer-surface-secondary)] text-[var(--customer-text)]',
        destructive:
          'border-transparent bg-[var(--customer-danger-soft)] text-[var(--customer-danger)]',
        outline: 'border-[var(--customer-border)] text-[var(--customer-text)]',
        success:
          'border-transparent bg-[var(--customer-success-soft)] text-[var(--customer-success)]',
        warning:
          'border-transparent bg-[var(--customer-warning-soft)] text-[var(--customer-warning)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
