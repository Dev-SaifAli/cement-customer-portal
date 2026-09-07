exports.up = (pgm) => {
  pgm.addColumns('contracts', {
    source_document_type: {
      type: 'text',
      check: "source_document_type in ('DIRECT_ORDER', 'RFQ')",
    },
    source_document_number: {
      type: 'text',
    },
    source_direct_order_id: {
      type: 'uuid',
      references: 'orders(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.sql(`
    update contracts c
    set source_document_type = 'RFQ',
        source_document_number = coalesce(c.quotation_reference, q.reference)
    from customer_quotations q
    where c.quotation_id = q.id
      and c.source_document_type is null
      and coalesce(c.quotation_reference, q.reference) is not null;
  `);

  pgm.addConstraint('contracts', 'contracts_source_document_required_check', {
    check:
      "(source_document_type is null and source_document_number is null) or (source_document_type is not null and source_document_number is not null)",
  });
  pgm.addConstraint('contracts', 'contracts_single_source_document_check', {
    check:
      "(source_document_type = 'RFQ' and quotation_id is not null and source_direct_order_id is null) or (source_document_type = 'DIRECT_ORDER' and source_direct_order_id is not null and quotation_id is null) or (source_document_type is null and quotation_id is null and source_direct_order_id is null)",
  });
  pgm.addConstraint('contracts', 'contracts_source_direct_order_id_unique', {
    unique: ['source_direct_order_id'],
  });

  pgm.createIndex('contracts', 'source_document_type');
  pgm.createIndex('contracts', 'source_document_number');
  pgm.createIndex('contracts', 'source_direct_order_id');

  pgm.createTable('contract_shipment_number_counters', {
    contract_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'contracts(id)',
      onDelete: 'CASCADE',
    },
    last_suffix: {
      type: 'integer',
      notNull: true,
      check: 'last_suffix > 0',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.sql(`
    insert into contract_shipment_number_counters (contract_id, last_suffix)
    select contract_id, max(suffix)::integer
    from (
      select
        orders.contract_id,
        nullif(substring(shipments.shipment_number from '_([0-9]+)$'), '')::integer as suffix
      from shipments
      inner join orders on orders.id = shipments.order_id
      where orders.contract_id is not null
    ) numbered_shipments
    where suffix is not null
    group by contract_id
    on conflict (contract_id) do update
      set last_suffix = greatest(
            contract_shipment_number_counters.last_suffix,
            excluded.last_suffix
          ),
          updated_at = now();
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('contract_shipment_number_counters');
  pgm.dropIndex('contracts', 'source_direct_order_id');
  pgm.dropIndex('contracts', 'source_document_number');
  pgm.dropIndex('contracts', 'source_document_type');
  pgm.dropConstraint('contracts', 'contracts_source_direct_order_id_unique');
  pgm.dropConstraint('contracts', 'contracts_single_source_document_check');
  pgm.dropConstraint('contracts', 'contracts_source_document_required_check');
  pgm.dropColumns('contracts', [
    'source_document_type',
    'source_document_number',
    'source_direct_order_id',
  ]);
};
