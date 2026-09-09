import { Badge } from '../ui/shadcn';

export type StatusTone =
  'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline';

export function StatusBadge({ label, tone = 'secondary' }: { label: string; tone?: StatusTone }) {
  return (
    <Badge variant={tone} className="max-w-full whitespace-nowrap text-xs">
      {label}
    </Badge>
  );
}
