exports.up = (pgm) => {
  pgm.addColumns('ksa_cities', {
    delivery_boundary: { type: 'jsonb' },
    boundary_updated_at: { type: 'timestamptz' },
    boundary_updated_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'SET NULL',
    },
  });

  pgm.addConstraint('ksa_cities', 'ksa_cities_delivery_boundary_geojson_check', {
    check:
      "delivery_boundary is null or (delivery_boundary->>'type' = 'Polygon' and jsonb_typeof(delivery_boundary->'coordinates') = 'array')",
  });

  pgm.addColumns('orders', {
    hader_zone_status: { type: 'text' },
  });
  pgm.addConstraint('orders', 'orders_hader_zone_status_check', {
    check:
      "hader_zone_status is null or hader_zone_status in ('WITHIN_HADER_ZONE', 'OUTSIDE_HADER_ZONE')",
  });

  pgm.addColumns('delivery_requests', {
    hader_zone_status: { type: 'text' },
  });
  pgm.addConstraint('delivery_requests', 'delivery_requests_hader_zone_status_check', {
    check:
      "hader_zone_status is null or hader_zone_status in ('WITHIN_HADER_ZONE', 'OUTSIDE_HADER_ZONE')",
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('delivery_requests', ['hader_zone_status']);
  pgm.dropColumns('orders', ['hader_zone_status']);
  pgm.dropColumns('ksa_cities', [
    'delivery_boundary',
    'boundary_updated_at',
    'boundary_updated_by_sales_user_id',
  ]);
};
