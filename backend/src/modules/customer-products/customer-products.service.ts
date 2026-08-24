import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { ListCustomerProductsQuery } from './customer-products.validation.js';

const customerProductPageSize = 10;
const productNotFoundError = new AppError(
  'Product was not found.',
  404,
  'CUSTOMER_PRODUCT_NOT_FOUND',
);

interface ProductCatalogRow {
  id: string;
  product_code: string;
  product_name: string;
  description: string | null;
  short_description: string | null;
  image: string | null;
  packaging_type: string;
  uom: string;
  category: string;
  display_order: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export class CustomerProductsService {
  async getProduct(productId: string) {
    const result = await pool.query<ProductCatalogRow>(
      `select
         id,
         product_code,
         product_name,
         description,
         short_description,
         image,
         packaging_type,
         uom,
         category,
         display_order,
         is_active,
         created_at,
         updated_at
       from product_catalog
       where id = $1
         and is_active = true`,
      [productId],
    );

    const row = result.rows[0];
    if (!row) {
      throw productNotFoundError;
    }

    return mapProduct(row);
  }

  async listProducts(query: ListCustomerProductsQuery) {
    const offset = (query.page - 1) * customerProductPageSize;
    const filters = ['is_active = true'];
    const values: unknown[] = [];

    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      filters.push(`(
        lower(product_code) like $${values.length}
        or lower(product_name) like $${values.length}
        or lower(coalesce(description, '')) like $${values.length}
        or lower(coalesce(short_description, '')) like $${values.length}
      )`);
    }

    if (query.category) {
      values.push(query.category.toLowerCase());
      filters.push(`lower(category) = $${values.length}`);
    }

    if (query.packagingType) {
      values.push(query.packagingType.toLowerCase());
      filters.push(`lower(packaging_type) = $${values.length}`);
    }

    if (query.uom) {
      values.push(query.uom.toLowerCase());
      filters.push(`lower(uom) = $${values.length}`);
    }

    const whereClause = `where ${filters.join(' and ')}`;
    const countResult = await pool.query<{ total: string }>(
      `select count(*)::text as total
       from product_catalog
       ${whereClause}`,
      values,
    );

    const listValues = [...values, customerProductPageSize, offset];
    const result = await pool.query<ProductCatalogRow>(
      `select
         id,
         product_code,
         product_name,
         description,
         short_description,
         image,
         packaging_type,
         uom,
         category,
         display_order,
         is_active,
         created_at,
         updated_at
       from product_catalog
       ${whereClause}
       order by display_order asc, product_name asc
       limit $${listValues.length - 1}
       offset $${listValues.length}`,
      listValues,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map(mapProduct),
      pagination: {
        page: query.page,
        pageSize: customerProductPageSize,
        total,
        totalPages: Math.ceil(total / customerProductPageSize),
      },
    };
  }
}

export const customerProductsService = new CustomerProductsService();

function mapProduct(row: ProductCatalogRow) {
  return {
    id: row.id,
    productCode: row.product_code,
    productName: row.product_name,
    description: row.description,
    shortDescription: row.short_description,
    image: row.image,
    packagingType: row.packaging_type,
    uom: row.uom,
    category: row.category,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: dateString(row.created_at),
    updatedAt: dateString(row.updated_at),
    priceDisplay: 'PRICE_ON_REQUEST' as const,
  };
}

function dateString(value: Date | string) {
  return new Date(String(value)).toISOString();
}
