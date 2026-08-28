exports.up = (pgm) => {
  pgm.addColumns('orders', {
    customer_truck_id: {
      type: 'uuid',
      references: 'customer_trucks(id)',
      onDelete: 'RESTRICT',
    },
    customer_driver_id: {
      type: 'uuid',
      references: 'customer_drivers(id)',
      onDelete: 'RESTRICT',
    },
    pickup_truck_snapshot: { type: 'jsonb' },
    pickup_driver_snapshot: { type: 'jsonb' },
  });

  pgm.createIndex('orders', 'customer_truck_id');
  pgm.createIndex('orders', 'customer_driver_id');
};

exports.down = (pgm) => {
  pgm.dropIndex('orders', 'customer_driver_id');
  pgm.dropIndex('orders', 'customer_truck_id');
  pgm.dropColumns('orders', [
    'pickup_driver_snapshot',
    'pickup_truck_snapshot',
    'customer_driver_id',
    'customer_truck_id',
  ]);
};
