const orderStatusCheck = "status in ('DRAFT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')";

exports.up = (pgm) => {
  pgm.createSequence('order_reference_seq', { ifNotExists: true });

  pgm.createTable('orders', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    order_number: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    contract_id: {
      type: 'uuid',
      notNull: true,
      references: 'contracts(id)',
      onDelete: 'RESTRICT',
    },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'RESTRICT',
    },
    ship_to_location_id: { type: 'text' },
    pickup_location_id: { type: 'text' },
    fulfilment_type: {
      type: 'text',
      notNull: true,
      check: "fulfilment_type in ('PICKUP', 'DELIVERY')",
    },
    hader_city_id: {
      type: 'uuid',
      references: 'ksa_cities(id)',
      onDelete: 'RESTRICT',
    },
    hader_city_name: { type: 'text' },
    created_by_customer_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'DRAFT',
      check: orderStatusCheck,
    },
    requested_quantity_tons: {
      type: 'numeric(14, 3)',
      notNull: true,
      check: 'requested_quantity_tons > 0',
    },
    remaining_contract_quantity_snapshot: {
      type: 'numeric(14, 3)',
      notNull: true,
      check: 'remaining_contract_quantity_snapshot >= 0',
    },
    approved_customer_rate_per_ton: {
      type: 'numeric(14, 2)',
      notNull: true,
      check: 'approved_customer_rate_per_ton >= 0',
    },
    amount: {
      type: 'numeric(16, 2)',
      notNull: true,
      check: 'amount >= 0',
    },
    submitted_at: { type: 'timestamptz' },
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

  pgm.createTable('order_items', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      references: 'orders(id)',
      onDelete: 'CASCADE',
    },
    contract_item_id: {
      type: 'uuid',
      references: 'contract_items(id)',
      onDelete: 'RESTRICT',
    },
    product_id: {
      type: 'uuid',
      notNull: true,
      references: 'product_catalog(id)',
      onDelete: 'RESTRICT',
    },
    product_code: { type: 'text', notNull: true },
    product_name: { type: 'text', notNull: true },
    packaging: { type: 'text', notNull: true },
    contract_uom: { type: 'text', notNull: true },
    requested_quantity_tons: {
      type: 'numeric(14, 3)',
      notNull: true,
      check: 'requested_quantity_tons > 0',
    },
    equivalent_tons: {
      type: 'numeric(14, 3)',
      notNull: true,
      check: 'equivalent_tons > 0',
    },
    approved_customer_rate_per_ton: {
      type: 'numeric(14, 2)',
      notNull: true,
      check: 'approved_customer_rate_per_ton >= 0',
    },
    amount: {
      type: 'numeric(16, 2)',
      notNull: true,
      check: 'amount >= 0',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createTable('order_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      references: 'orders(id)',
      onDelete: 'CASCADE',
    },
    event_type: { type: 'text', notNull: true },
    previous_status: {
      type: 'text',
      check: orderStatusCheck.replaceAll('status', 'previous_status'),
    },
    new_status: { type: 'text', check: orderStatusCheck.replaceAll('status', 'new_status') },
    changed_by_customer_user_id: {
      type: 'uuid',
      references: 'customer_users(id)',
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

  pgm.createIndex('orders', 'contract_id');
  pgm.createIndex('orders', 'customer_account_id');
  pgm.createIndex('orders', 'status');
  pgm.createIndex('orders', 'created_by_customer_user_id');
  pgm.createIndex('orders', 'created_at');
  pgm.createIndex('order_items', 'order_id');
  pgm.createIndex('order_items', 'contract_item_id');
  pgm.createIndex('order_items', 'product_id');
  pgm.createIndex('order_events', 'order_id');
  pgm.createIndex('order_events', 'event_type');
  pgm.createIndex('order_events', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('order_events');
  pgm.dropTable('order_items');
  pgm.dropTable('orders');
  pgm.dropSequence('order_reference_seq', { ifExists: true });
};
