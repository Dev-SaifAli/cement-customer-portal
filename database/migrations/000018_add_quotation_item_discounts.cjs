exports.up = (pgm) => {
  pgm.addColumns('customer_quotation_items', {
    discount_mode: {
      type: 'text',
      check: "discount_mode in ('PERCENT', 'SAR_PER_TON')",
    },
    discount_value: { type: 'numeric(14, 4)' },
    discount_amount_per_ton: { type: 'numeric(14, 2)' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('customer_quotation_items', [
    'discount_mode',
    'discount_value',
    'discount_amount_per_ton',
  ]);
};
