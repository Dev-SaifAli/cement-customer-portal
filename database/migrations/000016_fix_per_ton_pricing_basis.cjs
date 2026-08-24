exports.up = (pgm) => {
  pgm.addColumns('product_catalog', {
    unit_weight_kg: { type: 'numeric(10, 3)' },
    is_white_cement: { type: 'boolean', notNull: true, default: false },
  });

  pgm.sql(`
    update product_catalog
       set unit_weight_kg = case
         when upper(uom) = '50KG_BAG' then 50
         when upper(uom) = '40KG_BAG' then 40
         when upper(uom) = 'TON' then 1000
         else 1000
       end
  `);

  pgm.sql(`
    update product_catalog
       set is_white_cement = true
     where lower(product_name) like '%white%'
        or lower(product_code) like '%white%'
        or lower(category) like '%white%'
  `);

  pgm.alterColumn('product_catalog', 'unit_weight_kg', { notNull: true });

  pgm.addColumns('hader_delivery_prices', {
    standard_delivery_price: { type: 'numeric(14, 2)' },
    white_cement_delivery_price: { type: 'numeric(14, 2)' },
  });

  pgm.sql(`
    update hader_delivery_prices
       set standard_delivery_price = coalesce(delivery_price, 0),
           white_cement_delivery_price = coalesce(delivery_price, 0)
  `);

  pgm.alterColumn('hader_delivery_prices', 'standard_delivery_price', { notNull: true });
  pgm.alterColumn('hader_delivery_prices', 'white_cement_delivery_price', { notNull: true });
};

exports.down = (pgm) => {
  pgm.dropColumns('hader_delivery_prices', [
    'standard_delivery_price',
    'white_cement_delivery_price',
  ]);
  pgm.dropColumns('product_catalog', ['unit_weight_kg', 'is_white_cement']);
};
