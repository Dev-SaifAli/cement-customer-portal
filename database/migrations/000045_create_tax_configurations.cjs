exports.up = (pgm) => {
  pgm.createTable('tax_configurations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tax_name: { type: 'text', notNull: true },
    tax_type: { type: 'text', notNull: true },
    rate_percent: { type: 'numeric(5,2)', notNull: true },
    status: { type: 'text', notNull: true, default: 'INACTIVE' },
    created_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    updated_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('tax_configurations', 'tax_configurations_type_check', {
    check: "tax_type in ('VAT')",
  });
  pgm.addConstraint('tax_configurations', 'tax_configurations_rate_check', {
    check: 'rate_percent >= 0 and rate_percent <= 100',
  });
  pgm.addConstraint('tax_configurations', 'tax_configurations_status_check', {
    check: "status in ('ACTIVE', 'INACTIVE')",
  });
  pgm.createIndex('tax_configurations', ['updated_at']);
  pgm.sql(
    "create unique index tax_configurations_one_active_idx on tax_configurations ((status)) where status = 'ACTIVE'",
  );
};

exports.down = (pgm) => {
  pgm.dropTable('tax_configurations');
};
