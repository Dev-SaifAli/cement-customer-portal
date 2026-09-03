const ticketStatusCheck = "status in ('DRAFT', 'SUBMITTED', 'OPEN', 'CLOSED')";
const crmHandoffStatusCheck = "crm_handoff_status in ('NOT_SENT', 'SENT')";
const ticketEventStatusCheck =
  "previous_status is null or previous_status in ('DRAFT', 'SUBMITTED', 'OPEN', 'CLOSED')";
const ticketNewStatusCheck =
  "new_status is null or new_status in ('DRAFT', 'SUBMITTED', 'OPEN', 'CLOSED')";

exports.up = (pgm) => {
  pgm.createSequence('ticket_reference_seq', { ifNotExists: true });

  pgm.createTable('customer_tickets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    ticket_number: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'RESTRICT',
    },
    customer_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    customer_phone: { type: 'text' },
    description: { type: 'text', notNull: true },
    customer_user_role: { type: 'text', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      default: 'DRAFT',
      check: ticketStatusCheck,
    },
    crm_handoff_status: {
      type: 'text',
      notNull: true,
      default: 'NOT_SENT',
      check: crmHandoffStatusCheck,
    },
    sales_sent_at: { type: 'timestamptz' },
    sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    crm_response: { type: 'text' },
    crm_resolved_at: { type: 'timestamptz' },
    crm_response_imported_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createTable('customer_ticket_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    ticket_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_tickets(id)',
      onDelete: 'CASCADE',
    },
    event_type: { type: 'text', notNull: true },
    previous_status: { type: 'text', check: ticketEventStatusCheck },
    new_status: { type: 'text', check: ticketNewStatusCheck },
    changed_by_customer_user_id: {
      type: 'uuid',
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    changed_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    event_data: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('customer_tickets', 'customer_account_id');
  pgm.createIndex('customer_tickets', 'customer_user_id');
  pgm.createIndex('customer_tickets', 'status');
  pgm.createIndex('customer_tickets', 'crm_handoff_status');
  pgm.createIndex('customer_tickets', 'sales_user_id');
  pgm.createIndex('customer_tickets', 'created_at');
  pgm.createIndex('customer_ticket_events', 'ticket_id');
  pgm.createIndex('customer_ticket_events', 'event_type');
  pgm.createIndex('customer_ticket_events', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('customer_ticket_events');
  pgm.dropTable('customer_tickets');
  pgm.dropSequence('ticket_reference_seq', { ifExists: true });
};
