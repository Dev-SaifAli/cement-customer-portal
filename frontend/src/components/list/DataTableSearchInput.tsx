import { Search, X } from 'lucide-react';
import { Button, Input } from '../ui/shadcn';

export function DataTableSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative w-full sm:max-w-md">
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--customer-text-muted)]"
      />
      <Input
        type="text"
        role="searchbox"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-10 pl-9 pr-10"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-0.5 top-1/2 h-9 w-9 -translate-y-1/2"
        >
          <X size={15} />
        </Button>
      )}
    </div>
  );
}
