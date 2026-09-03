import { FileQuestion, Plus } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TicketFilterBuilder } from '../../components/customer-tickets/TicketFilterBuilder';
import { TicketTable } from '../../components/customer-tickets/TicketTable';
import {
  getTicketFilterDefinition,
  ticketFilterConditionLabels,
  type TicketFilterRule,
} from '../../components/customer-tickets/ticketFilterConfig';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
} from '../../components/ui/shadcn';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  deleteCustomerTicket,
  listCustomerTickets,
  type CustomerTicketFilterRule,
  type CustomerTicketListResult,
  type CustomerTicket,
} from '../../services/customerTicketsService';

const emptyResult: CustomerTicketListResult = {
  items: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
};

const creatorRoles = new Set(['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER']);
const deleteRoles = new Set(['CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER']);

export function CustomerTickets() {
  const { user } = useCustomerAuth();
  const [result, setResult] = useState<CustomerTicketListResult>(emptyResult);
  const [appliedFilters, setAppliedFilters] = useState<TicketFilterRule[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const canCreate = Boolean(user?.role && creatorRoles.has(user.role));
  const canDeleteTickets = Boolean(user?.role && deleteRoles.has(user.role));
  const showCreatedByColumn = user?.role === 'CUSTOMER_ADMIN';

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await listCustomerTickets({
        page,
        filters: toApiFilters(appliedFilters),
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

  const deleteTicket = async (ticket: CustomerTicket) => {
    try {
      await deleteCustomerTicket(ticket.id);
      await loadTickets();
    } catch {
      setError(true);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--customer-primary)]">Customer Support</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--customer-text)]">
            Service Requests
          </h1>
          <p className="mt-1 text-sm text-[var(--customer-text-muted)]">
            Create and track support requests with the AlSafwa team.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link to="/customer/tickets/new">
              <Plus size={16} /> New Service Request
            </Link>
          </Button>
        )}
      </header>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--customer-text)]">
                {result.pagination.total} {result.pagination.total === 1 ? 'Request' : 'Requests'}
              </p>
            </div>
            <div className="flex w-full justify-end sm:w-auto">
              <TicketFilterBuilder
                tickets={result.items}
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
          </div>
          {appliedFilters.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
        </CardContent>
      </Card>

      {error ? (
        <ErrorNotice title="Unable to load service requests.">
          <Button variant="secondary" type="button" onClick={() => void loadTickets()}>
            Retry
          </Button>
        </ErrorNotice>
      ) : loading ? (
        <TicketListSkeleton />
      ) : result.items.length === 0 ? (
        <EmptyState
          canCreate={canCreate}
        />
      ) : (
        <TicketTable
          tickets={result.items}
          pagination={result.pagination}
          onPageChange={(nextPage) => setPage(nextPage)}
          canDeleteTickets={canDeleteTickets}
          currentCustomerUserId={user?.id ?? null}
          showCreatedByColumn={showCreatedByColumn}
          onDeleteTicket={deleteTicket}
        />
      )}
    </div>
  );
}

function formatFilterChip(filterRule: TicketFilterRule, tickets: CustomerTicket[]) {
  const definition = getTicketFilterDefinition(filterRule.field);
  const fieldLabel = definition?.label ?? 'Filter';
  const conditionLabel = filterRule.condition
    ? ticketFilterConditionLabels[filterRule.condition]
    : '';
  const valueLabel =
    filterRule.condition === 'between' && filterRule.valueTo
      ? `${formatChipValue(filterRule.value, filterRule, tickets)} - ${formatChipValue(
          filterRule.valueTo,
          filterRule,
          tickets,
        )}`
      : formatChipValue(filterRule.value, filterRule, tickets);

  if (filterRule.condition === 'equals') return `${fieldLabel}: ${valueLabel}`;
  return [fieldLabel, conditionLabel, valueLabel].filter(Boolean).join(' ');
}

function formatChipValue(value: string, filterRule: TicketFilterRule, tickets: CustomerTicket[]) {
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

function toApiFilters(filters: TicketFilterRule[]): CustomerTicketFilterRule[] {
  return filters.flatMap((filter) => {
    if (!filter.field || !filter.condition || !filter.value.trim()) return [];
    const apiFilter: CustomerTicketFilterRule = {
      field: filter.field,
      condition: filter.condition,
      value: filter.value.trim(),
    };
    if (filter.condition === 'between' && filter.valueTo?.trim()) {
      apiFilter.valueTo = filter.valueTo.trim();
    }
    return [apiFilter];
  });
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
            <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              {Array.from({ length: 6 }, (__, cell) => (
                <Skeleton key={cell} className="h-5" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  canCreate,
}: {
  canCreate: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex min-h-64 flex-col items-center justify-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--customer-primary-soft)] text-[var(--customer-primary)]">
            <FileQuestion size={22} />
          </span>
          <h2 className="mt-4 text-base font-semibold text-[var(--customer-text)]">
            No service requests yet
          </h2>
          {canCreate && (
            <div className="mt-4">
              <Button asChild>
                <Link to="/customer/tickets/new">New Service Request</Link>
              </Button>
            </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
