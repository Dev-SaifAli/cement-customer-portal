exports.up = (pgm) => {
  pgm.createTable('customer_accounts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    registration_id: {
      type: 'uuid',
      notNull: true,
      references: 'registration_drafts(id)',
      onDelete: 'RESTRICT',
    },
    company_name: {
      type: 'text',
      notNull: true,
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'ACTIVE',
      check: "status in ('ACTIVE', 'INACTIVE')",
    },
    activated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
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

  pgm.createTable('customer_users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'RESTRICT',
    },
    name: {
      type: 'text',
      notNull: true,
    },
    email: {
      type: 'text',
      notNull: true,
    },
    password_hash: {
      type: 'text',
      notNull: true,
    },
    role: {
      type: 'text',
      notNull: true,
      default: 'CUSTOMER_ADMIN',
      check: "role in ('CUSTOMER_ADMIN')",
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  pgm.createIndex('customer_accounts', 'registration_id', {
    name: 'customer_accounts_registration_id_unique',
    unique: true,
  });
  pgm.createIndex('customer_accounts', 'status');
  pgm.createIndex('customer_users', 'customer_account_id');
  pgm.createIndex('customer_users', 'email', {
    name: 'customer_users_email_unique',
    unique: true,
  });
};

exports.down = (pgm) => {
  pgm.dropTable('customer_users');
  pgm.dropTable('customer_accounts');
};
