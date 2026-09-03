import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CrmHandoffBadge, TicketStatusBadge } from '../customer-tickets/TicketStatusBadge';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/shadcn';
import type { CustomerTicket } from '../../services/customerTicketsService';

interface SalesTicketTableProps {
  tickets: CustomerTicket[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onSendToCrm: (ticket: CustomerTicket) => Promise<void>;
}

export function SalesTicketTable({
  tickets,
  pagination,
  onPageChange,
  onSendToCrm,
}: SalesTicketTableProps) {
  const navigate = useNavigate();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [ticketToSend, setTicketToSend] = useState<CustomerTicket | null>(null);
  const [sending, setSending] = useState(false);

  const columns = useMemo<Array<ColumnDef<CustomerTicket>>>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all visible service requests"
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select service request ${row.original.ticketNumber}`}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
          />
        ),
        enableHiding: false,
        enableSorting: false,
      },
      {
        accessorKey: 'ticketNumber',
        header: 'Ticket Number',
        cell: ({ row }) => (
          <Link
            to={`/sales/tickets/${row.original.id}`}
            className="text-base font-semibold text-[var(--customer-primary,#54247a)] transition hover:text-[var(--customer-primary-hover,#472066)] hover:underline"
          >
            {row.original.ticketNumber}
          </Link>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-base font-medium text-[var(--customer-text,#1c1625)]">
            {row.original.customer.companyName ?? 'Customer'}
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[360px] text-base text-[var(--customer-text,#1c1625)]">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'crmHandoffStatus',
        header: 'CRM Handoff',
        cell: ({ row }) => <CrmHandoffBadge status={row.original.crmHandoffStatus} />,
      },
      {
        id: 'createdBy',
        header: 'Created By',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-base text-[var(--customer-text,#1c1625)]">
            {row.original.createdBy.name ?? row.original.createdBy.email ?? 'Customer User'}
          </span>
        ),
      },
      {
        id: 'lastActivity',
        header: () => <span className="sr-only">Last activity</span>,
        cell: ({ row }) => {
          const latest = getLatestTimestamp(row.original.createdAt, row.original.updatedAt);
          return (
            <time
              dateTime={latest.toISOString()}
              title={latest.toLocaleString()}
              className="whitespace-nowrap text-base text-[var(--customer-text-muted,#746d7f)]"
            >
              {formatRelativeTime(latest)}
            </time>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Open actions for service request ${row.original.ticketNumber}`}
              >
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => navigate(`/sales/tickets/${row.original.id}`)}
              >
                View
              </DropdownMenuItem>
              {row.original.status === 'SUBMITTED' && (
                <DropdownMenuItem onSelect={() => setTicketToSend(row.original)}>
                  Send to CRM
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [navigate],
  );

  const tablePagination: PaginationState = {
    pageIndex: Math.max(0, pagination.page - 1),
    pageSize: pagination.pageSize,
  };

  const table = useReactTable({
    data: tickets,
    columns,
    pageCount: pagination.totalPages,
    state: {
      pagination: tablePagination,
      rowSelection,
    },
    manualPagination: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const pageNumbers = getVisiblePages(pagination.page, pagination.totalPages);
  const showingFrom =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const showingTo = Math.min(pagination.page * pagination.pageSize, pagination.total);

  const confirmSend = async () => {
    if (!ticketToSend) return;
    setSending(true);
    try {
      await onSendToCrm(ticketToSend);
      setTicketToSend(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-[var(--customer-border,#e5e2ed)] bg-[var(--customer-surface,#ffffff)] text-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-sm">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-base">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-[var(--customer-text-muted,#746d7f)]"
                >
                  No service requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedCount > 0 && (
        <div className="rounded-lg border border-[var(--customer-border,#e5e2ed)] bg-[var(--customer-surface,#ffffff)] px-4 py-2 text-xs text-[var(--customer-text-muted,#746d7f)]">
          {selectedCount} {selectedCount === 1 ? 'ticket' : 'tickets'} selected
        </div>
      )}

      <footer className="flex flex-col gap-3 rounded-lg border border-[var(--customer-border,#e5e2ed)] bg-[var(--customer-surface,#ffffff)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--customer-text-muted,#746d7f)]">
          Showing {showingFrom}–{showingTo} of {pagination.total}
        </p>
        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!table.getCanPreviousPage()}
                onClick={() => onPageChange(pagination.page - 1)}
              />
            </PaginationItem>
            {pageNumbers.map((pageNumber) => (
              <PaginationItem key={pageNumber}>
                <PaginationButton
                  type="button"
                  isActive={pageNumber === pagination.page}
                  onClick={() => onPageChange(pageNumber)}
                >
                  {pageNumber}
                </PaginationButton>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                disabled={!table.getCanNextPage()}
                onClick={() => onPageChange(pagination.page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </footer>

      <Dialog
        open={Boolean(ticketToSend)}
        onOpenChange={(open) => {
          if (!open && !sending) setTicketToSend(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Send Ticket to CRM?</DialogTitle>
            <DialogDescription>
              This will send the customer request to the CRM processing team.
            </DialogDescription>
          </DialogHeader>
          {ticketToSend && (
            <p className="rounded-lg border border-[var(--customer-border,#e5e2ed)] bg-[var(--customer-bg,#f6f5fa)] px-3 py-2 text-sm font-semibold text-[var(--customer-text,#1c1625)]">
              {ticketToSend.ticketNumber}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              disabled={sending}
              onClick={() => setTicketToSend(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#472066] text-white hover:bg-[#54247a]"
              disabled={sending}
              onClick={() => void confirmSend()}
            >
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getLatestTimestamp(createdAt: string, updatedAt: string) {
  const created = parseTimestamp(createdAt);
  const updated = parseTimestamp(updatedAt);
  return updated.getTime() >= created.getTime() ? updated : created;
}

function parseTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function formatRelativeTime(date: Date) {
  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  const absoluteSeconds = Math.abs(diffSeconds);
  if (absoluteSeconds < 45) return 'just now';
  if (absoluteSeconds < 60 * 60) return `${Math.max(1, Math.round(diffSeconds / 60))} min ago`;
  if (absoluteSeconds < 60 * 60 * 24) {
    const hours = Math.max(1, Math.round(diffSeconds / 3600));
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (absoluteSeconds < 60 * 60 * 48) return 'Yesterday';
  if (absoluteSeconds < 60 * 60 * 24 * 7) return `${Math.round(diffSeconds / 86400)} days ago`;
  if (absoluteSeconds < 60 * 60 * 24 * 30) {
    const weeks = Math.max(1, Math.round(diffSeconds / 604800));
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  if (absoluteSeconds < 60 * 60 * 24 * 365) {
    const months = Math.max(1, Math.round(diffSeconds / 2592000));
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  const years = Math.max(1, Math.round(diffSeconds / 31536000));
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

function getVisiblePages(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}
