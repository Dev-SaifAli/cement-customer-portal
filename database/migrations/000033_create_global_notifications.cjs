exports.up = (pgm) => {
  pgm.createTable('notifications', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    recipient_kind: { type: 'varchar(20)', notNull: true },
    recipient_user_id: { type: 'uuid', notNull: true },
    type: { type: 'varchar(80)', notNull: true },
    title: { type: 'varchar(180)', notNull: true },
    message: { type: 'text', notNull: true },
    entity_type: { type: 'varchar(60)', notNull: true },
    entity_id: { type: 'uuid' },
    action_url: { type: 'text' },
    event_key: { type: 'varchar(220)', notNull: true },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('notifications', 'notifications_recipient_kind_check', {
    check: "recipient_kind in ('CUSTOMER', 'SALES')",
  });
  pgm.addConstraint('notifications', 'notifications_recipient_event_unique', {
    unique: ['recipient_kind', 'recipient_user_id', 'event_key'],
  });
  pgm.createIndex('notifications', ['recipient_kind', 'recipient_user_id', 'created_at']);
  pgm.createIndex('notifications', ['recipient_kind', 'recipient_user_id', 'read_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('notifications');
};
