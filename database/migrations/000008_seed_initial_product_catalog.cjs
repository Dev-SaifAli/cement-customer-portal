const initialProducts = [
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
  {
    productCode: 'CEM-OPC-BULK',
    productName: 'Ordinary Portland Cement Bulk',
    shortDescription: 'Bulk Ordinary Portland Cement for ready-mix and large-volume customers.',
    image: null,
    packagingType: 'Bulk',
    uom: 'TON',
    category: 'Cement',
    displayOrder: 40,
  },
  {
    productCode: 'CEM-SRC-BULK',
    productName: 'Sulphate Resistant Cement Bulk',
    shortDescription: 'Bulk Sulphate Resistant Cement for infrastructure and industrial projects.',
    image: null,
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
          ${product.image ? `'${product.image}'` : 'null'},
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
    on conflict (product_code) do nothing;
  `);
};

exports.down = (pgm) => {
  pgm.sql('select 1;');
};
