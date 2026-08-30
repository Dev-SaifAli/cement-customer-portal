exports.up = (pgm) => {
  pgm.addColumn('tax_configurations', {
    vat_mode: { type: 'text', notNull: true, default: 'LOCAL' },
  });
  pgm.addConstraint('tax_configurations', 'tax_configurations_vat_mode_check', {
    check: "vat_mode in ('LOCAL', 'EXPORT')",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('tax_configurations', 'tax_configurations_vat_mode_check');
  pgm.dropColumn('tax_configurations', 'vat_mode');
};
