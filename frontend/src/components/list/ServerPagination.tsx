import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../ui/shadcn';

export function ServerPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  itemLabel = 'records',
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <footer className="flex flex-col gap-3 border-t border-[var(--customer-border)] px-4 py-3 text-sm text-[var(--customer-text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span>
        Showing {from}-{to} of {total} {itemLabel}
      </span>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
          </PaginationItem>
          <PaginationItem>
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-[var(--customer-primary)] bg-[var(--customer-primary-soft)] px-3 font-semibold text-[var(--customer-primary)]">
              {page}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </footer>
  );
}
