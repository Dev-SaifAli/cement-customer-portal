exports.up = (pgm) => {
  pgm.createSequence('customer_quotation_reference_seq', {
    ifNotExists: true,
  });

  pgm.createTable('customer_quotations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'RESTRICT',
    },
    reference: {
      type: 'text',
      unique: true,
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'DRAFT',
      check: "status in ('DRAFT', 'PENDING_SALES_REVIEW')",
    },
    fulfilment_type: {
      type: 'text',
      notNull: true,
      check: "fulfilment_type in ('PICKUP', 'DELIVERY')",
    },
    pickup_location_id: {
      type: 'text',
    },
    ship_to_location_id: {
      type: 'text',
    },
    requested_date: {
      type: 'date',
    },
    notes: {
      type: 'text',
    },
    submitted_at: {
      type: 'timestamptz',
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

  pgm.createTable('customer_quotation_items', {
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
    product_id: {
      type: 'uuid',
      notNull: true,
      references: 'product_catalog(id)',
      onDelete: 'RESTRICT',
    },
    packaging_type: {
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
    pallet_required: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    pallet_type: {
      type: 'text',
    },
    pallet_quantity: {
      type: 'integer',
    },
    display_order: {
      type: 'integer',
      notNull: true,
      default: 0,
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

  pgm.createIndex('customer_quotations', 'customer_account_id');
  pgm.createIndex('customer_quotations', 'status');
  pgm.createIndex('customer_quotations', 'reference');
  pgm.createIndex('customer_quotation_items', 'quotation_id');
  pgm.createIndex('customer_quotation_items', 'product_id');
};

exports.down = (pgm) => {
  pgm.dropTable('customer_quotation_items');
  pgm.dropTable('customer_quotations');
  pgm.dropSequence('customer_quotation_reference_seq', { ifExists: true });
};
