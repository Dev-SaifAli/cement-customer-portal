exports.up = (pgm) => {
  pgm.addColumns('product_catalog', {
    commercial_uom: { type: 'text', notNull: true, default: 'TON' },
  });

  pgm.addColumns('customer_quotation_items', {
    quantity_tons: { type: 'numeric(14, 6)' },
    packaging_quantity: { type: 'numeric(14, 3)' },
  });

  pgm.sql(`
    update customer_quotation_items items
       set quantity_tons = case
             when upper(items.uom) = 'TON' then items.quantity
             else round((items.quantity * products.unit_weight_kg) / 1000, 6)
           end,
           packaging_quantity = case
             when upper(items.uom) = 'TON' then null
             else items.quantity
           end
      from product_catalog products
     where products.id = items.product_id
       and items.quantity_tons is null
  `);

  pgm.alterColumn('customer_quotation_items', 'quantity_tons', { notNull: true });
  pgm.addConstraint('customer_quotation_items', 'customer_quotation_items_quantity_tons_positive', {
    check: 'quantity_tons > 0',
  });

  pgm.addColumns('contract_items', {
    commercial_quantity_tons: { type: 'numeric(14, 6)' },
    packaging_quantity: { type: 'numeric(14, 3)' },
  });

  pgm.sql(`
    update contract_items
       set commercial_quantity_tons = equivalent_tons,
           packaging_quantity = case
             when upper(original_uom) = 'TON' then null
             else original_quantity
           end
     where commercial_quantity_tons is null
  `);

  pgm.alterColumn('contract_items', 'commercial_quantity_tons', { notNull: true });
  pgm.addConstraint('contract_items', 'contract_items_commercial_quantity_tons_positive', {
    check: 'commercial_quantity_tons > 0',
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('contract_items', 'contract_items_commercial_quantity_tons_positive');
  pgm.dropColumns('contract_items', ['commercial_quantity_tons', 'packaging_quantity']);
  pgm.dropConstraint(
    'customer_quotation_items',
    'customer_quotation_items_quantity_tons_positive',
  );
  pgm.dropColumns('customer_quotation_items', ['quantity_tons', 'packaging_quantity']);
  pgm.dropColumns('product_catalog', ['commercial_uom']);
};
