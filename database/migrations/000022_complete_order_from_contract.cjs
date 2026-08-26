exports.up = (pgm) => {
  pgm.addColumns('orders', {
    client_request_id: { type: 'uuid' },
    preferred_delivery_date: { type: 'date' },
    delivery_notes: { type: 'text' },
    ship_to_snapshot: { type: 'jsonb' },
    pickup_location_name: { type: 'text' },
    vat_rate: {
      type: 'numeric(5, 2)',
      notNull: true,
      default: 15,
      check: 'vat_rate >= 0',
    },
    vat_amount: {
      type: 'numeric(16, 2)',
      notNull: true,
      default: 0,
      check: 'vat_amount >= 0',
    },
    grand_total: {
      type: 'numeric(16, 2)',
      notNull: true,
      default: 0,
      check: 'grand_total >= 0',
    },
  });

  pgm.sql(`
    create unique index orders_customer_client_request_unique
      on orders (customer_account_id, client_request_id)
      where client_request_id is not null;
  `);
  pgm.createIndex('orders', 'preferred_delivery_date');
};

exports.down = (pgm) => {
  pgm.dropIndex('orders', 'preferred_delivery_date');
  pgm.sql('drop index if exists orders_customer_client_request_unique;');
  pgm.dropColumns('orders', [
    'client_request_id',
    'preferred_delivery_date',
    'delivery_notes',
    'ship_to_snapshot',
    'pickup_location_name',
    'vat_rate',
    'vat_amount',
    'grand_total',
  ]);
};
