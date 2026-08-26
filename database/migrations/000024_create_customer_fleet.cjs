const fleetStatusCheck = "status in ('ACTIVE', 'INACTIVE')";

exports.up = (pgm) => {
  pgm.createSequence('customer_truck_number_seq', { ifNotExists: true });
  pgm.createSequence('customer_driver_number_seq', { ifNotExists: true });

  pgm.createTable('customer_trucks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'CASCADE',
    },
    truck_number: { type: 'text', notNull: true, unique: true },
    plate_number: { type: 'text', notNull: true },
    vehicle_type: { type: 'text', notNull: true },
    capacity_ton: { type: 'numeric(10, 3)', notNull: true, check: 'capacity_ton > 0' },
    carrier_name: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'ACTIVE', check: fleetStatusCheck },
    created_by_customer_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('customer_drivers', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'CASCADE',
    },
    driver_number: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    mobile: { type: 'text', notNull: true },
    license_number: { type: 'text', notNull: true },
    license_expiry: { type: 'date' },
    status: { type: 'text', notNull: true, default: 'ACTIVE', check: fleetStatusCheck },
    created_by_customer_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('customer_fleet_attachments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'CASCADE',
    },
    entity_type: { type: 'text', notNull: true, check: "entity_type in ('TRUCK', 'DRIVER')" },
    entity_id: { type: 'uuid', notNull: true },
    document_type: { type: 'text', notNull: true },
    original_file_name: { type: 'text', notNull: true },
    storage_key: { type: 'text', notNull: true, unique: true },
    mime_type: { type: 'text', notNull: true },
    file_size: { type: 'integer', notNull: true, check: 'file_size > 0' },
    uploaded_by_customer_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('customer_fleet_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    customer_account_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_accounts(id)',
      onDelete: 'CASCADE',
    },
    entity_type: { type: 'text', notNull: true, check: "entity_type in ('TRUCK', 'DRIVER')" },
    entity_id: { type: 'uuid', notNull: true },
    event_type: { type: 'text', notNull: true },
    changed_by_customer_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    event_data: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('customer_trucks', 'customer_trucks_account_plate_unique', {
    unique: ['customer_account_id', 'plate_number'],
  });
  pgm.addConstraint('customer_drivers', 'customer_drivers_account_license_unique', {
    unique: ['customer_account_id', 'license_number'],
  });
  pgm.addConstraint('customer_fleet_attachments', 'customer_fleet_attachment_type_unique', {
    unique: ['customer_account_id', 'entity_type', 'entity_id', 'document_type'],
  });
  pgm.createIndex('customer_trucks', ['customer_account_id', 'status']);
  pgm.createIndex('customer_drivers', ['customer_account_id', 'status']);
  pgm.createIndex('customer_fleet_attachments', [
    'customer_account_id',
    'entity_type',
    'entity_id',
  ]);
  pgm.createIndex('customer_fleet_events', ['customer_account_id', 'entity_type', 'entity_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('customer_fleet_events');
  pgm.dropTable('customer_fleet_attachments');
  pgm.dropTable('customer_drivers');
  pgm.dropTable('customer_trucks');
  pgm.dropSequence('customer_driver_number_seq', { ifExists: true });
  pgm.dropSequence('customer_truck_number_seq', { ifExists: true });
};
