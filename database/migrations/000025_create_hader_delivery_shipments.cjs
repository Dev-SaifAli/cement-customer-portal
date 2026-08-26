const requestStatusCheck =
  "status in ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED_TO_SHIPMENT')";
const shipmentStatusCheck =
  "status in ('CREATED', 'ASSIGNED', 'LOADING', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED')";

exports.up = (pgm) => {
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check:
      "role in ('SALES_REP', 'HADER_MANAGER', 'HADER_OPERATIONS', 'DISPATCH_USER', 'PRICE_MANAGER', 'PRICING_ADMIN')",
  });
  pgm.createSequence('delivery_request_number_seq', { ifNotExists: true });
  pgm.createSequence('shipment_number_seq', { ifNotExists: true });

  pgm.createTable('delivery_requests', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    request_number: { type: 'text', notNull: true, unique: true },
    order_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'orders(id)',
      onDelete: 'RESTRICT',
    },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'RESTRICT',
    },
    hader_city_id: { type: 'uuid', references: 'ksa_cities(id)', onDelete: 'RESTRICT' },
    ship_to_location_id: { type: 'text' },
    quantity_ton: { type: 'numeric(14,3)', notNull: true, check: 'quantity_ton > 0' },
    requested_date: { type: 'date', notNull: true },
    status: { type: 'text', notNull: true, default: 'PENDING', check: requestStatusCheck },
    rejection_reason: { type: 'text' },
    reviewed_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    reviewed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('delivery_request_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    delivery_request_id: {
      type: 'uuid',
      notNull: true,
      references: 'delivery_requests(id)',
      onDelete: 'CASCADE',
    },
    event_type: { type: 'text', notNull: true },
    previous_status: { type: 'text' },
    new_status: { type: 'text' },
    changed_by_customer_user_id: {
      type: 'uuid',
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    changed_by_sales_user_id: { type: 'uuid', references: 'sales_users(id)', onDelete: 'RESTRICT' },
    reason: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('shipments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    shipment_number: { type: 'text', notNull: true, unique: true },
    delivery_request_id: {
      type: 'uuid',
      notNull: true,
      references: 'delivery_requests(id)',
      onDelete: 'RESTRICT',
    },
    order_id: { type: 'uuid', notNull: true, references: 'orders(id)', onDelete: 'RESTRICT' },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'RESTRICT',
    },
    quantity_ton: { type: 'numeric(14,3)', notNull: true, check: 'quantity_ton > 0' },
    status: { type: 'text', notNull: true, default: 'CREATED', check: shipmentStatusCheck },
    truck_id: { type: 'uuid', references: 'customer_trucks(id)', onDelete: 'RESTRICT' },
    driver_id: { type: 'uuid', references: 'customer_drivers(id)', onDelete: 'RESTRICT' },
    transporter_id: { type: 'uuid' },
    scheduled_date: { type: 'date' },
    delivered_at: { type: 'timestamptz' },
    created_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('shipment_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    shipment_id: { type: 'uuid', notNull: true, references: 'shipments(id)', onDelete: 'CASCADE' },
    event_type: { type: 'text', notNull: true },
    previous_status: { type: 'text' },
    new_status: { type: 'text' },
    changed_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('delivery_requests', ['status', 'created_at']);
  pgm.createIndex('delivery_requests', 'customer_account_id');
  pgm.createIndex('shipments', ['delivery_request_id', 'created_at']);
  pgm.createIndex('shipments', ['status', 'created_at']);
  pgm.createIndex('shipments', 'order_id');
  pgm.createIndex('shipment_events', ['shipment_id', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('shipment_events');
  pgm.dropTable('shipments');
  pgm.dropTable('delivery_request_events');
  pgm.dropTable('delivery_requests');
  pgm.dropSequence('shipment_number_seq', { ifExists: true });
  pgm.dropSequence('delivery_request_number_seq', { ifExists: true });
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check: "role in ('SALES_REP', 'HADER_MANAGER', 'PRICE_MANAGER', 'PRICING_ADMIN')",
  });
};
