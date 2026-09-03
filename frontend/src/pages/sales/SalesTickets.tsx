import { FileQuestion } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { TicketFilterBuilder } from '../../components/customer-tickets/TicketFilterBuilder';
import {
  getTicketFilterDefinition,
  salesTicketFilterDefinitions,
  ticketFilterConditionLabels,
  type TicketFilterRule,
} from '../../components/customer-tickets/ticketFilterConfig';
import { SalesTicketTable } from '../../components/sales-tickets/SalesTicketTable';
import { Badge, Button, Card, CardContent, Skeleton } from '../../components/ui/shadcn';
import { useToast } from '../../components/ui/ToastProvider';
import {
  listSalesTickets,
  sendSalesTicketToCrm,
  type CustomerTicket,
  type CustomerTicketListResult,
  type SalesTicketFilterRule,
} from '../../services/customerTicketsService';

const emptyResult: CustomerTicketListResult = {
  items: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
};

export function SalesTicketsPage() {
  const toast = useToast();
  const [result, setResult] = useState<CustomerTicketListResult>(emptyResult);
  const [appliedFilters, setAppliedFilters] = useState<TicketFilterRule[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await listSalesTickets({
        page,
        filters: toSalesApiFilters(appliedFilters),
      });
      setResult(data);
    } catch {
      setResult(emptyResult);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const sendToCrm = async (ticket: CustomerTicket) => {
    try {
      const updated = await sendSalesTicketToCrm(ticket.id);
      toast.success(`Service request ${updated.ticketNumber} sent to CRM.`);
      await loadTickets();
    } catch {
      setError(true);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--customer-primary)]">Sales Support</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--customer-text)]">
            Service Requests / Tickets
          </h1>
          <p className="mt-1 text-sm text-[var(--customer-text-muted)]">
            Review submitted customer service requests and hand them off to CRM.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[var(--customer-text)]">
          {result.pagination.total} {result.pagination.total === 1 ? 'Request' : 'Requests'}
        </p>
        <TicketFilterBuilder
          tickets={result.items}
          definitions={salesTicketFilterDefinitions}
          getValueOptions={getSalesTicketFilterValueOptions}
          appliedRules={appliedFilters}
          onApply={(rules) => {
            setAppliedFilters(rules);
            setPage(1);
          }}
          onClear={() => {
            setAppliedFilters([]);
            setPage(1);
          }}
        />
      </div>
      {appliedFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {appliedFilters.map((filterRule) => (
                <Badge
                  key={filterRule.id}
                  variant="outline"
                  className="gap-2 rounded-full border-[var(--customer-border)] bg-[var(--customer-primary-soft)] px-3 py-1 text-sm text-[var(--customer-primary)]"
                >
                  {formatFilterChip(filterRule, result.items)}
                  <button
                    type="button"
                    className="rounded-full text-[var(--customer-primary)] transition hover:text-[var(--customer-text)]"
                    aria-label={`Remove filter ${formatFilterChip(filterRule, result.items)}`}
                    onClick={() => {
                      setAppliedFilters((current) =>
                        current.filter((currentRule) => currentRule.id !== filterRule.id),
                      );
                      setPage(1);
                    }}
                  >
                    ×
                  </button>
                </Badge>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAppliedFilters([]);
                  setPage(1);
                }}
              >
                Clear all
              </Button>
            </div>
          )}

      {error ? (
        <ErrorNotice title="Unable to load service requests.">
          <Button variant="secondary" type="button" onClick={() => void loadTickets()}>
            Retry
          </Button>
        </ErrorNotice>
      ) : loading ? (
        <TicketListSkeleton />
      ) : result.items.length === 0 ? (
        <EmptyState />
      ) : (
        <SalesTicketTable
          tickets={result.items}
          pagination={result.pagination}
          onPageChange={(nextPage) => setPage(nextPage)}
          onSendToCrm={sendToCrm}
        />
      )}
    </div>
  );
}

function getSalesTicketFilterValueOptions(field: TicketFilterRule['field'], tickets: CustomerTicket[]) {
  if (field === 'status') {
    return [
      { value: 'SUBMITTED', label: 'Submitted' },
      { value: 'OPEN', label: 'Open' },
      { value: 'CLOSED', label: 'Closed' },
    ];
  }
  if (field === 'crmHandoff') {
    return [
      { value: 'NOT_SENT', label: 'Not Sent' },
      { value: 'SENT', label: 'Sent' },
    ];
  }
  const values = new Map<string, string>();
  tickets.forEach((ticket) => {
    if (field === 'customer' && ticket.customer.companyName) {
      values.set(ticket.customer.companyName, ticket.customer.companyName);
    }
    if (field === 'ticketNumber') {
      values.set(ticket.ticketNumber, ticket.ticketNumber);
    }
    if (field === 'createdDate') {
      const date = new Date(ticket.createdAt);
      if (!Number.isNaN(date.getTime())) {
        const value = date.toISOString().slice(0, 10);
        values.set(value, value);
      }
    }
    if (field === 'createdBy') {
      const label = ticket.createdBy.name ?? ticket.createdBy.email;
      if (label) values.set(ticket.createdBy.id, label);
    }
  });
  return Array.from(values.entries()).map(([value, label]) => ({ value, label }));
}

function toSalesApiFilters(filters: TicketFilterRule[]): SalesTicketFilterRule[] {
  return filters.flatMap((filter) => {
    if (!filter.field || !filter.condition || !filter.value.trim()) return [];
    if (
      ![
        'ticketNumber',
        'customer',
        'description',
        'status',
        'crmHandoff',
        'createdDate',
        'createdBy',
      ].includes(filter.field)
    ) {
      return [];
    }
    if (!['equals', 'contains', 'before', 'after'].includes(filter.condition)) return [];
    return [
      {
        field: filter.field as SalesTicketFilterRule['field'],
        condition: filter.condition as SalesTicketFilterRule['condition'],
        value: filter.value.trim(),
      },
    ];
  });
}

function formatFilterChip(filterRule: TicketFilterRule, tickets: CustomerTicket[]) {
  const definition = getTicketFilterDefinition(filterRule.field, salesTicketFilterDefinitions);
  const fieldLabel = definition?.label ?? 'Filter';
  const conditionLabel = filterRule.condition
    ? ticketFilterConditionLabels[filterRule.condition]
    : '';
  const valueLabel = formatChipValue(filterRule.value, filterRule, tickets);
  if (filterRule.condition === 'equals') return `${fieldLabel}: ${valueLabel}`;
  return [fieldLabel, conditionLabel, valueLabel].filter(Boolean).join(' ');
}

function formatChipValue(value: string, filterRule: TicketFilterRule, tickets: CustomerTicket[]) {
  if (filterRule.field === 'customer') {
    const matchingTicket = tickets.find((ticket) => ticket.customer.companyName === value);
    return matchingTicket?.customer.companyName ?? value;
  }
  if (filterRule.field === 'createdBy') {
    const matchingTicket = tickets.find((ticket) => ticket.createdBy.id === value);
    return matchingTicket?.createdBy.name ?? matchingTicket?.createdBy.email ?? value;
  }
  if (value === 'NOT_SENT') return 'Not Sent';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function ErrorNotice({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Card className="border-[var(--customer-danger)]/30 bg-[var(--customer-danger)]/10">
      <CardContent className="p-4">
        <p className="font-semibold text-[var(--customer-danger)]">{title}</p>
        <div className="mt-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function TicketListSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3" aria-label="Loading service requests">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-7">
              {Array.from({ length: 7 }, (__, cell) => (
                <Skeleton key={cell} className="h-5" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex min-h-64 flex-col items-center justify-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--customer-primary-soft)] text-[var(--customer-primary)]">
            <FileQuestion size={22} />
          </span>
          <h2 className="mt-4 text-base font-semibold text-[var(--customer-text)]">
            No submitted service requests
          </h2>
          <p className="mt-1 text-sm text-[var(--customer-text-muted)]">
            Customer-submitted tickets will appear here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
