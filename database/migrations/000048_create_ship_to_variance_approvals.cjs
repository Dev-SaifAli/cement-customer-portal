exports.up = (pgm) => {
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check:
      "role in ('SALES_REP','HADER_MANAGER','HADER_OPERATIONS','DISPATCH_USER','LOADING_USER','DELIVERY_TEAM_USER','PRICE_MANAGER','PRICING_ADMIN','COMMERCIAL_DIRECTOR')",
  });

  pgm.createTable('ship_to_variance_decisions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    shipment_id: { type: 'uuid', notNull: true, unique: true, references: 'shipments(id)', onDelete: 'RESTRICT' },
    order_id: { type: 'uuid', notNull: true, references: 'orders(id)', onDelete: 'RESTRICT' },
    product_id: { type: 'uuid', notNull: true, references: 'product_catalog(id)', onDelete: 'RESTRICT' },
    quantity_ton: { type: 'numeric(14,3)', notNull: true, check: 'quantity_ton > 0' },
    ordered_city_id: { type: 'uuid', notNull: true, references: 'ksa_cities(id)', onDelete: 'RESTRICT' },
    actual_city_id: { type: 'uuid', notNull: true, references: 'ksa_cities(id)', onDelete: 'RESTRICT' },
    ordered_price_per_ton: { type: 'numeric(14,2)', notNull: true },
    actual_price_per_ton: { type: 'numeric(14,2)', notNull: true },
    difference_per_ton: { type: 'numeric(14,2)', notNull: true, check: 'difference_per_ton > 0' },
    extra_charge: { type: 'numeric(16,2)', notNull: true, check: 'extra_charge > 0' },
    status: { type: 'varchar(30)', notNull: true },
    raised_or_dismissed_by_sales_user_id: { type: 'uuid', notNull: true, references: 'sales_users(id)', onDelete: 'RESTRICT' },
    decided_by_sales_user_id: { type: 'uuid', references: 'sales_users(id)', onDelete: 'RESTRICT' },
    rejection_reason: { type: 'text' },
    decided_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('ship_to_variance_decisions', 'ship_to_variance_decisions_status_check', {
    check: "status in ('DISMISSED','PENDING_APPROVAL','APPROVED','REJECTED')",
  });
  pgm.createIndex('ship_to_variance_decisions', ['status', 'created_at']);

  pgm.createTable('ship_to_variance_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    decision_id: { type: 'uuid', notNull: true, references: 'ship_to_variance_decisions(id)', onDelete: 'CASCADE' },
    shipment_id: { type: 'uuid', notNull: true, references: 'shipments(id)', onDelete: 'RESTRICT' },
    event_type: { type: 'varchar(50)', notNull: true },
    changed_by_sales_user_id: { type: 'uuid', notNull: true, references: 'sales_users(id)', onDelete: 'RESTRICT' },
    event_data: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('ship_to_variance_events', 'ship_to_variance_events_type_check', {
    check: "event_type in ('VARIANCE_DISMISSED','EXTRA_CHARGE_RAISED','EXTRA_CHARGE_APPROVED','EXTRA_CHARGE_REJECTED')",
  });
  pgm.createIndex('ship_to_variance_events', ['decision_id', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('ship_to_variance_events');
  pgm.dropTable('ship_to_variance_decisions');
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check:
      "role in ('SALES_REP','HADER_MANAGER','HADER_OPERATIONS','DISPATCH_USER','LOADING_USER','DELIVERY_TEAM_USER','PRICE_MANAGER','PRICING_ADMIN')",
  });
};
