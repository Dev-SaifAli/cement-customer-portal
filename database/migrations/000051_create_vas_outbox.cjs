exports.up = (pgm) => {
  pgm.createTable('vas_outbox', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      references: 'orders(id)',
      onDelete: 'RESTRICT',
    },
    event_type: { type: 'text', notNull: true },
    payload_snapshot: { type: 'jsonb', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      default: 'PENDING',
      check: "status in ('PENDING','PROCESSING','SUCCEEDED','FAILED','VALIDATION_FAILED')",
    },
    attempt_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      check: 'attempt_count >= 0',
    },
    last_attempt_at: { type: 'timestamptz' },
    last_error: { type: 'text' },
    error_category: {
      type: 'text',
      check:
        "error_category is null or error_category in ('TIMEOUT','TRANSIENT','AUTHENTICATION','VALIDATION','BUSINESS','UNKNOWN')",
    },
    external_reference: { type: 'text' },
    correlation_key: { type: 'text', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('vas_outbox', ['status', 'created_at']);
  pgm.createIndex('vas_outbox', ['order_id', 'event_type']);
};

exports.down = (pgm) => {
  pgm.dropTable('vas_outbox');
};
