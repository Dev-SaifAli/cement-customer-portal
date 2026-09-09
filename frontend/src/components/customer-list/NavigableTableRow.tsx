import type { ComponentProps, KeyboardEvent, MouseEvent } from 'react';
import { TableRow } from '../ui/shadcn';

export function NavigableTableRow({
  label,
  onNavigate,
  className = '',
  ...props
}: Omit<ComponentProps<typeof TableRow>, 'onClick' | 'onKeyDown'> & {
  label: string;
  onNavigate: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (isInteractiveTarget(event.target)) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onNavigate();
  };

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (isInteractiveTarget(event.target)) return;
    onNavigate();
  };

  return (
    <TableRow
      {...props}
      tabIndex={0}
      role="link"
      aria-label={label}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--customer-primary)] ${className}`}
    />
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest('a,button,input,select,textarea,[role="button"],[data-row-navigation-ignore]'),
    )
  );
}
