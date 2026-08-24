exports.up = (pgm) => {
  pgm.createTable('product_list_prices', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    product_id: {
      type: 'uuid',
      notNull: true,
      references: 'product_catalog(id)',
      onDelete: 'RESTRICT',
    },
    packaging_type: { type: 'text', notNull: true },
    packaging_key: { type: 'text', notNull: true },
    city: { type: 'text', notNull: true },
    city_key: { type: 'text', notNull: true },
    uom: { type: 'text', notNull: true },
    list_price: {
      type: 'numeric(14, 2)',
      notNull: true,
      check: 'list_price > 0',
    },
    is_active: { type: 'boolean', notNull: true, default: true },
    configured_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('product_list_prices', 'product_list_prices_scope_unique', {
    unique: ['product_id', 'packaging_key', 'city_key', 'uom'],
  });
  pgm.createIndex('product_list_prices', ['city_key', 'is_active']);

  pgm.createTable('hader_delivery_prices', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    city: { type: 'text', notNull: true },
    city_key: { type: 'text', notNull: true },
    uom: { type: 'text', notNull: true },
    delivery_price: {
      type: 'numeric(14, 2)',
      notNull: true,
      check: 'delivery_price >= 0',
    },
    is_active: { type: 'boolean', notNull: true, default: true },
    configured_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('hader_delivery_prices', 'hader_delivery_prices_scope_unique', {
    unique: ['city_key', 'uom'],
  });
  pgm.createIndex('hader_delivery_prices', ['city_key', 'is_active']);
};

exports.down = (pgm) => {
  pgm.dropTable('hader_delivery_prices');
  pgm.dropTable('product_list_prices');
};
