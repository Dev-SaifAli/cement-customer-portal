exports.up = (pgm) => {
  pgm.addColumns('hader_loading_points', {
    capacity_ton_per_hour: {
      type: 'numeric(14,3)',
      check: 'capacity_ton_per_hour is null or capacity_ton_per_hour > 0',
    },
    max_trucks: {
      type: 'integer',
      notNull: true,
      default: 1,
      check: 'max_trucks >= 1',
    },
  });

  // Preserve existing Bagging Line configuration while giving it the correct
  // operational meaning. Silo capacity_ton remains unchanged.
  pgm.sql(`
    update hader_loading_points
    set capacity_ton_per_hour = capacity_ton
    where point_type = 'BAGGING_LINE'
      and capacity_ton_per_hour is null
      and capacity_ton > 0;

    drop index if exists shipments_active_loading_point_unique;
    create index shipments_active_loading_point_idx
      on shipments (loading_point_id, loading_status)
      where loading_point_id is not null
        and loading_status in ('AT_GATE','LOADING');
  `);
};

exports.down = (pgm) => {
  pgm.sql('drop index if exists shipments_active_loading_point_idx');
  pgm.sql(`
    create unique index shipments_active_loading_point_unique
      on shipments (loading_point_id)
      where loading_point_id is not null and loading_status='LOADING';
  `);
  pgm.dropColumns('hader_loading_points', ['capacity_ton_per_hour', 'max_trucks']);
};
