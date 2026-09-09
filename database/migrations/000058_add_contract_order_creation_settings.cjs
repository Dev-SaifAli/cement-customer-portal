exports.up = (pgm) => {
  pgm.dropConstraint('application_settings', 'application_settings_known_key_check');
  pgm.addConstraint('application_settings', 'application_settings_known_key_check', {
    check: "key in ('LIST_PRICE_DIRECT_ORDER_APPROVAL', 'allow_hader_contract_order_creation', 'allow_dispatch_contract_order_creation')",
  });
  pgm.addConstraint('application_settings', 'application_settings_contract_order_creation_value_check', {
    check: "key not in ('allow_hader_contract_order_creation', 'allow_dispatch_contract_order_creation') or value in ('true', 'false')",
  });
  pgm.sql(`insert into application_settings (key, value) values
    ('allow_hader_contract_order_creation', 'false'),
    ('allow_dispatch_contract_order_creation', 'false')
    on conflict (key) do nothing;`);

  pgm.alterColumn('orders', 'created_by_customer_user_id', { notNull: false });
  pgm.addColumn('orders', {
    created_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('orders', 'orders_exactly_one_creator_check', {
    check: '(created_by_customer_user_id is null) <> (created_by_sales_user_id is null)',
  });
  pgm.createIndex('orders', 'created_by_sales_user_id');
};

exports.down = (pgm) => {
  pgm.dropIndex('orders', 'created_by_sales_user_id');
  pgm.dropConstraint('orders', 'orders_exactly_one_creator_check');
  pgm.dropColumn('orders', 'created_by_sales_user_id');
  pgm.alterColumn('orders', 'created_by_customer_user_id', { notNull: true });
  pgm.sql("delete from application_settings where key in ('allow_hader_contract_order_creation', 'allow_dispatch_contract_order_creation');");
  pgm.dropConstraint('application_settings', 'application_settings_contract_order_creation_value_check');
  pgm.dropConstraint('application_settings', 'application_settings_known_key_check');
  pgm.addConstraint('application_settings', 'application_settings_known_key_check', {
    check: "key in ('LIST_PRICE_DIRECT_ORDER_APPROVAL')",
  });
};
