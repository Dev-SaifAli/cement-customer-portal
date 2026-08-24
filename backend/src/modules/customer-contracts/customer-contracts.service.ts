import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type { ListCustomerContractsQuery } from './customer-contracts.validation.js';

interface CustomerContractRow {
  id: string;
  reference: string | null;
  quotation_id: string | null;
  quotation_reference: string | null;
  customer_account_id: string;
  product_code: string | null;
  product_name: string | null;
  packaging: string;
  uom: string;
  quantity: string;
  fulfilment: 'PICKUP' | 'DELIVERY';
  pickup_location_id: string | null;
  delivery_location_id: string | null;
  delivery_city: string | null;
  registration_delivery_locations: unknown;
  start_date: Date | string;
  end_date: Date | string;
  total_quantity_tons: string | null;
  shipped_quantity_tons: string;
  remaining_quantity_tons: string | null;
  product_price: string;
  delivery_price: string | null;
  subtotal: string | null;
  vat_rate: string | null;
  vat_amount: string | null;
  grand_total: string | null;
  payment_terms: string | null;
  commercial_notes: string | null;
  customer_notes: string | null;
  items_snapshot: unknown;
  status: 'ACTIVE';
  activated_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface DeliveryLocation {
  id?: string;
  name?: string;
  city?: string;
  region?: string;
}

const pageSize = 10;

export class CustomerContractsService {
  async list(customerUser: CustomerUser, query: ListCustomerContractsQuery) {
    const values: unknown[] = [customerUser.customerAccountId];
    const filters = [`contracts.customer_account_id = $1`, `contracts.status = 'ACTIVE'`];

    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      filters.push(`(
        lower(coalesce(contracts.reference, '')) like $${values.length}
        or lower(coalesce(product_catalog.product_code, '')) like $${values.length}
        or lower(coalesce(product_catalog.product_name, '')) like $${values.length}
      )`);
    }

    if (query.product) {
      values.push(`%${query.product.toLowerCase()}%`);
      filters.push(`(
        lower(coalesce(product_catalog.product_code, '')) like $${values.length}
        or lower(coalesce(product_catalog.product_name, '')) like $${values.length}
      )`);
    }

    if (query.date) {
      values.push(query.date);
      filters.push(`contracts.start_date <= $${values.length} and contracts.end_date >= $${values.length}`);
    }

    const where = `where ${filters.join(' and ')}`;
    const countResult = await pool.query<{ total: string }>(
      `select count(*)::text as total
       from contracts
       inner join product_catalog on product_catalog.id = contracts.product_id
       ${where}`,
      values,
    );
    const offset = (query.page - 1) * pageSize;
    const listValues = [...values, pageSize, offset];
    const result = await pool.query<CustomerContractRow>(
      `${customerContractSelectSql}
       ${where}
       order by contracts.activated_at desc nulls last, contracts.updated_at desc
       limit $${listValues.length - 1}
       offset $${listValues.length}`,
      listValues,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);
    return {
      items: result.rows.map(mapCustomerContractSummary),
      pagination: {
        page: query.page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getById(customerUser: CustomerUser, id: string) {
    const result = await pool.query<CustomerContractRow>(
      `${customerContractSelectSql}
       where contracts.id = $1
         and contracts.customer_account_id = $2
         and contracts.status = 'ACTIVE'`,
      [id, customerUser.customerAccountId],
    );

    const contract = result.rows[0];
    if (!contract) {
      throw new AppError('Contract was not found.', 404, 'CUSTOMER_CONTRACT_NOT_FOUND');
    }

    return mapCustomerContractDetails(contract);
  }
}

export const customerContractsService = new CustomerContractsService();

const customerContractSelectSql = `select
  contracts.*,
  registration_drafts.delivery_locations as registration_delivery_locations,
  product_catalog.product_code,
  product_catalog.product_name
 from contracts
 inner join customer_accounts on customer_accounts.id = contracts.customer_account_id
 inner join registration_drafts on registration_drafts.id = customer_accounts.registration_id
 inner join product_catalog on product_catalog.id = contracts.product_id`;

function mapCustomerContractSummary(row: CustomerContractRow) {
  const deliveryLocation = resolveDeliveryLocation(row);

  return {
    id: row.id,
    reference: row.reference,
    sourceQuotation: row.quotation_id
      ? {
          id: row.quotation_id,
          reference: row.quotation_reference,
        }
      : null,
    productCode: row.product_code,
    productName: row.product_name,
    packaging: row.packaging,
    uom: row.uom,
    fulfilment: row.fulfilment,
    haderCity: row.delivery_city,
    pickupLocation: row.pickup_location_id
      ? {
          id: row.pickup_location_id,
          name: row.pickup_location_id === 'ALSAFWA_PLANT_MAIN' ? 'AlSafwa Cement Plant' : row.pickup_location_id,
          city: row.pickup_location_id === 'ALSAFWA_PLANT_MAIN' ? 'Jeddah' : null,
        }
      : null,
    shipTo: deliveryLocation
      ? {
          id: deliveryLocation.id ?? null,
          name: deliveryLocation.name ?? null,
          city: deliveryLocation.city ?? null,
          region: deliveryLocation.region ?? null,
        }
      : null,
    totalQuantityTons: nullableNumber(row.total_quantity_tons) ?? Number(row.quantity),
    shippedQuantityTons: nullableNumber(row.shipped_quantity_tons) ?? 0,
    remainingQuantityTons:
      nullableNumber(row.remaining_quantity_tons) ??
      nullableNumber(row.total_quantity_tons) ??
      Number(row.quantity),
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    status: row.status,
    customerRate: Number(row.product_price) + Number(row.delivery_price ?? 0),
    activatedAt: row.activated_at ? dateTime(row.activated_at) : null,
  };
}

function mapCustomerContractDetails(row: CustomerContractRow) {
  return {
    ...mapCustomerContractSummary(row),
    quantity: Number(row.quantity),
    subtotal: nullableNumber(row.subtotal),
    vatRate: nullableNumber(row.vat_rate),
    vatAmount: nullableNumber(row.vat_amount),
    grandTotal: nullableNumber(row.grand_total),
    paymentTerms: row.payment_terms,
    commercialNotes: row.commercial_notes,
    customerNotes: row.customer_notes,
    items: parseItemsSnapshot(row.items_snapshot).map(toCustomerSafeItem),
    createdAt: dateTime(row.created_at),
    updatedAt: dateTime(row.updated_at),
  };
}

function toCustomerSafeItem(item: Record<string, unknown>) {
  return {
    productCode: stringValue(item.productCode),
    productName: stringValue(item.productName),
    packagingType: stringValue(item.packagingType),
    uom: stringValue(item.uom),
    quantity: numberValue(item.quantity),
    equivalentTons: numberValue(item.equivalentTons),
    customerRate: numberValue(item.customerRate),
    amount: numberValue(item.amount),
  };
}

function parseItemsSnapshot(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function resolveDeliveryLocation(row: CustomerContractRow) {
  if (row.fulfilment !== 'DELIVERY' || !row.delivery_location_id) return null;
  return (
    parseDeliveryLocations(row.registration_delivery_locations).find(
      (location) => location.id === row.delivery_location_id,
    ) ?? null
  );
}

function parseDeliveryLocations(value: unknown): DeliveryLocation[] {
  if (Array.isArray(value)) return value as DeliveryLocation[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as DeliveryLocation[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function numberValue(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function dateTime(value: Date | string) {
  return new Date(String(value)).toISOString();
}

function dateOnly(value: Date | string) {
  return new Date(String(value)).toISOString().slice(0, 10);
}
