const quotationStatuses = [
  'DRAFT',
  'PENDING_SALES_REVIEW',
  'UNDER_REVIEW',
  'PENDING_HADER_APPROVAL',
  'PENDING_PRICE_APPROVAL',
  'READY_FOR_CUSTOMER',
  'ACCEPTED',
  'REJECTED',
  'CLARIFICATION_REQUESTED',
];

const approvalStates = ['NOT_REQUIRED', 'REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'];

exports.up = (pgm) => {
  pgm.addColumns('sales_users', {
    role: {
      type: 'text',
      notNull: true,
      default: 'SALES_REP',
      check: "role in ('SALES_REP', 'HADER_MANAGER', 'PRICE_MANAGER')",
    },
  });

  pgm.addColumns('product_catalog', {
    list_price: { type: 'numeric(14, 2)' },
    delivery_list_price: { type: 'numeric(14, 2)' },
  });

  pgm.dropConstraint('customer_quotations', 'customer_quotations_status_check');
  pgm.addConstraint('customer_quotations', 'customer_quotations_status_check', {
    check: `status in (${quotationStatuses.map((status) => `'${status}'`).join(', ')})`,
  });

  pgm.addColumns('customer_quotations', {
    valid_until: { type: 'date' },
    payment_terms: { type: 'text' },
    commercial_notes: { type: 'text' },
    subtotal: { type: 'numeric(16, 2)' },
    vat_rate: { type: 'numeric(7, 6)' },
    vat_amount: { type: 'numeric(16, 2)' },
    grand_total: { type: 'numeric(16, 2)' },
    product_price_changed: { type: 'boolean', notNull: true, default: false },
    delivery_price_changed: { type: 'boolean', notNull: true, default: false },
    hader_approval_status: {
      type: 'text',
      notNull: true,
      default: 'NOT_REQUIRED',
      check: `hader_approval_status in (${approvalStates.map((status) => `'${status}'`).join(', ')})`,
    },
    price_approval_status: {
      type: 'text',
      notNull: true,
      default: 'NOT_REQUIRED',
      check: `price_approval_status in (${approvalStates.map((status) => `'${status}'`).join(', ')})`,
    },
  });

  pgm.addColumns('customer_quotation_items', {
    product_list_price: { type: 'numeric(14, 2)' },
    product_price: { type: 'numeric(14, 2)' },
    delivery_list_price: { type: 'numeric(14, 2)' },
    delivery_price: { type: 'numeric(14, 2)' },
    customer_rate: { type: 'numeric(14, 2)' },
    amount: { type: 'numeric(16, 2)' },
  });

  pgm.createTable('quotation_status_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    quotation_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_quotations(id)',
      onDelete: 'CASCADE',
    },
    previous_status: { type: 'text' },
    new_status: { type: 'text', notNull: true },
    action: { type: 'text', notNull: true },
    reason: { type: 'text' },
    changed_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    changed_by_customer_user_id: {
      type: 'uuid',
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('quotation_status_events', 'quotation_id');
  pgm.createIndex('quotation_status_events', 'created_at');

  pgm.sql(`
    insert into quotation_status_events (
      quotation_id,
      previous_status,
      new_status,
      action,
      changed_by_customer_user_id,
      created_at
    )
    select
      quotations.id,
      'DRAFT',
      'PENDING_SALES_REVIEW',
      'CUSTOMER_SUBMITTED',
      (
        select users.id
        from customer_users users
        where users.customer_account_id = quotations.customer_account_id
        order by (users.role = 'CUSTOMER_ADMIN') desc, users.created_at asc
        limit 1
      ),
      coalesce(quotations.submitted_at, quotations.updated_at)
    from customer_quotations quotations
    where quotations.status <> 'DRAFT'
      and not exists (
        select 1
        from quotation_status_events events
        where events.quotation_id = quotations.id
          and events.action = 'CUSTOMER_SUBMITTED'
      )
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('quotation_status_events');
  pgm.dropColumns('customer_quotation_items', [
    'product_list_price',
    'product_price',
    'delivery_list_price',
    'delivery_price',
    'customer_rate',
    'amount',
  ]);
  pgm.dropColumns('customer_quotations', [
    'valid_until',
    'payment_terms',
    'commercial_notes',
    'subtotal',
    'vat_rate',
    'vat_amount',
    'grand_total',
    'product_price_changed',
    'delivery_price_changed',
    'hader_approval_status',
    'price_approval_status',
  ]);
  pgm.dropConstraint('customer_quotations', 'customer_quotations_status_check');
  pgm.addConstraint('customer_quotations', 'customer_quotations_status_check', {
    check: "status in ('DRAFT', 'PENDING_SALES_REVIEW')",
  });
  pgm.dropColumns('product_catalog', ['list_price', 'delivery_list_price']);
  pgm.dropColumns('sales_users', ['role']);
};
