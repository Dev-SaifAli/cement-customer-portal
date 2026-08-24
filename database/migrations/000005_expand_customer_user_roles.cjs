exports.up = (pgm) => {
  pgm.dropConstraint('customer_users', 'customer_users_role_check');
  pgm.addConstraint(
    'customer_users',
    'customer_users_role_check',
    "check (role in ('CUSTOMER_ADMIN', 'PURCHASER', 'FINANCE_USER', 'VIEWER'))",
  );
};

exports.down = (pgm) => {
  pgm.sql("update customer_users set role = 'CUSTOMER_ADMIN' where role <> 'CUSTOMER_ADMIN'");
  pgm.dropConstraint('customer_users', 'customer_users_role_check');
  pgm.addConstraint(
    'customer_users',
    'customer_users_role_check',
    "check (role in ('CUSTOMER_ADMIN'))",
  );
};
