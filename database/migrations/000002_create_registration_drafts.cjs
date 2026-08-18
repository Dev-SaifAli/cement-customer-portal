exports.up = (pgm) => {
  pgm.createTable('registration_drafts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    reference: {
      type: 'text',
      unique: true,
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'DRAFT',
      check:
        "status in ('DRAFT', 'PENDING_SALES_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'ACTIVATED')",
    },
    current_step: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    company: {
      type: 'jsonb',
      notNull: true,
      default: '{}',
    },
    contact: {
      type: 'jsonb',
      notNull: true,
      default: '{}',
    },
    documents: {
      type: 'jsonb',
      notNull: true,
      default: '{}',
    },
    delivery_locations: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
    },
    administrator: {
      type: 'jsonb',
      notNull: true,
      default: '{}',
    },
    admin_password_hash: {
      type: 'text',
    },
    submitted_at: {
      type: 'timestamptz',
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

  pgm.createIndex('registration_drafts', 'reference');
  pgm.createIndex('registration_drafts', 'status');
};

exports.down = (pgm) => {
  pgm.dropTable('registration_drafts');
};
