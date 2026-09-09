exports.up = (pgm) => {
  pgm.addColumn('customer_quotations', {
    special_price_requested: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('customer_quotations', 'special_price_requested');
};
