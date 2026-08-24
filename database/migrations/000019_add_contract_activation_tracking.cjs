exports.up = (pgm) => {
  pgm.addColumns('contracts', {
    shipped_quantity_tons: {
      type: 'numeric(14, 3)',
      notNull: true,
      default: 0,
    },
    remaining_quantity_tons: {
      type: 'numeric(14, 3)',
    },
    activated_by: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    activated_at: {
      type: 'timestamptz',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('contracts', [
    'shipped_quantity_tons',
    'remaining_quantity_tons',
    'activated_by',
    'activated_at',
  ]);
};
