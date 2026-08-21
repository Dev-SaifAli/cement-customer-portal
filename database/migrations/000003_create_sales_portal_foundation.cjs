const applicationStatusCheck =
  "status in ('DRAFT', 'PENDING_SALES_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'ACTIVATED')";

exports.up = (pgm) => {
  pgm.createTable('sales_users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'text',
      notNull: true,
    },
    email: {
      type: 'text',
      notNull: true,
      check: 'email = lower(email)',
    },
    password_hash: {
      type: 'text',
      notNull: true,
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

  pgm.createIndex('sales_users', 'email', {
    name: 'sales_users_email_unique',
    unique: true,
  });

  pgm.createTable('application_status_events', {
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
    previous_status: {
      type: 'text',
      check: applicationStatusCheck.replaceAll('status', 'previous_status'),
    },
    new_status: {
      type: 'text',
      notNull: true,
      check: applicationStatusCheck.replaceAll('status', 'new_status'),
    },
    reason: {
      type: 'text',
    },
    changed_by: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('application_status_events', 'registration_id');
  pgm.createIndex('application_status_events', 'created_at');
  pgm.createIndex('application_status_events', 'changed_by');
};

exports.down = (pgm) => {
  pgm.dropTable('application_status_events');
  pgm.dropTable('sales_users');
};
