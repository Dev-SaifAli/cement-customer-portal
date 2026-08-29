exports.up = (pgm) => {
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check:
      "role in ('SALES_REP','HADER_MANAGER','HADER_OPERATIONS','DISPATCH_USER','LOADING_USER','PRICE_MANAGER','PRICING_ADMIN')",
  });
  pgm.createTable('hader_loading_points', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    point_type: { type: 'text', notNull: true, check: "point_type in ('SILO','BAGGING_LINE')" },
    product_id: { type: 'uuid', references: 'product_catalog(id)', onDelete: 'RESTRICT' },
    capacity_ton: { type: 'numeric(14,3)', check: 'capacity_ton is null or capacity_ton > 0' },
    status: {
      type: 'text',
      notNull: true,
      default: 'FREE',
      check: "status in ('FREE','BUSY','FULL','INACTIVE')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addColumns('shipments', {
    loading_status: {
      type: 'text',
      check:
        "loading_status is null or loading_status in ('WAITING','NOTIFIED','AT_GATE','LOADING','LOADED')",
    },
    loading_point_id: {
      type: 'uuid',
      references: 'hader_loading_points(id)',
      onDelete: 'RESTRICT',
    },
    loading_point_type: { type: 'text' },
    queue_position: { type: 'integer', check: 'queue_position is null or queue_position > 0' },
    notified_at: { type: 'timestamptz' },
    arrived_at: { type: 'timestamptz' },
    at_gate_at: { type: 'timestamptz' },
    loading_started_at: { type: 'timestamptz' },
    loading_completed_at: { type: 'timestamptz' },
    loading_started_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    loading_completed_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.sql(`
    with ranked as (
      select s.id,row_number() over (partition by oi.product_id order by coalesce(s.assigned_at,s.created_at),s.id) pos
      from shipments s join order_items oi on oi.order_id=s.order_id
      where s.status='ASSIGNED'
    )
    update shipments s set loading_status='WAITING',queue_position=ranked.pos
    from ranked where ranked.id=s.id;
    create unique index shipments_active_loading_point_unique on shipments (loading_point_id)
      where loading_point_id is not null and loading_status='LOADING';
  `);
  pgm.createIndex('shipments', ['loading_status', 'queue_position']);
  pgm.createIndex('hader_loading_points', ['point_type', 'status']);
};

exports.down = (pgm) => {
  pgm.dropIndex('hader_loading_points', ['point_type', 'status']);
  pgm.dropIndex('shipments', ['loading_status', 'queue_position']);
  pgm.sql('drop index if exists shipments_active_loading_point_unique');
  pgm.dropColumns('shipments', [
    'loading_status',
    'loading_point_id',
    'loading_point_type',
    'queue_position',
    'notified_at',
    'arrived_at',
    'at_gate_at',
    'loading_started_at',
    'loading_completed_at',
    'loading_started_by_sales_user_id',
    'loading_completed_by_sales_user_id',
  ]);
  pgm.dropTable('hader_loading_points');
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check:
      "role in ('SALES_REP','HADER_MANAGER','HADER_OPERATIONS','DISPATCH_USER','PRICE_MANAGER','PRICING_ADMIN')",
  });
};
