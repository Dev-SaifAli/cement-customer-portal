exports.up = (pgm) => {
  pgm.createTable('password_reset_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_type: {
      type: 'text',
      notNull: true,
      check: "user_type in ('CUSTOMER', 'SALES')",
    },
    customer_user_id: {
      type: 'uuid',
      references: 'customer_users(id)',
      onDelete: 'CASCADE',
    },
    sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'CASCADE',
    },
    token_hash: {
      type: 'text',
      notNull: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    used_at: {
      type: 'timestamptz',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('password_reset_tokens', 'password_reset_tokens_identity_check', {
    check: `(
      user_type = 'CUSTOMER'
      and customer_user_id is not null
      and sales_user_id is null
    ) or (
      user_type = 'SALES'
      and sales_user_id is not null
      and customer_user_id is null
    )`,
  });

  pgm.createIndex('password_reset_tokens', 'token_hash', {
    name: 'password_reset_tokens_token_hash_unique',
    unique: true,
  });
  pgm.createIndex('password_reset_tokens', 'customer_user_id');
  pgm.createIndex('password_reset_tokens', 'sales_user_id');
  pgm.createIndex('password_reset_tokens', 'expires_at');
};

exports.down = (pgm) => {
  pgm.dropTable('password_reset_tokens');
};
