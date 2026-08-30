import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import {
  productFilterSchema,
  type ProductFilter,
  type ProductInput,
  type ProductUpdate,
} from './admin-products.validation.js';

interface ProductRow {
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
  unit_weight_kg: string;
  is_white_cement: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  updated_by_name: string | null;
  price_city_count: number | string | null;
  min_list_price: number | string | null;
  price_rows: Array<{ city: string; listPrice: number }> | string | null;
}

interface BagSizeRow {
  id: string;
  unit_weight_kg: string;
  is_active: boolean;
}

const productSelect = `
  select products.id, products.product_code, products.product_name, products.description,
         products.short_description, products.image, products.packaging_type, products.uom,
         products.category, products.display_order, products.is_active, products.unit_weight_kg,
         products.is_white_cement, products.created_at, products.updated_at,
         users.name as updated_by_name,
         coalesce(price_summary.price_city_count, 0) as price_city_count,
         price_summary.min_list_price,
         coalesce(price_summary.price_rows, '[]'::jsonb) as price_rows
    from product_catalog products
    left join sales_users users on users.id = products.updated_by_sales_user_id
    left join lateral (
      select count(*)::int as price_city_count,
             min(prices.list_price)::float8 as min_list_price,
             jsonb_agg(
               jsonb_build_object('city', cities.name, 'listPrice', prices.list_price::float8)
               order by cities.name
             ) filter (where prices.id is not null) as price_rows
        from product_list_prices prices
        join ksa_cities cities on cities.id = prices.city_id
       where prices.product_id = products.id
         and prices.is_active = true
    ) price_summary on true`;

export class AdminProductsService {
  async listBagSizes(search: string) {
    const normalizedSearch = search.replace(/[^0-9.]/g, '');
    const result = await pool.query<BagSizeRow>(
      `select id, unit_weight_kg, is_active
         from product_bag_sizes
        where is_active = true
          and ($1 = '' or unit_weight_kg::text ilike $2)
        order by unit_weight_kg
        limit 20`,
      [normalizedSearch, `%${normalizedSearch}%`],
    );
    return { bagSizes: result.rows.map(mapBagSize) };
  }

  async createBagSize(unitWeightKg: number, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const inserted = await client.query<BagSizeRow>(
        `insert into product_bag_sizes (unit_weight_kg, created_by_sales_user_id)
         values ($1, $2)
         on conflict (unit_weight_kg) do nothing
         returning id, unit_weight_kg, is_active`,
        [unitWeightKg, user.id],
      );
      let row = inserted.rows[0];
      if (!row) {
        const existing = await client.query<BagSizeRow>(
          `select id, unit_weight_kg, is_active
             from product_bag_sizes
            where unit_weight_kg = $1
            limit 1`,
          [unitWeightKg],
        );
        row = existing.rows[0];
      }
      if (!row) throw new AppError('Bag size could not be saved.', 500, 'BAG_SIZE_WRITE_FAILED');
      if (!row.is_active) {
        const activated = await client.query<BagSizeRow>(
          `update product_bag_sizes
              set is_active = true, updated_at = now()
            where id = $1
            returning id, unit_weight_kg, is_active`,
          [row.id],
        );
        row = activated.rows[0] ?? row;
      }
      if (inserted.rowCount) {
        await event(client, row.id, 'PRODUCT_BAG_SIZE_CREATED', user.id, null, mapBagSize(row));
      }
      await client.query('commit');
      return mapBagSize(row);
    } catch (failure) {
      await client.query('rollback');
      throw failure;
    } finally {
      client.release();
    }
  }

  async list(input: {
    page: number;
    pageSize: number;
    search?: string | undefined;
    filters?: string | undefined;
  }) {
    const values: unknown[] = [];
    const clauses: string[] = [];
    if (input.search) {
      values.push(`%${input.search}%`);
      clauses.push(`(products.product_code ilike $${values.length} or products.product_name ilike $${values.length})`);
    }
    const filters = parseFilters(input.filters);
    if (filters.length) clauses.push(buildFilterGroup(filters, values));
    const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const count = await pool.query<{ total: string }>(
      `select count(*)::text as total from product_catalog products ${where}`,
      values,
    );
    const offset = (input.page - 1) * input.pageSize;
    const result = await pool.query<ProductRow>(
      `${productSelect} ${where}
       order by products.updated_at desc, products.product_name asc
       limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, input.pageSize, offset],
    );
    return {
      products: result.rows.map(mapProduct),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: Number(count.rows[0]?.total ?? 0),
      },
    };
  }

  async get(id: string) {
    const [product, prices, cities] = await Promise.all([
      pool.query<ProductRow>(`${productSelect} where products.id = $1`, [id]),
      pool.query(
        `select prices.id, prices.city_id as "cityId", cities.name as city,
                prices.list_price::float8 as "listPrice", prices.is_active as "isActive",
                prices.updated_at as "updatedAt", users.name as "updatedBy"
           from product_list_prices prices
           join ksa_cities cities on cities.id = prices.city_id
           left join sales_users users on users.id = prices.configured_by_sales_user_id
          where prices.product_id = $1 order by cities.name`,
        [id],
      ),
      pool.query(`select id, name from ksa_cities where is_active = true order by name`),
    ]);
    const row = product.rows[0];
    if (!row) throw new AppError('Product was not found.', 404, 'PRODUCT_NOT_FOUND');
    return { product: mapProduct(row), prices: prices.rows, cities: cities.rows };
  }

  async create(input: ProductInput, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const productCode = input.productCode?.trim() || await generateProductCode(client, input);
      const productInput = { ...input, productCode };
      const result = await client.query<ProductRow>(
        `insert into product_catalog (
           product_code, product_name, description, short_description, image, packaging_type,
           uom, category, display_order, is_active, unit_weight_kg, is_white_cement,
           updated_by_sales_user_id
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         returning *, $14::text as updated_by_name`,
        valuesFor(productInput, user, user.name),
      );
      const product = result.rows[0];
      if (!product) throw writeFailed();
      await event(client, product.id, 'PRODUCT_CREATED', user.id, null, mapProduct(product));
      await client.query('commit');
      return mapProduct(product);
    } catch (failure) {
      await client.query('rollback');
      throw normalizeWriteError(failure);
    } finally {
      client.release();
    }
  }

  async update(id: string, input: ProductUpdate, user: SalesUser) {
    const current = await this.getRow(id);
    const next: ProductInput & { productCode: string } = {
      productCode: input.productCode ?? current.product_code,
      productName: input.productName ?? current.product_name,
      description: input.description === undefined ? current.description : input.description,
      shortDescription: input.shortDescription === undefined ? current.short_description : input.shortDescription,
      image: input.image === undefined ? current.image : input.image,
      productType: input.productType ?? current.category,
      packaging: input.packaging ?? current.packaging_type,
      uom: input.uom ?? current.uom,
      unitWeightKg: input.unitWeightKg ?? Number(current.unit_weight_kg),
      isWhiteCement: input.isWhiteCement ?? current.is_white_cement,
      isActive: input.isActive ?? current.is_active,
      displayOrder: input.displayOrder ?? current.display_order,
    };
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query<ProductRow>(
        `update product_catalog set product_code=$2, product_name=$3, description=$4,
           short_description=$5, image=$6, packaging_type=$7, uom=$8, category=$9,
           display_order=$10, is_active=$11, unit_weight_kg=$12, is_white_cement=$13,
           updated_by_sales_user_id=$14, updated_at=now()
         where id=$1 returning *, $15::text as updated_by_name`,
        [id, ...valuesFor(next, user, user.name).slice(0, 13), user.name],
      );
      const product = result.rows[0];
      if (!product) throw writeFailed();
      await event(client, id, 'PRODUCT_UPDATED', user.id, mapProduct(current), mapProduct(product));
      await client.query('commit');
      return mapProduct(product);
    } catch (failure) {
      await client.query('rollback');
      throw normalizeWriteError(failure);
    } finally { client.release(); }
  }

  async bulk(ids: string[], action: 'ACTIVATE' | 'DEACTIVATE' | 'DELETE', user: SalesUser) {
    const isActive = action === 'ACTIVATE';
    const client = await pool.connect();
    try {
      await client.query('begin');
      const existing = await client.query<ProductRow>(`${productSelect} where products.id = any($1::uuid[]) for update of products`, [ids]);
      if (existing.rows.length !== ids.length) throw new AppError('One or more products were not found.', 404, 'PRODUCT_NOT_FOUND');
      await client.query(
        `update product_catalog set is_active=$2, updated_by_sales_user_id=$3, updated_at=now()
          where id=any($1::uuid[])`,
        [ids, isActive, user.id],
      );
      for (const product of existing.rows) {
        await event(client, product.id, `PRODUCT_${action}`, user.id, mapProduct(product), { ...mapProduct(product), isActive });
      }
      await client.query('commit');
      return { updated: ids.length, action };
    } catch (failure) {
      await client.query('rollback');
      throw failure;
    } finally { client.release(); }
  }

  private async getRow(id: string) {
    const result = await pool.query<ProductRow>(`${productSelect} where products.id = $1`, [id]);
    const row = result.rows[0];
    if (!row) throw new AppError('Product was not found.', 404, 'PRODUCT_NOT_FOUND');
    return row;
  }
}

export const adminProductsService = new AdminProductsService();

function valuesFor(input: ProductInput & { productCode: string }, user: SalesUser, updatedBy: string) {
  return [input.productCode, input.productName, input.description || null, input.shortDescription || null,
    input.image || null, input.packaging, input.uom, input.productType, input.displayOrder,
    input.isActive, input.unitWeightKg, input.isWhiteCement, user.id, updatedBy];
}
function mapProduct(row: ProductRow) {
  const prices = parsePriceRows(row.price_rows);
  return { id: row.id, productCode: row.product_code, productName: row.product_name,
    description: row.description, shortDescription: row.short_description, image: row.image,
    packaging: row.packaging_type, uom: row.uom, productType: row.category,
    displayOrder: row.display_order, isActive: row.is_active, unitWeightKg: Number(row.unit_weight_kg),
    isWhiteCement: row.is_white_cement, createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(), updatedBy: row.updated_by_name ?? 'Not recorded',
    priceSummary: {
      cityCount: Number(row.price_city_count ?? 0),
      minListPrice: row.min_list_price === null ? null : Number(row.min_list_price),
      prices,
    } };
}
function mapBagSize(row: BagSizeRow) {
  const unitWeightKg = Number(row.unit_weight_kg);
  return {
    id: row.id,
    unitWeightKg,
    label: `${formatWeight(unitWeightKg)} KG`,
  };
}
function formatWeight(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}
function parseFilters(raw?: string): ProductFilter[] {
  if (!raw) return [];
  try { return productFilterSchema.parse(JSON.parse(raw)); }
  catch { throw new AppError('Product filters are invalid.', 400, 'INVALID_PRODUCT_FILTERS'); }
}
function buildFilterGroup(filters: ProductFilter[], values: unknown[]) {
  const clauses = filters.map((filter) => buildFilter(filter, values));
  return `(${clauses.map((clause, index) => `${index ? filters[index]?.join ?? 'AND' : ''} ${clause}`).join(' ')})`;
}
function buildFilter(filter: ProductFilter, values: unknown[]) {
  const columns: Record<ProductFilter['field'], string> = {
    productCode: 'products.product_code', productName: 'products.product_name',
    packaging: 'products.packaging_type', uom: 'products.uom',
    status: 'products.is_active', unitWeightKg: 'products.unit_weight_kg', updatedAt: 'products.updated_at',
  };
  const column = columns[filter.field];
  let value: unknown = filter.value;
  if (filter.field === 'status' && filter.condition !== 'in') {
    value = String(value).toLowerCase() === 'active';
  }
  if (filter.condition === 'between') {
    const pair = Array.isArray(value) ? value : String(value).split(',');
    if (pair.length !== 2) throw new AppError('Between requires two values.', 400, 'INVALID_PRODUCT_FILTER');
    values.push(pair[0], pair[1]); return `${column} between $${values.length - 1} and $${values.length}`;
  }
  if (filter.condition === 'in') {
    const list = Array.isArray(value) ? value : String(value).split(',').map((item) => item.trim());
    if (filter.field === 'status') {
      values.push(list.map((item) => String(item).toLowerCase() === 'active'));
      return `${column} = any($${values.length}::boolean[])`;
    }
    values.push(list.map(String)); return `${column} = any($${values.length}::text[])`;
  }
  const textOperators = { contains: `%${value}%`, startsWith: `${value}%`, endsWith: `%${value}` };
  if (filter.condition in textOperators) { values.push(textOperators[filter.condition as keyof typeof textOperators]); return `${column} ilike $${values.length}`; }
  const operators: Record<string, string> = { equals: '=', notEquals: '<>', greaterThan: '>', greaterThanOrEqual: '>=', lessThan: '<', lessThanOrEqual: '<=', before: '<', after: '>' };
  values.push(value); return `${column} ${operators[filter.condition] ?? '='} $${values.length}`;
}
async function event(client: PoolClient, productId: string, action: string, userId: string, previous: unknown, next: unknown) {
  await client.query(
    `insert into internal_logistics_events
       (entity_type, entity_id, event_type, changed_by_sales_user_id, old_value, new_value)
     values ('PRODUCT', $1, $2, $3, $4, $5)`,
    [productId, action, userId, previous, next],
  );
}
function normalizeWriteError(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && error.code === '23505') return new AppError('Product code already exists.', 409, 'PRODUCT_CODE_EXISTS');
  return error;
}
function writeFailed() { return new AppError('Product could not be saved.', 500, 'PRODUCT_WRITE_FAILED'); }
function parsePriceRows(value: ProductRow['price_rows']) {
  if (!value) return [];
  const parsed = typeof value === 'string' ? JSON.parse(value) as Array<{ city: string; listPrice: number }> : value;
  return parsed.map((price) => ({ city: price.city, listPrice: Number(price.listPrice) }));
}
async function generateProductCode(client: PoolClient, input: ProductInput) {
  const words = input.productName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const namePart = (words.length > 1 ? words.map((word) => word[0]).join('') : words[0] ?? 'PRODUCT')
    .slice(0, 10);
  const packagingPart = input.packaging.toUpperCase().includes('BULK')
    ? 'BULK'
    : String(input.unitWeightKg).replace(/\.0+$/, '').replace(/\D/g, '') + 'KG';
  const base = `CEM-${namePart || 'PRODUCT'}-${packagingPart}`;

  for (let index = 0; index < 100; index += 1) {
    const code = index === 0 ? base : `${base}-${index + 1}`;
    const exists = await client.query('select 1 from product_catalog where product_code = $1', [code]);
    if (!exists.rowCount) return code;
  }

  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}
