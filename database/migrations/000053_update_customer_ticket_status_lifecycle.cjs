const statusCheck = "status in ('DRAFT', 'SUBMITTED', 'OPEN', 'CLOSED')";
const previousStatusCheck =
  "previous_status is null or previous_status in ('DRAFT', 'SUBMITTED', 'OPEN', 'CLOSED')";
const newStatusCheck =
  "new_status is null or new_status in ('DRAFT', 'SUBMITTED', 'OPEN', 'CLOSED')";

const oldStatusCheck = "status in ('OPEN', 'CLOSED')";
const oldPreviousStatusCheck =
  "previous_status is null or previous_status in ('OPEN', 'CLOSED')";
const oldNewStatusCheck = "new_status is null or new_status in ('OPEN', 'CLOSED')";

exports.up = (pgm) => {
  dropColumnCheck(pgm, 'customer_tickets', 'status');
  dropColumnCheck(pgm, 'customer_ticket_events', 'previous_status');
  dropColumnCheck(pgm, 'customer_ticket_events', 'new_status');

  pgm.alterColumn('customer_tickets', 'status', { default: 'DRAFT' });
  pgm.addConstraint('customer_tickets', 'customer_tickets_status_check', {
    check: statusCheck,
  });
  pgm.addConstraint(
    'customer_ticket_events',
    'customer_ticket_events_previous_status_check',
    { check: previousStatusCheck },
  );
  pgm.addConstraint(
    'customer_ticket_events',
    'customer_ticket_events_new_status_check',
    { check: newStatusCheck },
  );
};

exports.down = (pgm) => {
  dropColumnCheck(pgm, 'customer_tickets', 'status');
  dropColumnCheck(pgm, 'customer_ticket_events', 'previous_status');
  dropColumnCheck(pgm, 'customer_ticket_events', 'new_status');

  pgm.alterColumn('customer_tickets', 'status', { default: 'OPEN' });
  pgm.addConstraint('customer_tickets', 'customer_tickets_status_check', {
    check: oldStatusCheck,
  });
  pgm.addConstraint(
    'customer_ticket_events',
    'customer_ticket_events_previous_status_check',
    { check: oldPreviousStatusCheck },
  );
  pgm.addConstraint(
    'customer_ticket_events',
    'customer_ticket_events_new_status_check',
    { check: oldNewStatusCheck },
  );
};

function dropColumnCheck(pgm, tableName, columnName) {
  pgm.sql(`
    do $$
    declare constraint_name text;
    begin
      for constraint_name in
        select conname
        from pg_constraint
        where conrelid = '${tableName}'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) like '%${columnName}%'
      loop
        execute format('alter table ${tableName} drop constraint %I', constraint_name);
      end loop;
    end $$;
  `);
}
