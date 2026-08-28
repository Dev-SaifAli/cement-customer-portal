exports.up = (pgm) => {
  pgm.alterColumn('orders', 'contract_id', {
    type: 'uuid',
    notNull: false,
    references: 'contracts(id)',
    onDelete: 'RESTRICT',
  });

  pgm.alterColumn('orders', 'remaining_contract_quantity_snapshot', {
    type: 'numeric(14, 3)',
    notNull: false,
    check: 'remaining_contract_quantity_snapshot >= 0',
  });
};

exports.down = (pgm) => {
  pgm.sql(`
    delete from orders
    where contract_id is null;
  `);
  pgm.alterColumn('orders', 'remaining_contract_quantity_snapshot', {
    type: 'numeric(14, 3)',
    notNull: true,
    check: 'remaining_contract_quantity_snapshot >= 0',
  });
  pgm.alterColumn('orders', 'contract_id', {
    type: 'uuid',
    notNull: true,
    references: 'contracts(id)',
    onDelete: 'RESTRICT',
  });
};
