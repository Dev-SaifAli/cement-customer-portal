exports.up = (pgm) => {
  pgm.createTable('product_catalog', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    product_code: {
      type: 'text',
      notNull: true,
    },
    product_name: {
      type: 'text',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    short_description: {
      type: 'text',
    },
    image: {
      type: 'text',
    },
    packaging_type: {
      type: 'text',
      notNull: true,
    },
    uom: {
      type: 'text',
      notNull: true,
    },
    category: {
      type: 'text',
      notNull: true,
    },
    display_order: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  pgm.createIndex('product_catalog', 'product_code', {
    name: 'product_catalog_product_code_unique',
    unique: true,
  });
  pgm.createIndex('product_catalog', 'is_active');
  pgm.createIndex('product_catalog', 'category');
  pgm.createIndex('product_catalog', 'packaging_type');
  pgm.createIndex('product_catalog', 'uom');
};

exports.down = (pgm) => {
  pgm.dropTable('product_catalog');
};
