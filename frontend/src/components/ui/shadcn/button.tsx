import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--customer-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--customer-bg)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--customer-primary)] text-white shadow-sm hover:bg-[var(--customer-primary-hover)]',
        destructive:
          'bg-[var(--customer-danger)] text-white shadow-sm hover:opacity-90',
        outline:
          'border border-[var(--customer-border)] bg-[var(--customer-surface)] text-[var(--customer-text)] shadow-sm hover:bg-[var(--customer-surface-secondary)] hover:text-[var(--customer-primary)]',
        secondary:
          'bg-[var(--customer-surface-secondary)] text-[var(--customer-text)] shadow-sm hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)]',
        ghost: 'text-[var(--customer-text-secondary)] hover:bg-[var(--customer-surface-secondary)] hover:text-[var(--customer-primary)]',
        link: 'text-[var(--customer-primary)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
