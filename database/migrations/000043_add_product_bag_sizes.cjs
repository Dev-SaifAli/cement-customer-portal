exports.up = (pgm) => {
  pgm.createTable('product_bag_sizes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    unit_weight_kg: { type: 'numeric(10,3)', notNull: true, unique: true },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'SET NULL',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('product_bag_sizes', 'product_bag_sizes_positive_weight', {
    check: 'unit_weight_kg > 0',
  });

  pgm.sql(`
    insert into product_bag_sizes (unit_weight_kg)
    select distinct unit_weight_kg
      from product_catalog
     where lower(packaging_type) like '%bag%'
       and unit_weight_kg > 0
    on conflict (unit_weight_kg) do nothing;
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('product_bag_sizes', { ifExists: true });
};
