exports.up = (pgm) => {
  pgm.addColumns('order_items', {
    unit_weight_kg: {
      type: 'numeric(10, 3)',
      check: 'unit_weight_kg > 0',
    },
    packaging_quantity: {
      type: 'numeric(14, 3)',
      check: 'packaging_quantity > 0',
    },
  });

  pgm.sql(`
    update order_items items
    set unit_weight_kg = products.unit_weight_kg,
        packaging_quantity = case
          when upper(trim(items.contract_uom)) = 'TON' then null
          when products.unit_weight_kg > 0
            then round((items.requested_quantity_tons * 1000) / products.unit_weight_kg, 3)
          else null
        end
    from product_catalog products, orders
    where products.id = items.product_id
      and orders.id = items.order_id
      and orders.contract_id is null
      and items.unit_weight_kg is null;
  `);
};

exports.down = (pgm) => {
  pgm.dropColumns('order_items', ['unit_weight_kg', 'packaging_quantity']);
};
