exports.up = (pgm) => {
  pgm.createTable('contract_items', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    contract_id: {
      type: 'uuid',
      notNull: true,
      references: 'contracts(id)',
      onDelete: 'CASCADE',
    },
    source_quotation_item_id: {
      type: 'uuid',
      references: 'customer_quotation_items(id)',
      onDelete: 'RESTRICT',
    },
    product_id: {
      type: 'uuid',
      notNull: true,
      references: 'product_catalog(id)',
      onDelete: 'RESTRICT',
    },
    product_code: {
      type: 'text',
      notNull: true,
    },
    product_name: {
      type: 'text',
      notNull: true,
    },
    packaging: {
      type: 'text',
      notNull: true,
    },
    original_uom: {
      type: 'text',
      notNull: true,
    },
    original_quantity: {
      type: 'numeric(14, 3)',
      notNull: true,
    },
    equivalent_tons: {
      type: 'numeric(14, 6)',
      notNull: true,
    },
    approved_product_price_per_ton: {
      type: 'numeric(14, 2)',
      notNull: true,
    },
    discount_mode: {
      type: 'text',
      check: "discount_mode in ('PERCENT', 'SAR_PER_TON')",
    },
    discount_value: {
      type: 'numeric(14, 4)',
    },
    discount_amount_per_ton: {
      type: 'numeric(14, 2)',
    },
    hader_delivery_price_per_ton: {
      type: 'numeric(14, 2)',
    },
    approved_customer_rate_per_ton: {
      type: 'numeric(14, 2)',
      notNull: true,
    },
    amount: {
      type: 'numeric(16, 2)',
      notNull: true,
    },
    display_order: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createTable('contract_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    contract_id: {
      type: 'uuid',
      notNull: true,
      references: 'contracts(id)',
      onDelete: 'CASCADE',
    },
    event_type: {
      type: 'text',
      notNull: true,
    },
    previous_status: {
      type: 'text',
    },
    new_status: {
      type: 'text',
    },
    reason: {
      type: 'text',
    },
    changed_by_sales_user_id: {
      type: 'uuid',
      references: 'sales_users(id)',
      onDelete: 'RESTRICT',
    },
    changed_by_customer_user_id: {
      type: 'uuid',
      references: 'customer_users(id)',
      onDelete: 'RESTRICT',
    },
    event_data: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('contract_items', 'contract_items_contract_display_order_unique', {
    unique: ['contract_id', 'display_order'],
  });
  pgm.createIndex('contract_items', 'contract_id');
  pgm.createIndex('contract_items', 'product_id');
  pgm.createIndex('contract_items', 'source_quotation_item_id');
  pgm.createIndex('contract_events', 'contract_id');
  pgm.createIndex('contract_events', 'event_type');
  pgm.createIndex('contract_events', 'changed_by_sales_user_id');
  pgm.createIndex('contract_events', 'changed_by_customer_user_id');
  pgm.createIndex('contract_events', 'created_at');

  pgm.sql(`
    insert into contract_items (
      contract_id,
      source_quotation_item_id,
      product_id,
      product_code,
      product_name,
      packaging,
      original_uom,
      original_quantity,
      equivalent_tons,
      approved_product_price_per_ton,
      discount_mode,
      discount_value,
      discount_amount_per_ton,
      hader_delivery_price_per_ton,
      approved_customer_rate_per_ton,
      amount,
      display_order
    )
    select
      contracts.id,
      nullif(item.value->>'quotationItemId', '')::uuid,
      (item.value->>'productId')::uuid,
      coalesce(item.value->>'productCode', ''),
      coalesce(item.value->>'productName', ''),
      coalesce(item.value->>'packagingType', contracts.packaging),
      coalesce(item.value->>'uom', contracts.uom),
      coalesce(nullif(item.value->>'quantity', '')::numeric, contracts.quantity),
      coalesce(nullif(item.value->>'equivalentTons', '')::numeric, contracts.total_quantity_tons, contracts.quantity),
      coalesce(nullif(item.value->>'productPrice', '')::numeric, contracts.product_price),
      nullif(item.value->>'discountMode', ''),
      nullif(item.value->>'discountValue', '')::numeric,
      nullif(item.value->>'discountAmountPerTon', '')::numeric,
      nullif(item.value->>'deliveryPrice', '')::numeric,
      coalesce(nullif(item.value->>'customerRate', '')::numeric, contracts.product_price + coalesce(contracts.delivery_price, 0)),
      coalesce(nullif(item.value->>'amount', '')::numeric, contracts.grand_total, 0),
      coalesce(nullif(item.value->>'displayOrder', '')::integer, item.ordinality::integer - 1)
    from contracts
    cross join lateral jsonb_array_elements(contracts.items_snapshot) with ordinality as item(value, ordinality)
    where contracts.items_snapshot is not null
      and jsonb_typeof(contracts.items_snapshot) = 'array'
      and item.value ? 'productId'
    on conflict do nothing;
  `);

  pgm.sql(`
    insert into contract_events (
      contract_id,
      event_type,
      previous_status,
      new_status,
      reason,
      changed_by_sales_user_id,
      event_data,
      created_at
    )
    select
      contract_status_events.contract_id,
      contract_status_events.action,
      contract_status_events.previous_status,
      contract_status_events.new_status,
      contract_status_events.reason,
      contract_status_events.changed_by,
      jsonb_build_object('source', 'contract_status_events'),
      contract_status_events.created_at
    from contract_status_events
    on conflict do nothing;
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('contract_events');
  pgm.dropTable('contract_items');
};
