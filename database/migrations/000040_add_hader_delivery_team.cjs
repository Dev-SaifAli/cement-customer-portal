exports.up = (pgm) => {
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check:
      "role in ('SALES_REP','HADER_MANAGER','HADER_OPERATIONS','DISPATCH_USER','LOADING_USER','DELIVERY_TEAM_USER','PRICE_MANAGER','PRICING_ADMIN')",
  });

  pgm.addColumns('shipments', {
    in_transit_at: { type: 'timestamptz' },
    in_transit_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    delivered_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    closed_at: { type: 'timestamptz' },
    closed_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.createIndex('shipments', ['status', 'scheduled_date']);
};

exports.down = (pgm) => {
  pgm.dropIndex('shipments', ['status', 'scheduled_date']);
  pgm.dropColumns('shipments', [
    'in_transit_at',
    'in_transit_by_sales_user_id',
    'delivered_by_sales_user_id',
    'closed_at',
    'closed_by_sales_user_id',
  ]);

  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check:
      "role in ('SALES_REP','HADER_MANAGER','HADER_OPERATIONS','DISPATCH_USER','LOADING_USER','PRICE_MANAGER','PRICING_ADMIN')",
  });
};
