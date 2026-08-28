exports.up = (pgm) => {
  pgm.addColumn('transporter_costs', {
    created_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.sql(`update transporter_costs
    set created_by_sales_user_id = updated_by_sales_user_id
    where created_by_sales_user_id is null;`);

  pgm.alterColumn('transporter_costs', 'created_by_sales_user_id', { notNull: true });
};

exports.down = (pgm) => {
  pgm.dropColumn('transporter_costs', 'created_by_sales_user_id');
};
