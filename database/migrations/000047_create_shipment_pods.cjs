exports.up = (pgm) => {
  pgm.createTable('shipment_pods', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    shipment_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'shipments(id)',
      onDelete: 'RESTRICT',
    },
    receiver_name: { type: 'text', notNull: true },
    delivered_quantity_ton: {
      type: 'numeric(14,3)',
      notNull: true,
      check: 'delivered_quantity_ton > 0',
    },
    delivery_time: { type: 'timestamptz', notNull: true },
    latitude: { type: 'numeric(10,7)' },
    longitude: { type: 'numeric(10,7)' },
    evidence_notes: { type: 'text' },
    created_by_sales_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('shipment_pods', 'shipment_pods_location_pair_check', {
    check:
      '(latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180)',
  });

  pgm.createTable('shipment_pod_documents', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    pod_id: {
      type: 'uuid',
      notNull: true,
      references: 'shipment_pods(id)',
      onDelete: 'CASCADE',
    },
    document_type: {
      type: 'text',
      notNull: true,
      check: "document_type in ('DELIVERY_PHOTO','SIGNED_POD')",
    },
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
  pgm.addConstraint('shipment_pod_documents', 'shipment_pod_document_type_unique', {
    unique: ['pod_id', 'document_type'],
  });
  pgm.createIndex('shipment_pod_documents', 'pod_id');
};

exports.down = (pgm) => {
  pgm.dropTable('shipment_pod_documents');
  pgm.dropTable('shipment_pods');
};
