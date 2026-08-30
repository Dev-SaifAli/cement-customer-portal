const rolesBeforePortalAdministrator =
  "role in ('SALES_REP','HADER_MANAGER','HADER_OPERATIONS','DISPATCH_USER','LOADING_USER','DELIVERY_TEAM_USER','PRICE_MANAGER','PRICING_ADMIN','COMMERCIAL_DIRECTOR')";

const rolesWithPortalAdministrator =
  "role in ('SALES_REP','HADER_MANAGER','HADER_OPERATIONS','DISPATCH_USER','LOADING_USER','DELIVERY_TEAM_USER','PRICE_MANAGER','PRICING_ADMIN','COMMERCIAL_DIRECTOR','PORTAL_ADMINISTRATOR')";

exports.up = (pgm) => {
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check: rolesWithPortalAdministrator,
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('sales_users', 'sales_users_role_check');
  pgm.addConstraint('sales_users', 'sales_users_role_check', {
    check: rolesBeforePortalAdministrator,
  });
};
