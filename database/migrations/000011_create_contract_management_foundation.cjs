const contractStatusCheck =
  "status in ('DRAFT', 'PENDING_SALES_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'ACTIVE', 'CANCELLED')";

exports.up = (pgm) => {
  pgm.createSequence('contract_reference_seq', {
    ifNotExists: true,
  });

  pgm.createTable('contracts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    reference: {
      type: 'text',
      unique: true,
    },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'RESTRICT',
    },
    product_id: {
      type: 'uuid',
      notNull: true,
      references: 'product_catalog(id)',
      onDelete: 'RESTRICT',
    },
    packaging: {
      type: 'text',
      notNull: true,
    },
    uom: {
      type: 'text',
      notNull: true,
    },
    quantity: {
      type: 'numeric(12, 3)',
      notNull: true,
    },
    start_date: {
      type: 'date',
      notNull: true,
    },
    end_date: {
      type: 'date',
      notNull: true,
    },
    fulfilment: {
      type: 'text',
      notNull: true,
      check: "fulfilment in ('PICKUP', 'DELIVERY')",
    },
    pickup_location_id: {
      type: 'text',
    },
    delivery_location_id: {
      type: 'text',
    },
    delivery_city: {
      type: 'text',
    },
    pallet_required: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    pallet_type: {
      type: 'text',
    },
    product_list_price: {
      type: 'numeric(12, 2)',
      notNull: true,
    },
    product_price: {
      type: 'numeric(12, 2)',
      notNull: true,
    },
    delivery_list_price: {
      type: 'numeric(12, 2)',
    },
    delivery_price: {
      type: 'numeric(12, 2)',
    },
    sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'DRAFT',
      check: contractStatusCheck,
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

  pgm.createTable('contract_status_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    contract_id: {
      type: 'uuid',
      notNull: true,
      references: 'contracts(id)',
      onDelete: 'CASCADE',
    },
    previous_status: {
      type: 'text',
      check: contractStatusCheck.replaceAll('status', 'previous_status'),
    },
    new_status: {
      type: 'text',
      notNull: true,
      check: contractStatusCheck.replaceAll('status', 'new_status'),
    },
    action: {
      type: 'text',
      notNull: true,
    },
    reason: {
      type: 'text',
    },
    changed_by: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('contracts', 'reference');
  pgm.createIndex('contracts', 'customer_account_id');
  pgm.createIndex('contracts', 'product_id');
  pgm.createIndex('contracts', 'sales_user_id');
  pgm.createIndex('contracts', 'status');
  pgm.createIndex('contracts', 'created_at');
  pgm.createIndex('contract_status_events', 'contract_id');
  pgm.createIndex('contract_status_events', 'changed_by');
  pgm.createIndex('contract_status_events', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('contract_status_events');
  pgm.dropTable('contracts');
  pgm.dropSequence('contract_reference_seq', { ifExists: true });
};
