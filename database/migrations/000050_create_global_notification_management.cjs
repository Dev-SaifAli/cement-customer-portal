exports.up = (pgm) => {
  pgm.createTable('global_notifications', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    title: { type: 'varchar(180)', notNull: true },
    message: { type: 'text', notNull: true },
    audience: { type: 'varchar(20)', notNull: true },
    target_roles: { type: 'text[]', notNull: true, default: '{}' },
    is_active: { type: 'boolean', notNull: true, default: true },
    published_at: { type: 'timestamptz' },
    created_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('global_notifications', 'global_notifications_audience_check', {
    check: "audience in ('CUSTOMER', 'SALES')",
  });
  pgm.createIndex('global_notifications', ['created_at']);
  pgm.createIndex('global_notifications', ['audience', 'is_active', 'published_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('global_notifications');
};
