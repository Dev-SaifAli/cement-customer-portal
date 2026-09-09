import { Button, TableCell, TableRow } from '../ui/shadcn';

export function TableLoadingRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          {Array.from({ length: columns }, (__, cellIndex) => (
            <TableCell key={cellIndex}>
              <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--customer-surface-secondary)]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function TableMessageRow({
  colSpan,
  message,
  actionLabel,
  onAction,
}: {
  colSpan: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-56 text-center">
        <p className="text-sm text-[var(--customer-text-muted)]">{message}</p>
        {actionLabel && onAction && (
          <Button type="button" variant="outline" className="mt-3" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
