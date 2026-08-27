exports.up = (pgm) => {
  pgm.addColumn('shipments', {
    client_request_id: { type: 'uuid' },
  });
  pgm.addConstraint('shipments', 'shipments_delivery_request_client_request_unique', {
    unique: ['delivery_request_id', 'client_request_id'],
  });
  pgm.addColumn('order_events', {
    changed_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('order_events', 'changed_by_sales_user_id');
  pgm.dropConstraint('shipments', 'shipments_delivery_request_client_request_unique');
  pgm.dropColumn('shipments', 'client_request_id');
};
