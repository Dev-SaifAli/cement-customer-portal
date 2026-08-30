exports.up = (pgm) => {
  pgm.createSequence('pickup_location_number_seq');
  pgm.createTable('pickup_locations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    location_number: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    city_id: { type: 'uuid', notNull: true, references: 'ksa_cities(id)', onDelete: 'RESTRICT' },
    address: { type: 'text', notNull: true },
    postal_code: { type: 'text' },
    latitude: { type: 'numeric(10,7)' },
    longitude: { type: 'numeric(10,7)' },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    created_by_sales_user_id: { type: 'uuid', notNull: true, references: 'sales_users(id)', onDelete: 'RESTRICT' },
    updated_by_sales_user_id: { type: 'uuid', notNull: true, references: 'sales_users(id)', onDelete: 'RESTRICT' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('pickup_locations', 'pickup_locations_status_check', {
    check: "status in ('ACTIVE','INACTIVE')",
  });
  pgm.addConstraint('pickup_locations', 'pickup_locations_coordinates_check', {
    check: '(latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180)',
  });
  pgm.createIndex('pickup_locations', ['status', 'city_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('pickup_locations');
  pgm.dropSequence('pickup_location_number_seq');
};
