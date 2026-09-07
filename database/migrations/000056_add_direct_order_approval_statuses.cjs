const currentStatusCheck =
  "status in ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')";
const previousStatusCheck =
  "previous_status is null or previous_status in ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')";
const newStatusCheck =
  "new_status is null or new_status in ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')";

const legacyStatusCheck = "status in ('DRAFT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')";
const legacyPreviousStatusCheck =
  "previous_status is null or previous_status in ('DRAFT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')";
const legacyNewStatusCheck =
  "new_status is null or new_status in ('DRAFT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')";

exports.up = (pgm) => {
  pgm.sql('alter table orders drop constraint if exists orders_status_check');
  pgm.sql('alter table order_events drop constraint if exists order_events_previous_status_check');
  pgm.sql('alter table order_events drop constraint if exists order_events_new_status_check');

  pgm.addConstraint('orders', 'orders_status_check', { check: currentStatusCheck });
  pgm.addConstraint('order_events', 'order_events_previous_status_check', {
    check: previousStatusCheck,
  });
  pgm.addConstraint('order_events', 'order_events_new_status_check', { check: newStatusCheck });
};

exports.down = (pgm) => {
  pgm.sql('alter table orders drop constraint if exists orders_status_check');
  pgm.sql('alter table order_events drop constraint if exists order_events_previous_status_check');
  pgm.sql('alter table order_events drop constraint if exists order_events_new_status_check');

  pgm.addConstraint('orders', 'orders_status_check', { check: legacyStatusCheck });
  pgm.addConstraint('order_events', 'order_events_previous_status_check', {
    check: legacyPreviousStatusCheck,
  });
  pgm.addConstraint('order_events', 'order_events_new_status_check', {
    check: legacyNewStatusCheck,
  });
};
