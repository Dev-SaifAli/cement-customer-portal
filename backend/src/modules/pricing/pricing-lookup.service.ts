import { pool } from '../../database/pool.js';
import type { PoolClient } from 'pg';

export interface QuotationPricingItemRow {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  product_image: string | null;
  unit_weight_kg: string;
  is_white_cement: boolean;
  equivalent_tons: string;
  quantity: string;
  uom: string;
  packaging_type: string;
  product_list_price: string | null;
  product_price: string | null;
  discount_mode: 'PERCENT' | 'SAR_PER_TON' | null;
  discount_value: string | null;
  discount_amount_per_ton: string | null;
  delivery_list_price: string | null;
  delivery_price: string | null;
  customer_rate: string | null;
  amount: string | null;
  catalog_list_price: string | null;
  catalog_delivery_list_price: string | null;
}

interface ProductPriceScope {
  productId: string;
  cityId: string;
  packaging: string;
}

interface DeliveryPriceScope {
  cityId: string;
  isWhiteCement?: boolean;
}

export class PricingLookupService {
  async getProductListPrice(scope: ProductPriceScope) {
    const result = await pool.query<{ list_price: string }>(
      `select list_price from product_list_prices
       where product_id = $1 and city_id = $2
         and packaging_key = lower(trim($3)) and is_active = true
       order by case when uom = 'TON' then 0 else 1 end, updated_at desc
       limit 1`,
      [scope.productId, scope.cityId, scope.packaging],
    );
    return result.rows[0] ? Number(result.rows[0].list_price) : null;
  }

  async getHaderDeliveryPrice(scope: DeliveryPriceScope) {
    const result = await pool.query<{ delivery_price: string }>(
      `select case
         when $2::boolean then prices.white_cement_delivery_price
         else prices.standard_delivery_price
       end as delivery_price
       from hader_delivery_prices prices
       inner join ksa_cities cities on cities.id = prices.city_id
       where prices.city_id = $1 and prices.is_active = true
         and cities.is_active = true and cities.is_hader_enabled = true
       order by case when prices.uom = 'TON' then 0 else 1 end, prices.updated_at desc
      limit 1`,
      [scope.cityId, Boolean(scope.isWhiteCement)],
    );
    return result.rows[0] ? Number(result.rows[0].delivery_price) : null;
  }

  async getQuotationItems(
    quotationId: string,
    cityId: string | null,
    client?: PoolClient,
    lock = false,
  ) {
    const executor = client ?? pool;
    const result = await executor.query<QuotationPricingItemRow>(
      `${quotationItemPricingSelect}${lock ? ' for update of items' : ''}`,
      [quotationId, cityId],
    );
    return result.rows;
  }
}

export const pricingLookupService = new PricingLookupService();

const quotationItemPricingSelect = `
  select items.*, products.product_code, products.product_name, products.image as product_image,
         products.unit_weight_kg, products.is_white_cement,
         round((items.quantity * products.unit_weight_kg) / 1000, 6) as equivalent_tons,
         product_prices.list_price as catalog_list_price,
         case
           when products.is_white_cement then delivery_prices.white_cement_delivery_price
           else delivery_prices.standard_delivery_price
         end as catalog_delivery_list_price
  from customer_quotation_items items
  inner join product_catalog products on products.id = items.product_id
  left join lateral (
    select list_price
    from product_list_prices product_prices
    where product_prices.product_id = items.product_id
      and product_prices.packaging_key = lower(trim(items.packaging_type))
      and product_prices.city_id = $2::uuid
      and product_prices.is_active = true
    order by case when product_prices.uom = 'TON' then 0 else 1 end, product_prices.updated_at desc
    limit 1
  ) product_prices on true
  left join lateral (
    select standard_delivery_price, white_cement_delivery_price
    from hader_delivery_prices delivery_prices
    where delivery_prices.city_id = $2::uuid
      and delivery_prices.is_active = true
      and exists (
        select 1 from ksa_cities hader_city
        where hader_city.id = delivery_prices.city_id
          and hader_city.is_active = true
          and hader_city.is_hader_enabled = true
      )
    order by case when delivery_prices.uom = 'TON' then 0 else 1 end, delivery_prices.updated_at desc
    limit 1
  ) delivery_prices on true
  where items.quotation_id = $1
  order by items.display_order asc`;
