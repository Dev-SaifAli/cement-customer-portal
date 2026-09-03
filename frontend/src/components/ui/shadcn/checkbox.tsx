import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded border border-[var(--customer-border,#e5e2ed)] bg-[var(--customer-input,#ffffff)] ring-offset-[var(--customer-bg,#f6f5fa)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--customer-primary,#54247a)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--customer-primary,#54247a)] data-[state=checked]:bg-[var(--customer-primary,#54247a)] data-[state=checked]:text-white data-[state=indeterminate]:border-[var(--customer-primary,#54247a)] data-[state=indeterminate]:bg-[var(--customer-primary,#54247a)] data-[state=indeterminate]:text-white',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      {props.checked === 'indeterminate' ? (
        <span className="h-0.5 w-2 rounded-full bg-current" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
