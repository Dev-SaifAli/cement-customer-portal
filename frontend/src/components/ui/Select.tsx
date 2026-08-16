import { forwardRef, type SelectHTMLAttributes } from 'react';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ children, ...props }, ref) => (
    <select className="ui-control" ref={ref} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
