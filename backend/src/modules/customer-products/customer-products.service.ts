import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import { customerLocationsService } from '../customer-locations/customer-locations.service.js';
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
  unit_weight_kg: string;
  commercial_uom: string;
  category: string;
  display_order: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  list_price_per_ton: string | number | null;
}

export class CustomerProductsService {
  async getProduct(customerUser: CustomerUser, productId: string) {
    const pricingCityId = await this.resolveCustomerPricingCityId(customerUser);
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
         unit_weight_kg,
         commercial_uom,
         category,
         display_order,
         is_active,
         created_at,
         updated_at,
         ${productPriceSelect(pricingCityId)}
       from product_catalog
       ${productPriceJoin(pricingCityId, 2)}
       where id = $1
         and is_active = true`,
      pricingCityId ? [productId, pricingCityId] : [productId],
    );

    const row = result.rows[0];
    if (!row) {
      throw productNotFoundError;
    }

    return mapProduct(row);
  }

  async listProducts(customerUser: CustomerUser, query: ListCustomerProductsQuery) {
    const pricingCityId = await this.resolveCustomerPricingCityId(customerUser);
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

    const listValues = [...values];
    if (pricingCityId) listValues.push(pricingCityId);
    listValues.push(customerProductPageSize, offset);
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
         unit_weight_kg,
         commercial_uom,
         category,
         display_order,
         is_active,
         created_at,
         updated_at,
         ${productPriceSelect(pricingCityId)}
       from product_catalog
       ${productPriceJoin(pricingCityId, values.length + 1)}
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

  private async resolveCustomerPricingCityId(customerUser: CustomerUser) {
    const locations = await customerLocationsService.listLocations(customerUser).catch((error) => {
      if (error instanceof AppError && error.code === 'CUSTOMER_LOCATIONS_NOT_FOUND') return [];
      throw error;
    });
    const pricingCityName =
      locations.find((location) => location.isPrimary && location.city.trim())?.city.trim() ??
      locations.find((location) => location.city.trim())?.city.trim();
    if (!pricingCityName) return null;

    const cityResult = await pool.query<{ id: string }>(
      `select id
       from ksa_cities
       where name_key = lower(regexp_replace(btrim($1), '\\s+', ' ', 'g'))
         and is_active = true
       limit 1`,
      [pricingCityName],
    );

    return cityResult.rows[0]?.id ?? null;
  }
}

export const customerProductsService = new CustomerProductsService();

function mapProduct(row: ProductCatalogRow) {
  const listPricePerTon = nullableNumber(row.list_price_per_ton);

  return {
    id: row.id,
    productCode: row.product_code,
    productName: row.product_name,
    description: row.description,
    shortDescription: row.short_description,
    image: row.image,
    packagingType: row.packaging_type,
    uom: row.uom,
    unitWeightKg: Number(row.unit_weight_kg),
    commercialUom: row.commercial_uom,
    category: row.category,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: dateString(row.created_at),
    updatedAt: dateString(row.updated_at),
    priceDisplay:
      listPricePerTon === null ? ('PRICE_UNAVAILABLE' as const) : ('LIST_PRICE' as const),
    listPricePerTon,
    priceCurrency: 'SAR' as const,
    priceUnit: 'TON' as const,
  };
}

function dateString(value: Date | string) {
  return new Date(String(value)).toISOString();
}

function productPriceSelect(pricingCityId: string | null) {
  return pricingCityId
    ? 'product_prices.list_price as list_price_per_ton'
    : 'null::numeric as list_price_per_ton';
}

function productPriceJoin(pricingCityId: string | null, cityParameterIndex: number) {
  if (!pricingCityId) return '';

  return `left join lateral (
         select prices.list_price
         from product_list_prices prices
         where prices.product_id = product_catalog.id
           and prices.city_id = $${cityParameterIndex}::uuid
           and prices.packaging_key = lower(trim(product_catalog.packaging_type))
           and prices.is_active = true
         order by case when prices.uom = 'TON' then 0 else 1 end, prices.updated_at desc
         limit 1
       ) product_prices on true`;
}

function nullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
