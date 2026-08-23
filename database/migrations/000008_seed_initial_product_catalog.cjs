const initialProducts = [
  {
    productCode: 'CEM-OPC-50KG',
    productName: 'Ordinary Portland Cement',
    shortDescription: 'General-purpose Portland cement for concrete and masonry applications.',
    packagingType: 'Bag',
    uom: '50KG_BAG',
    category: 'Cement',
    displayOrder: 10,
  },
  {
    productCode: 'CEM-SRC-50KG',
    productName: 'Sulphate Resistant Cement',
    shortDescription: 'Cement formulated for environments exposed to sulphate conditions.',
    packagingType: 'Bag',
    uom: '50KG_BAG',
    category: 'Cement',
    displayOrder: 20,
  },
  {
    productCode: 'CEM-PPC-50KG',
    productName: 'Portland Pozzolana Cement',
    shortDescription: 'Blended cement for durable concrete applications.',
    packagingType: 'Bag',
    uom: '50KG_BAG',
    category: 'Cement',
    displayOrder: 30,
  },
  {
    productCode: 'CEM-OPC-BULK',
    productName: 'Ordinary Portland Cement Bulk',
    shortDescription: 'Bulk Ordinary Portland Cement for ready-mix and large-volume customers.',
    packagingType: 'Bulk',
    uom: 'TON',
    category: 'Cement',
    displayOrder: 40,
  },
  {
    productCode: 'CEM-SRC-BULK',
    productName: 'Sulphate Resistant Cement Bulk',
    shortDescription: 'Bulk Sulphate Resistant Cement for infrastructure and industrial projects.',
    packagingType: 'Bulk',
    uom: 'TON',
    category: 'Cement',
    displayOrder: 50,
  },
];

exports.up = (pgm) => {
  const rows = initialProducts
    .map(
      (product) =>
        `(
          '${product.productCode}',
          '${product.productName.replaceAll("'", "''")}',
          '${product.shortDescription.replaceAll("'", "''")}',
          '${product.packagingType}',
          '${product.uom}',
          '${product.category}',
          ${product.displayOrder},
          true
        )`,
    )
    .join(',');

  pgm.sql(`
    insert into product_catalog (
      product_code,
      product_name,
      short_description,
      packaging_type,
      uom,
      category,
      display_order,
      is_active
    )
    values ${rows}
    on conflict (product_code) do nothing;
  `);
};

exports.down = (pgm) => {
  pgm.sql('select 1;');
};
