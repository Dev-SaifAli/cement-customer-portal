exports.up = (pgm) => {
  pgm.addColumns('customer_users', {
    phone: {
      type: 'text',
    },
    password_must_change: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });

  pgm.addConstraint(
    'customer_users',
    'customer_users_phone_format_check',
    "check (phone is null or phone ~ '^\\+9665[0-9]{8}$')",
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint('customer_users', 'customer_users_phone_format_check');
  pgm.dropColumns('customer_users', ['phone', 'password_must_change']);
};
