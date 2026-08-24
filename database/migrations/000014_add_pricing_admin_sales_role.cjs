exports.up = (pgm) => {
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check: "role in ('SALES_REP', 'HADER_MANAGER', 'PRICE_MANAGER', 'PRICING_ADMIN')",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check: "role in ('SALES_REP', 'HADER_MANAGER', 'PRICE_MANAGER')",
  });
};
