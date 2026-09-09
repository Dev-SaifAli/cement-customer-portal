const currentStatusCheck =
  "status in ('CREATED', 'ASSIGNED', 'LOADING', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED', 'CANCELLED')";
const legacyStatusCheck =
  "status in ('CREATED', 'ASSIGNED', 'LOADING', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED')";

exports.up = (pgm) => {
  pgm.sql('alter table shipments drop constraint if exists shipments_status_check');
  pgm.addConstraint('shipments', 'shipments_status_check', { check: currentStatusCheck });
};

exports.down = (pgm) => {
  pgm.sql('alter table shipments drop constraint if exists shipments_status_check');
  pgm.addConstraint('shipments', 'shipments_status_check', { check: legacyStatusCheck });
};
