exports.up = (pgm) => {
  pgm.addColumns('shipments', {
    hader_truck_id: {
      type: 'uuid',
      references: 'hader_trucks(id)',
      onDelete: 'RESTRICT',
    },
    hader_driver_id: {
      type: 'uuid',
      references: 'hader_drivers(id)',
      onDelete: 'RESTRICT',
    },
    assigned_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    assigned_at: { type: 'timestamptz' },
    scheduled_time: { type: 'time' },
    dispatched_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    dispatched_at: { type: 'timestamptz' },
  });
  pgm.addColumn('shipment_events', {
    event_data: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
  });
  pgm.createIndex('shipments', 'transporter_id');
  pgm.createIndex('shipments', 'hader_truck_id');
  pgm.createIndex('shipments', 'hader_driver_id');
  pgm.sql(`
    create unique index shipments_active_hader_truck_unique
      on shipments (hader_truck_id)
      where hader_truck_id is not null
        and status in ('ASSIGNED','LOADING','DISPATCHED','IN_TRANSIT');
    create unique index shipments_active_hader_driver_unique
      on shipments (hader_driver_id)
      where hader_driver_id is not null
        and status in ('ASSIGNED','LOADING','DISPATCHED','IN_TRANSIT');
  `);
};

exports.down = (pgm) => {
  pgm.sql('drop index if exists shipments_active_hader_driver_unique');
  pgm.sql('drop index if exists shipments_active_hader_truck_unique');
  pgm.dropIndex('shipments', 'hader_driver_id');
  pgm.dropIndex('shipments', 'hader_truck_id');
  pgm.dropIndex('shipments', 'transporter_id');
  pgm.dropColumn('shipment_events', 'event_data');
  pgm.dropColumns('shipments', [
    'hader_truck_id',
    'hader_driver_id',
    'assigned_by_sales_user_id',
    'assigned_at',
    'scheduled_time',
    'dispatched_by_sales_user_id',
    'dispatched_at',
  ]);
};
