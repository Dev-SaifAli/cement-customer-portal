exports.up = (pgm) => {
  pgm.addColumns('orders', {
    pallet_required: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    pallet_type: {
      type: 'text',
    },
    pallet_quantity: {
      type: 'integer',
    },
  });

  pgm.addConstraint('orders', 'orders_pallet_consistency_check', {
    check: `(
      pallet_required = false
      and pallet_type is null
      and pallet_quantity is null
    ) or (
      pallet_required = true
      and nullif(btrim(pallet_type), '') is not null
      and pallet_quantity > 0
    )`,
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('orders', 'orders_pallet_consistency_check');
  pgm.dropColumns('orders', ['pallet_required', 'pallet_type', 'pallet_quantity']);
};
