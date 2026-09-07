exports.up = (pgm) => {
  pgm.createTable('application_settings', {
    key: {
      type: 'text',
      primaryKey: true,
    },
    value: {
      type: 'text',
      notNull: true,
    },
    updated_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'SET NULL',
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

  pgm.addConstraint('application_settings', 'application_settings_known_key_check', {
    check: "key in ('LIST_PRICE_DIRECT_ORDER_APPROVAL')",
  });
  pgm.addConstraint(
    'application_settings',
    'application_settings_list_price_direct_order_approval_value_check',
    {
      check:
        "key <> 'LIST_PRICE_DIRECT_ORDER_APPROVAL' or value in ('AUTO_APPROVE', 'MUST_APPROVE')",
    },
  );

  pgm.sql(`
    insert into application_settings (key, value)
    values ('LIST_PRICE_DIRECT_ORDER_APPROVAL', 'AUTO_APPROVE')
    on conflict (key) do nothing;
  `);

  pgm.alterColumn('contracts', 'sales_user_id', {
    notNull: false,
  });
};

exports.down = (pgm) => {
  pgm.sql(`
    delete from contracts
    where sales_user_id is null;
  `);
  pgm.alterColumn('contracts', 'sales_user_id', {
    notNull: true,
  });
  pgm.dropTable('application_settings');
};
