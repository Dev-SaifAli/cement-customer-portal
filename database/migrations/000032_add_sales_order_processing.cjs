exports.up = (pgm) => {
  pgm.addColumns('orders', {
    processed_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    processed_at: { type: 'timestamptz' },
  });

  pgm.createIndex('orders', 'processed_by_sales_user_id');
};

exports.down = (pgm) => {
  pgm.dropIndex('orders', 'processed_by_sales_user_id');
  pgm.dropColumns('orders', ['processed_by_sales_user_id', 'processed_at']);
};
