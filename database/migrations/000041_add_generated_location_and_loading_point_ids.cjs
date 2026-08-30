exports.up = (pgm) => {
  pgm.createSequence('customer_location_site_id_seq', { ifNotExists: true });
  pgm.createSequence('hader_silo_number_seq', { ifNotExists: true });
  pgm.createSequence('hader_bagging_line_number_seq', { ifNotExists: true });

  pgm.createTable('customer_location_site_ids', {
    location_id: { type: 'text', primaryKey: true },
    site_id: { type: 'text', notNull: true, unique: true },
    registration_id: {
      type: 'uuid',
      references: 'registration_drafts(id)',
      onDelete: 'CASCADE',
    },
    customer_account_id: {
      type: 'uuid',
      references: 'customer_accounts(id)',
      onDelete: 'CASCADE',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.sql(`
    insert into customer_location_site_ids
      (location_id, site_id, registration_id, customer_account_id)
    select location->>'id', location->>'siteId', drafts.id, accounts.id
    from registration_drafts drafts
    cross join lateral jsonb_array_elements(drafts.delivery_locations) location
    left join customer_accounts accounts on accounts.registration_id = drafts.id
    where coalesce(location->>'id', '') <> ''
      and coalesce(location->>'siteId', '') <> ''
    on conflict do nothing;

    select setval(
      'customer_location_site_id_seq',
      greatest(
        1,
        coalesce((
          select max(substring(site_id from '^LOC-([0-9]+)$')::bigint)
          from customer_location_site_ids
          where site_id ~ '^LOC-[0-9]+$'
        ), 0)
      ),
      exists (select 1 from customer_location_site_ids where site_id ~ '^LOC-[0-9]+$')
    );

    select setval(
      'hader_silo_number_seq',
      greatest(
        1,
        coalesce((
          select max(substring(code from '^SILO-([0-9]+)$')::bigint)
          from hader_loading_points where code ~ '^SILO-[0-9]+$'
        ), 0)
      ),
      exists (select 1 from hader_loading_points where code ~ '^SILO-[0-9]+$')
    );

    select setval(
      'hader_bagging_line_number_seq',
      greatest(
        1,
        coalesce((
          select max(substring(code from '^LINE-([0-9]+)$')::bigint)
          from hader_loading_points where code ~ '^LINE-[0-9]+$'
        ), 0)
      ),
      exists (select 1 from hader_loading_points where code ~ '^LINE-[0-9]+$')
    );
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('customer_location_site_ids', { ifExists: true });
  pgm.dropSequence('hader_bagging_line_number_seq', { ifExists: true });
  pgm.dropSequence('hader_silo_number_seq', { ifExists: true });
  pgm.dropSequence('customer_location_site_id_seq', { ifExists: true });
};
