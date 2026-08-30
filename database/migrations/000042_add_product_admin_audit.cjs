exports.up = (pgm) => {
  pgm.addColumns('product_catalog', {
    updated_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users',
      onDelete: 'SET NULL',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('product_catalog', ['updated_by_sales_user_id']);
};
