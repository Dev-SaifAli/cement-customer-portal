exports.up = (pgm) => {
  pgm.sql(`
    update product_catalog
       set unit_weight_kg = case upper(trim(uom))
         when '50KG_BAG' then 50
         when '40KG_BAG' then 40
         when 'TON' then 1000
         else unit_weight_kg
       end,
           updated_at = now()
     where coalesce(unit_weight_kg, 0) <= 0
       and upper(trim(uom)) in ('50KG_BAG', '40KG_BAG', 'TON')
  `);
};

exports.down = (pgm) => {
  pgm.sql('select 1;');
};
