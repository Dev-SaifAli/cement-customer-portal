const productImageUpdates = [
  {
    productCode: 'CEM-OPC-50KG',
    productName: 'Ordinary Portland Cement',
    shortDescription: 'General-purpose Portland cement for concrete and masonry applications.',
    image: '/products/kharsani.jpeg',
    packagingType: 'Bag',
    uom: '50KG_BAG',
    category: 'Cement',
    displayOrder: 10,
  },
  {
    productCode: 'CEM-SRC-50KG',
    productName: 'Sulphate Resistant Cement',
    shortDescription: 'Cement formulated for environments exposed to sulphate conditions.',
    image: '/products/asaas.jpeg',
    packagingType: 'Bag',
    uom: '50KG_BAG',
    category: 'Cement',
    displayOrder: 20,
  },
  {
    productCode: 'CEM-PPC-50KG',
    productName: 'Portland Pozzolana Cement',
    shortDescription: 'Blended cement for durable concrete applications.',
    image: '/products/mubani.jpeg',
    packagingType: 'Bag',
    uom: '50KG_BAG',
    category: 'Cement',
    displayOrder: 30,
  },
  {
    productCode: 'CEM-JADRAN-50KG',
    productName: 'Jadran Applications Cement',
    shortDescription: 'Bag cement for finishing and application work.',
    image: '/products/jadran.jpeg',
    packagingType: 'Bag',
    uom: '50KG_BAG',
    category: 'Cement',
    displayOrder: 35,
  },
  {
    productCode: 'CEM-DEKOR-40KG',
    productName: 'Dekor Decorative Cement',
    shortDescription: 'Decorative cement product for gypsum and finishing applications.',
    image: '/products/dekor.jpeg',
    packagingType: 'Bag',
    uom: '40KG_BAG',
    category: 'Cement',
    displayOrder: 36,
  },
  {
    productCode: 'CEM-BREKAST-50KG',
    productName: 'Brekast Cement',
    shortDescription: 'Bag cement for precast and standard cement applications.',
    image: '/products/breka-stu.jpeg',
    packagingType: 'Bag',
    uom: '50KG_BAG',
    category: 'Cement',
    displayOrder: 37,
  },
];

exports.up = (pgm) => {
  const rows = productImageUpdates
    .map(
      (product) =>
        `(
          '${product.productCode}',
          '${product.productName.replaceAll("'", "''")}',
          '${product.shortDescription.replaceAll("'", "''")}',
          '${product.image}',
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
      image,
      packaging_type,
      uom,
      category,
      display_order,
      is_active
    )
    values ${rows}
    on conflict (product_code) do update
    set product_name = excluded.product_name,
        short_description = excluded.short_description,
        image = excluded.image,
        packaging_type = excluded.packaging_type,
        uom = excluded.uom,
        category = excluded.category,
        display_order = excluded.display_order,
        is_active = excluded.is_active,
        updated_at = now();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    update product_catalog
    set image = null,
        updated_at = now()
    where product_code in (
      'CEM-OPC-50KG',
      'CEM-SRC-50KG',
      'CEM-PPC-50KG',
      'CEM-JADRAN-50KG',
      'CEM-DEKOR-40KG',
      'CEM-BREKAST-50KG'
    );
  `);
};
