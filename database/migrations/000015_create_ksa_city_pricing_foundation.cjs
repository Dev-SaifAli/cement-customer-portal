const seedCities = [
  'Jeddah',
  'Rabigh',
  'Makkah',
  'Riyadh',
  'Dammam',
  'Madinah',
  'Yanbu',
  'Taif',
  'Tabuk',
  'Abha',
  'Buraidah',
  'Hail',
];

exports.up = (pgm) => {
  pgm.createTable('ksa_cities', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    name_key: { type: 'text', notNull: true, unique: true },
    is_hader_enabled: { type: 'boolean', notNull: true, default: false },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('ksa_cities', ['is_active', 'is_hader_enabled']);

  for (const name of seedCities) {
    const escaped = name.replaceAll("'", "''");
    pgm.sql(
      `insert into ksa_cities (name, name_key) values ('${escaped}', lower('${escaped}')) on conflict (name_key) do nothing`,
    );
  }

  pgm.sql(`
    insert into ksa_cities (name, name_key)
    select distinct btrim(city), city_key
    from product_list_prices
    where btrim(city) <> ''
    on conflict (name_key) do nothing;

    insert into ksa_cities (name, name_key, is_hader_enabled)
    select distinct btrim(city), city_key, true
    from hader_delivery_prices
    where btrim(city) <> ''
    on conflict (name_key)
    do update set is_hader_enabled = true, updated_at = now();

    insert into ksa_cities (name, name_key)
    select distinct
      btrim(location->>'city'),
      lower(regexp_replace(btrim(location->>'city'), '\\s+', ' ', 'g'))
    from registration_drafts registrations
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(registrations.delivery_locations) = 'array'
          then registrations.delivery_locations
        else '[]'::jsonb
      end
    ) location
    where btrim(coalesce(location->>'city', '')) <> ''
    on conflict (name_key) do nothing;
  `);

  pgm.addColumns('product_list_prices', { city_id: { type: 'uuid' } });
  pgm.addColumns('hader_delivery_prices', { city_id: { type: 'uuid' } });

  pgm.sql(`
    update product_list_prices prices
    set city_id = cities.id
    from ksa_cities cities
    where cities.name_key = prices.city_key;

    update hader_delivery_prices prices
    set city_id = cities.id
    from ksa_cities cities
    where cities.name_key = prices.city_key;
  `);

  pgm.alterColumn('product_list_prices', 'city_id', { notNull: true });
  pgm.alterColumn('hader_delivery_prices', 'city_id', { notNull: true });
  pgm.addConstraint('product_list_prices', 'product_list_prices_city_id_fkey', {
    foreignKeys: {
      columns: 'city_id',
      references: 'ksa_cities(id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('hader_delivery_prices', 'hader_delivery_prices_city_id_fkey', {
    foreignKeys: {
      columns: 'city_id',
      references: 'ksa_cities(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.dropConstraint('product_list_prices', 'product_list_prices_scope_unique');
  pgm.addConstraint('product_list_prices', 'product_list_prices_scope_unique', {
    unique: ['product_id', 'city_id', 'packaging_key', 'uom'],
  });
  pgm.dropConstraint('hader_delivery_prices', 'hader_delivery_prices_scope_unique');
  pgm.addConstraint('hader_delivery_prices', 'hader_delivery_prices_scope_unique', {
    unique: ['city_id', 'uom'],
  });
  pgm.createIndex('product_list_prices', ['city_id', 'is_active']);
  pgm.createIndex('hader_delivery_prices', ['city_id', 'is_active']);

  pgm.addColumns('customer_quotations', {
    pricing_city_id: {
      type: 'uuid',
      references: 'ksa_cities(id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.createIndex('customer_quotations', 'pricing_city_id');

  pgm.sql(`
    update customer_quotations quotations
    set pricing_city_id = cities.id
    from customer_accounts accounts
    inner join registration_drafts registrations
      on registrations.id = accounts.registration_id
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(registrations.delivery_locations) = 'array'
          then registrations.delivery_locations
        else '[]'::jsonb
      end
    ) location
    inner join ksa_cities cities
      on cities.name_key = lower(regexp_replace(btrim(location->>'city'), '\\s+', ' ', 'g'))
    where quotations.customer_account_id = accounts.id
      and quotations.fulfilment_type = 'DELIVERY'
      and location->>'id' = quotations.ship_to_location_id;

    update customer_quotations quotations
    set pricing_city_id = cities.id
    from ksa_cities cities
    where quotations.fulfilment_type = 'PICKUP'
      and quotations.pickup_location_id = 'ALSAFWA_PLANT_MAIN'
      and cities.name_key = 'jeddah';
  `);

  pgm.addColumns('contracts', {
    pricing_city_id: {
      type: 'uuid',
      references: 'ksa_cities(id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.createIndex('contracts', 'pricing_city_id');
  pgm.sql(`
    update contracts contracts
    set pricing_city_id = cities.id
    from ksa_cities cities
    where cities.name_key = lower(regexp_replace(btrim(contracts.delivery_city), '\\s+', ' ', 'g'));
  `);
};

exports.down = (pgm) => {
  pgm.dropColumns('contracts', ['pricing_city_id']);
  pgm.dropColumns('customer_quotations', ['pricing_city_id']);

  pgm.dropConstraint('hader_delivery_prices', 'hader_delivery_prices_scope_unique');
  pgm.addConstraint('hader_delivery_prices', 'hader_delivery_prices_scope_unique', {
    unique: ['city_key', 'uom'],
  });
  pgm.dropConstraint('product_list_prices', 'product_list_prices_scope_unique');
  pgm.addConstraint('product_list_prices', 'product_list_prices_scope_unique', {
    unique: ['product_id', 'packaging_key', 'city_key', 'uom'],
  });
  pgm.dropColumns('hader_delivery_prices', ['city_id']);
  pgm.dropColumns('product_list_prices', ['city_id']);
  pgm.dropTable('ksa_cities');
};
