exports.up = (pgm) => {
  pgm.addColumns('hader_loading_points', {
    created_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.dropConstraint('hader_loading_points', 'hader_loading_points_status_check');
  pgm.sql("update hader_loading_points set status='AVAILABLE' where status='FREE'");
  pgm.addConstraint('hader_loading_points', 'hader_loading_points_status_check', {
    check: "status in ('AVAILABLE','BUSY','FULL','INACTIVE')",
  });
  pgm.createIndex('hader_loading_points', ['product_id', 'point_type', 'status'], {
    name: 'hader_loading_points_product_availability_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('hader_loading_points', ['product_id', 'point_type', 'status'], {
    name: 'hader_loading_points_product_availability_idx',
  });
  pgm.dropConstraint('hader_loading_points', 'hader_loading_points_status_check');
  pgm.sql("update hader_loading_points set status='FREE' where status='AVAILABLE'");
  pgm.addConstraint('hader_loading_points', 'hader_loading_points_status_check', {
    check: "status in ('FREE','BUSY','FULL','INACTIVE')",
  });
  pgm.dropColumns('hader_loading_points', ['created_by_sales_user_id']);
};
