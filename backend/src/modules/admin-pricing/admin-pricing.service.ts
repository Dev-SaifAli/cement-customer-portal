import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type { UpsertDeliveryPrice, UpsertProductPrice } from './admin-pricing.validation.js';

interface CityRow {
  id: string;
  name: string;
  is_hader_enabled: boolean;
  is_active: boolean;
  updated_at: string | Date;
}

interface ProductRow {
  id: string;
  product_code: string;
  product_name: string;
  packaging_type: string;
  uom: string;
  image: string | null;
}

interface ProductPriceRow {
  id: string;
  product_id: string;
  city_id: string;
  packaging_type: string;
  city: string;
  uom: string;
  list_price: string;
  updated_at: string | Date;
  configured_by_name: string;
}

interface DeliveryPriceRow {
  id: string;
  city_id: string;
  city: string;
  uom: string;
  delivery_price: string;
  standard_delivery_price: string;
  white_cement_delivery_price: string;
  updated_at: string | Date;
  configured_by_name: string;
}

export class AdminPricingService {
  async getConfiguration() {
    const [cities, products, productPrices, deliveryPrices] = await Promise.all([
      pool.query<CityRow>(
        `select id, name, is_hader_enabled, is_active, updated_at
         from ksa_cities
         where is_active = true
         order by name asc`,
      ),
      pool.query<ProductRow>(
        `select id, product_code, product_name, packaging_type, uom, image
         from product_catalog
         where is_active = true
         order by display_order asc, product_name asc`,
      ),
      pool.query<ProductPriceRow>(
        `select prices.id, prices.product_id, prices.city_id, prices.packaging_type,
                cities.name as city, prices.uom, prices.list_price, prices.updated_at,
                users.name as configured_by_name
         from product_list_prices prices
         inner join ksa_cities cities on cities.id = prices.city_id
         inner join sales_users users on users.id = prices.configured_by_sales_user_id
         where prices.is_active = true
         order by cities.name asc, prices.packaging_type asc`,
      ),
      pool.query<DeliveryPriceRow>(
        `select distinct on (prices.city_id)
                prices.id, prices.city_id, cities.name as city, prices.uom,
                prices.delivery_price, prices.standard_delivery_price,
                prices.white_cement_delivery_price, prices.updated_at,
                users.name as configured_by_name
         from hader_delivery_prices prices
         inner join ksa_cities cities on cities.id = prices.city_id
         inner join sales_users users on users.id = prices.configured_by_sales_user_id
         where prices.is_active = true and cities.is_active = true and cities.is_hader_enabled = true
         order by prices.city_id, case when prices.uom = 'TON' then 0 else 1 end,
                  prices.updated_at desc`,
      ),
    ]);

    const mappedCities = cities.rows.map(mapCity);
    return {
      cities: mappedCities,
      haderCities: mappedCities.filter((city) => city.isHaderEnabled),
      products: products.rows.map((row) => ({
        id: row.id,
        productCode: row.product_code,
        productName: row.product_name,
        packagingType: row.packaging_type,
        uom: row.uom,
        image: row.image,
      })),
      productPrices: productPrices.rows.map(mapProductPrice),
      deliveryPrices: deliveryPrices.rows.map(mapDeliveryPrice),
    };
  }

  async upsertProductPrice(productId: string, input: UpsertProductPrice, user: SalesUser) {
    const [product, city] = await Promise.all([
      pool.query<{ id: string; packaging_type: string; uom: string }>(
        `select id, packaging_type, uom from product_catalog where id = $1 and is_active = true`,
        [productId],
      ),
      pool.query<CityRow>(
        `select id, name, is_hader_enabled, is_active, updated_at
         from ksa_cities where id = $1 and is_active = true`,
        [input.cityId],
      ),
    ]);
    const productRow = product.rows[0];
    const cityRow = city.rows[0];
    if (!productRow) {
      throw new AppError('Active product was not found.', 404, 'PRICING_PRODUCT_NOT_FOUND');
    }
    if (!cityRow) {
      throw new AppError('Active pricing city was not found.', 404, 'PRICING_CITY_NOT_FOUND');
    }

    const result = await pool.query<ProductPriceRow>(
      `insert into product_list_prices (
         product_id, packaging_type, packaging_key, city_id, city, city_key, uom,
         list_price, configured_by_sales_user_id
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (product_id, city_id, packaging_key, uom)
       do update set packaging_type = excluded.packaging_type,
                     city = excluded.city,
                     city_key = excluded.city_key,
                     list_price = excluded.list_price,
                     is_active = true,
                     configured_by_sales_user_id = excluded.configured_by_sales_user_id,
                     updated_at = now()
       returning id, product_id, city_id, packaging_type, city, uom, list_price,
                 updated_at, $10::text as configured_by_name`,
      [
        productId,
        productRow.packaging_type,
        key(productRow.packaging_type),
        cityRow.id,
        cityRow.name,
        key(cityRow.name),
        'TON',
        input.listPrice,
        user.id,
        user.name,
      ],
    );
    const saved = result.rows[0];
    if (!saved) throw pricingWriteFailed();
    return mapProductPrice(saved);
  }

  async upsertDeliveryPrice(input: UpsertDeliveryPrice, user: SalesUser) {
    const city = await pool.query<CityRow>(
      `select id, name, is_hader_enabled, is_active, updated_at
       from ksa_cities where id = $1 and is_active = true and is_hader_enabled = true`,
      [input.cityId],
    );
    const cityRow = city.rows[0];
    if (!cityRow) {
      throw new AppError(
        'The selected city is not enabled for Hader delivery.',
        400,
        'HADER_CITY_NOT_ENABLED',
      );
    }

    const result = await pool.query<DeliveryPriceRow>(
      `insert into hader_delivery_prices (
         city_id, city, city_key, uom, delivery_price,
         standard_delivery_price, white_cement_delivery_price, configured_by_sales_user_id
       ) values ($1, $2, $3, 'TON', $4, $4, $5, $6)
       on conflict (city_id, uom)
       do update set city = excluded.city,
                     city_key = excluded.city_key,
                     delivery_price = excluded.delivery_price,
                     standard_delivery_price = excluded.standard_delivery_price,
                     white_cement_delivery_price = excluded.white_cement_delivery_price,
                     is_active = true,
                     configured_by_sales_user_id = excluded.configured_by_sales_user_id,
                     updated_at = now()
       returning id, city_id, city, uom, delivery_price, standard_delivery_price,
                 white_cement_delivery_price, updated_at, $7::text as configured_by_name`,
      [
        cityRow.id,
        cityRow.name,
        key(cityRow.name),
        input.standardDeliveryPrice,
        input.whiteCementDeliveryPrice,
        user.id,
        user.name,
      ],
    );
    const saved = result.rows[0];
    if (!saved) throw pricingWriteFailed();
    return mapDeliveryPrice(saved);
  }

  async setHaderEnabled(cityId: string, isHaderEnabled: boolean) {
    const result = await pool.query<CityRow>(
      `update ksa_cities
       set is_hader_enabled = $2, updated_at = now()
       where id = $1 and is_active = true
       returning id, name, is_hader_enabled, is_active, updated_at`,
      [cityId, isHaderEnabled],
    );
    const city = result.rows[0];
    if (!city) {
      throw new AppError('Active pricing city was not found.', 404, 'PRICING_CITY_NOT_FOUND');
    }
    return mapCity(city);
  }
}

export const adminPricingService = new AdminPricingService();

function mapCity(row: CityRow) {
  return {
    id: row.id,
    name: row.name,
    isHaderEnabled: row.is_hader_enabled,
    isActive: row.is_active,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapProductPrice(row: ProductPriceRow) {
  return {
    id: row.id,
    productId: row.product_id,
    cityId: row.city_id,
    packagingType: row.packaging_type,
    city: row.city,
    uom: row.uom,
    listPrice: Number(row.list_price),
    configuredBy: row.configured_by_name,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapDeliveryPrice(row: DeliveryPriceRow) {
  return {
    id: row.id,
    cityId: row.city_id,
    city: row.city,
    uom: row.uom,
    deliveryPrice: Number(row.delivery_price),
    standardDeliveryPrice: Number(row.standard_delivery_price),
    whiteCementDeliveryPrice: Number(row.white_cement_delivery_price),
    configuredBy: row.configured_by_name,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function key(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function pricingWriteFailed() {
  return new AppError(
    'Pricing configuration could not be saved.',
    500,
    'PRICING_CONFIGURATION_WRITE_FAILED',
  );
}
