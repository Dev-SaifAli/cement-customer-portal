import type { CustomerTicket } from '../../services/customerTicketsService';

export type TicketFilterField =
  | 'ticketNumber'
  | 'customer'
  | 'description'
  | 'status'
  | 'crmHandoff'
  | 'createdDate'
  | 'updatedDate'
  | 'createdBy';

export type TicketFilterCondition =
  | 'equals'
  | 'contains'
  | 'before'
  | 'after'
  | 'between';

export type TicketFilterValueKind = 'select' | 'text' | 'date' | 'dateRange';

export interface TicketFilterDefinition {
  id: TicketFilterField;
  label: string;
  valueKind: TicketFilterValueKind;
  conditions: TicketFilterCondition[];
}

export interface TicketFilterRule {
  id: string;
  field: TicketFilterField | '';
  condition: TicketFilterCondition | '';
  value: string;
  valueTo?: string;
}

export const ticketFilterDefinitions: TicketFilterDefinition[] = [
  {
    id: 'ticketNumber',
    label: 'Ticket Number',
    valueKind: 'text',
    conditions: ['equals', 'contains'],
  },
  {
    id: 'description',
    label: 'Description',
    valueKind: 'text',
    conditions: ['contains'],
  },
  {
    id: 'status',
    label: 'Status',
    valueKind: 'select',
    conditions: ['equals'],
  },
  {
    id: 'crmHandoff',
    label: 'CRM Handoff',
    valueKind: 'select',
    conditions: ['equals'],
  },
  {
    id: 'createdDate',
    label: 'Created Date',
    valueKind: 'date',
    conditions: ['before', 'after', 'between'],
  },
  {
    id: 'updatedDate',
    label: 'Updated Date',
    valueKind: 'date',
    conditions: ['before', 'after', 'between'],
  },
];

export const salesTicketFilterDefinitions: TicketFilterDefinition[] = [
  {
    id: 'ticketNumber',
    label: 'Ticket Number',
    valueKind: 'text',
    conditions: ['equals', 'contains'],
  },
  {
    id: 'customer',
    label: 'Customer',
    valueKind: 'select',
    conditions: ['equals', 'contains'],
  },
  {
    id: 'description',
    label: 'Description',
    valueKind: 'text',
    conditions: ['contains'],
  },
  {
    id: 'status',
    label: 'Status',
    valueKind: 'select',
    conditions: ['equals'],
  },
  {
    id: 'crmHandoff',
    label: 'CRM Handoff',
    valueKind: 'select',
    conditions: ['equals'],
  },
  {
    id: 'createdDate',
    label: 'Created Date',
    valueKind: 'date',
    conditions: ['before', 'after'],
  },
  {
    id: 'createdBy',
    label: 'Created By',
    valueKind: 'select',
    conditions: ['equals'],
  },
];

export const ticketFilterConditionLabels: Record<TicketFilterCondition, string> = {
  equals: 'Is',
  contains: 'Contains',
  before: 'Before',
  after: 'After',
  between: 'Between',
};

export function getTicketFilterDefinition(
  field: TicketFilterField | '',
  definitions: TicketFilterDefinition[] = ticketFilterDefinitions,
) {
  return definitions.find((definition) => definition.id === field) ?? null;
}

export function getTicketFilterValueOptions(field: TicketFilterField | '', tickets: CustomerTicket[]) {
  if (!field) return [];

  if (field === 'status') {
    return [
      { value: 'DRAFT', label: 'Draft' },
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
    const option = getTicketOptionValue(field, ticket);
    if (option?.value) values.set(option.value, option.label);
  });

  return Array.from(values.entries()).map(([value, label]) => ({ value, label }));
}

function getTicketOptionValue(field: TicketFilterField, ticket: CustomerTicket) {
  if (field === 'ticketNumber') return { value: ticket.ticketNumber, label: ticket.ticketNumber };
  if (field === 'customer') {
    const label = ticket.customer.companyName ?? '';
    return label ? { value: ticket.customer.accountId, label } : null;
  }
  if (field === 'createdBy') {
    const label = ticket.createdBy.name ?? ticket.createdBy.email ?? '';
    return label ? { value: ticket.createdBy.id, label } : null;
  }
  if (field === 'createdDate') return dateOption(ticket.createdAt);
  if (field === 'updatedDate') return dateOption(ticket.updatedAt);
  return null;
}

function dateOption(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const isoDate = date.toISOString().slice(0, 10);
  return { value: isoDate, label: isoDate };
}
