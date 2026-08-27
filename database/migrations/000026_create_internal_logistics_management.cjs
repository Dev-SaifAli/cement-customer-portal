exports.up = (pgm) => {
  pgm.createSequence('transporter_number_seq', { ifNotExists: true });
  pgm.createSequence('hader_truck_number_seq', { ifNotExists: true });
  pgm.createSequence('hader_driver_number_seq', { ifNotExists: true });

  pgm.createTable('transporters', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    transporter_number: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    company_name: { type: 'text', notNull: true },
    contact_person: { type: 'text' },
    phone: { type: 'text', notNull: true },
    email: { type: 'text' },
    cr_number: { type: 'text' },
    status: {
      type: 'text',
      notNull: true,
      default: 'ACTIVE',
      check: "status in ('ACTIVE','INACTIVE')",
    },
    created_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.sql(`create unique index transporters_name_company_unique
    on transporters (lower(name), lower(company_name));`);

  pgm.createTable('transporter_costs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    transporter_id: {
      type: 'uuid',
      notNull: true,
      references: 'transporters(id)',
      onDelete: 'RESTRICT',
    },
    hader_city_id: {
      type: 'uuid',
      notNull: true,
      references: 'ksa_cities(id)',
      onDelete: 'RESTRICT',
    },
    cement_type: {
      type: 'text',
      notNull: true,
      check: "cement_type in ('STANDARD_CEMENT','WHITE_CEMENT')",
    },
    cost_per_ton: { type: 'numeric(14,2)', notNull: true, check: 'cost_per_ton >= 0' },
    updated_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('transporter_costs', 'transporter_costs_scope_unique', {
    unique: ['transporter_id', 'hader_city_id', 'cement_type'],
  });

  pgm.createTable('hader_drivers', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    driver_number: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    mobile: { type: 'text', notNull: true },
    license_number: { type: 'text', notNull: true, unique: true },
    license_expiry: { type: 'date' },
    status: {
      type: 'text',
      notNull: true,
      default: 'ACTIVE',
      check: "status in ('ACTIVE','INACTIVE')",
    },
    created_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('hader_trucks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    truck_number: { type: 'text', notNull: true, unique: true },
    plate_number: { type: 'text', notNull: true, unique: true },
    vehicle_type: { type: 'text', notNull: true },
    capacity_ton: { type: 'numeric(12,3)', notNull: true, check: 'capacity_ton > 0' },
    model_year: { type: 'integer', check: 'model_year between 1950 and 2200' },
    assigned_driver_id: { type: 'uuid', references: 'hader_drivers(id)', onDelete: 'SET NULL' },
    status: {
      type: 'text',
      notNull: true,
      default: 'AVAILABLE',
      check: "status in ('AVAILABLE','ASSIGNED','MAINTENANCE','INACTIVE')",
    },
    created_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('internal_logistics_attachments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    entity_type: {
      type: 'text',
      notNull: true,
      check: "entity_type in ('TRANSPORTER','TRUCK','DRIVER')",
    },
    entity_id: { type: 'uuid', notNull: true },
    document_type: { type: 'text', notNull: true },
    original_file_name: { type: 'text', notNull: true },
    storage_key: { type: 'text', notNull: true, unique: true },
    mime_type: { type: 'text', notNull: true },
    file_size: { type: 'integer', notNull: true, check: 'file_size > 0' },
    uploaded_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('internal_logistics_attachments', 'internal_logistics_attachment_unique', {
    unique: ['entity_type', 'entity_id', 'document_type'],
  });

  pgm.createTable('internal_logistics_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    entity_type: { type: 'text', notNull: true },
    entity_id: { type: 'uuid', notNull: true },
    event_type: { type: 'text', notNull: true },
    changed_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    old_value: { type: 'jsonb' },
    new_value: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('transporters', ['status', 'created_at']);
  pgm.createIndex('transporter_costs', ['hader_city_id', 'cement_type']);
  pgm.createIndex('hader_trucks', ['status', 'created_at']);
  pgm.createIndex('hader_drivers', ['status', 'created_at']);
  pgm.createIndex('internal_logistics_attachments', ['entity_type', 'entity_id']);
  pgm.createIndex('internal_logistics_events', ['entity_type', 'entity_id', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('internal_logistics_events');
  pgm.dropTable('internal_logistics_attachments');
  pgm.dropTable('hader_trucks');
  pgm.dropTable('hader_drivers');
  pgm.dropTable('transporter_costs');
  pgm.dropTable('transporters');
  pgm.dropSequence('hader_driver_number_seq', { ifExists: true });
  pgm.dropSequence('hader_truck_number_seq', { ifExists: true });
  pgm.dropSequence('transporter_number_seq', { ifExists: true });
};
