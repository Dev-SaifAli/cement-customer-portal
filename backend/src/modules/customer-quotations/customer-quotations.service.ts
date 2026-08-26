import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import { customerLocationsService } from '../customer-locations/customer-locations.service.js';
import {
  COMMERCIAL_UOM,
  packagingQuantityFromTons,
} from '../products/commercial-quantity.js';
import type {
  CustomerQuotationPayload,
  ListCustomerQuotationsQuery,
} from './customer-quotations.validation.js';
import type pg from 'pg';

const writableRoles = new Set<CustomerUser['role']>(['CUSTOMER_ADMIN', 'PURCHASER']);
const customerQuotationPageSize = 10;

const pickupLocations = [
  {
    id: 'ALSAFWA_PLANT_MAIN',
    name: 'AlSafwa Cement Plant',
    city: 'Jeddah',
    region: 'Makkah',
  },
];

interface QuotationRow {
  id: string;
  customer_account_id: string;
  pricing_city_id: string | null;
  reference: string | null;
  status: QuotationStatus;
  fulfilment_type: FulfilmentType;
  pickup_location_id: string | null;
  ship_to_location_id: string | null;
  requested_date: Date | string | null;
  notes: string | null;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  valid_until: Date | string | null;
  payment_terms: string | null;
  commercial_notes: string | null;
  subtotal: string | null;
  vat_rate: string | null;
  vat_amount: string | null;
  grand_total: string | null;
  item_count?: string;
}

interface ProductRow {
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
}

interface QuotationItemRow {
  id: string;
  quotation_id: string;
  product_id: string;
  packaging_type: string;
  uom: string;
  quantity: string;
  quantity_tons: string;
  packaging_quantity: string | null;
  pallet_required: boolean;
  pallet_type: string | null;
  pallet_quantity: number | null;
  display_order: number;
  product_code: string;
  product_name: string;
  description: string | null;
  short_description: string | null;
  image: string | null;
  category: string;
  unit_weight_kg: string;
  equivalent_tons: string;
  discount_amount_per_ton: string | null;
  customer_rate: string | null;
  amount: string | null;
}

type FulfilmentType = 'PICKUP' | 'DELIVERY';
type QuotationStatus =
  | 'DRAFT'
  | 'PENDING_SALES_REVIEW'
  | 'UNDER_REVIEW'
  | 'PENDING_HADER_APPROVAL'
  | 'PENDING_PRICE_APPROVAL'
  | 'READY_FOR_CUSTOMER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CLARIFICATION_REQUESTED';

export class CustomerQuotationsService {
  getPickupLocations() {
    return pickupLocations;
  }

  async list(customerUser: CustomerUser, query: ListCustomerQuotationsQuery) {
    const offset = (query.page - 1) * customerQuotationPageSize;
    const locations = await customerLocationsService.listLocations(customerUser);
    const values: unknown[] = [customerUser.account.id];
    const conditions = ['customer_quotations.customer_account_id = $1'];

    const addCondition = (condition: string, value: unknown) => {
      values.push(value);
      conditions.push(condition.replace('?', `$${values.length}`));
    };

    if (query.reference) {
      addCondition('customer_quotations.reference ilike ?', `%${query.reference}%`);
    }
    if (query.createdDate) {
      addCondition('customer_quotations.created_at::date = ?::date', query.createdDate);
    }
    if (query.requestedDate) {
      addCondition('customer_quotations.requested_date = ?::date', query.requestedDate);
    }
    if (query.fulfilmentType) {
      addCondition('customer_quotations.fulfilment_type = ?', query.fulfilmentType);
    }
    if (query.status) {
      addCondition('customer_quotations.status = ?', query.status);
    }
    if (query.deliveryLocation) {
      const search = query.deliveryLocation.toLocaleLowerCase();
      const shipToIds = locations
        .filter((location) =>
          [location.name, location.city, location.region, location.streetAddress].some((value) =>
            value.toLocaleLowerCase().includes(search),
          ),
        )
        .map((location) => location.id);
      const pickupIds = pickupLocations
        .filter((location) =>
          [location.name, location.city, location.region].some((value) =>
            value.toLocaleLowerCase().includes(search),
          ),
        )
        .map((location) => location.id);
      values.push(shipToIds, pickupIds);
      conditions.push(
        `(customer_quotations.ship_to_location_id = any($${values.length - 1}::text[])
          or customer_quotations.pickup_location_id = any($${values.length}::text[]))`,
      );
    }

    const whereClause = conditions.join('\n         and ');
    const countResult = await pool.query<{ total: string }>(
      `select count(*)::text as total
       from customer_quotations
       where ${whereClause}`,
      values,
    );

    const listValues = [...values, customerQuotationPageSize, offset];
    const result = await pool.query<QuotationRow>(
      `select customer_quotations.*,
              count(customer_quotation_items.id)::text as item_count
       from customer_quotations
       left join customer_quotation_items
         on customer_quotation_items.quotation_id = customer_quotations.id
       where ${whereClause}
       group by customer_quotations.id
       order by customer_quotations.updated_at desc
       limit $${listValues.length - 1}
       offset $${listValues.length}`,
      listValues,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map((quotation) => mapQuotationSummary(quotation, locations)),
      pagination: {
        page: query.page,
        pageSize: customerQuotationPageSize,
        total,
        totalPages: Math.ceil(total / customerQuotationPageSize),
      },
    };
  }

  async create(customerUser: CustomerUser, payload: CustomerQuotationPayload) {
    requireWritableRole(customerUser);
    const { pricingCityKey } = await this.validateRelatedData(customerUser, payload);

    const client = await pool.connect();

    try {
      await client.query('begin');
      const reference = await this.nextReference(client);
      const result = await client.query<QuotationRow>(
        `insert into customer_quotations (
           customer_account_id,
           reference,
           fulfilment_type,
           pickup_location_id,
           ship_to_location_id,
           requested_date,
           notes,
           pricing_city_id
         )
         values ($1, $2, $3, $4, $5, $6, $7,
           (select id from ksa_cities where name_key = $8 and is_active = true limit 1))
         returning *`,
        [
          customerUser.account.id,
          reference,
          payload.fulfilmentType,
          payload.pickupLocationId ?? null,
          payload.shipToLocationId ?? null,
          payload.requestedDate ?? null,
          payload.notes ?? null,
          pricingCityKey,
        ],
      );

      const quotation = result.rows[0];
      if (!quotation) {
        throw new AppError('Quotation draft could not be created.', 503, 'QUOTATION_CREATE_FAILED');
      }

      await this.replaceItems(client, quotation.id, payload);
      await client.query('commit');

      return this.getById(customerUser, quotation.id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async update(customerUser: CustomerUser, quotationId: string, payload: CustomerQuotationPayload) {
    requireWritableRole(customerUser);
    const { pricingCityKey } = await this.validateRelatedData(customerUser, payload);

    const client = await pool.connect();

    try {
      await client.query('begin');
      const current = await this.getScopedQuotationForUpdate(client, customerUser, quotationId);
      if (current.status !== 'DRAFT') {
        throw new AppError('Only draft quotations can be updated.', 409, 'QUOTATION_NOT_EDITABLE');
      }

      const result = await client.query<QuotationRow>(
        `update customer_quotations
         set fulfilment_type = $3,
             pickup_location_id = $4,
             ship_to_location_id = $5,
             requested_date = $6,
             notes = $7,
             pricing_city_id = (
               select id from ksa_cities where name_key = $8 and is_active = true limit 1
             ),
             updated_at = now()
         where id = $2
           and customer_account_id = $1
         returning *`,
        [
          customerUser.account.id,
          quotationId,
          payload.fulfilmentType,
          payload.pickupLocationId ?? null,
          payload.shipToLocationId ?? null,
          payload.requestedDate ?? null,
          payload.notes ?? null,
          pricingCityKey,
        ],
      );

      const quotation = result.rows[0];
      if (!quotation) {
        throw quotationNotFoundError();
      }

      await this.replaceItems(client, quotation.id, payload);
      await client.query('commit');

      return this.getById(customerUser, quotation.id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async submit(customerUser: CustomerUser, quotationId: string) {
    requireWritableRole(customerUser);
    const client = await pool.connect();

    try {
      await client.query('begin');
      const current = await this.getScopedQuotationForUpdate(client, customerUser, quotationId);
      if (current.status !== 'DRAFT') {
        throw new AppError(
          'Only draft quotations can be submitted.',
          409,
          'QUOTATION_NOT_SUBMITTABLE',
        );
      }

      const itemCount = await client.query<{ total: string }>(
        `select count(*)::text as total
         from customer_quotation_items
         where quotation_id = $1`,
        [quotationId],
      );

      if (Number(itemCount.rows[0]?.total ?? 0) === 0) {
        throw new AppError('At least one product is required.', 400, 'QUOTATION_ITEMS_REQUIRED');
      }

      const reference = current.reference ?? (await this.nextReference(client));
      const result = await client.query<QuotationRow>(
        `update customer_quotations
         set status = 'PENDING_SALES_REVIEW',
             reference = coalesce(reference, $3),
             submitted_at = now(),
             updated_at = now()
         where id = $2
           and customer_account_id = $1
         returning *`,
        [customerUser.account.id, quotationId, reference],
      );

      const quotation = result.rows[0];
      if (!quotation) {
        throw quotationNotFoundError();
      }

      await client.query(
        `insert into quotation_status_events (
           quotation_id,
           previous_status,
           new_status,
           action,
           changed_by_customer_user_id
         )
         values ($1, 'DRAFT', 'PENDING_SALES_REVIEW', 'CUSTOMER_SUBMITTED', $2)`,
        [quotationId, customerUser.id],
      );

      await client.query('commit');
      return this.getById(customerUser, quotation.id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async accept(customerUser: CustomerUser, quotationId: string) {
    return this.recordCustomerDecision(customerUser, quotationId, 'ACCEPTED', 'CUSTOMER_ACCEPTED');
  }

  async reject(customerUser: CustomerUser, quotationId: string, reason: string) {
    return this.recordCustomerDecision(
      customerUser,
      quotationId,
      'REJECTED',
      'CUSTOMER_REJECTED',
      reason,
    );
  }

  async requestClarification(customerUser: CustomerUser, quotationId: string, reason: string) {
    return this.recordCustomerDecision(
      customerUser,
      quotationId,
      'CLARIFICATION_REQUESTED',
      'CUSTOMER_CLARIFICATION_REQUESTED',
      reason,
    );
  }

  async getById(customerUser: CustomerUser, quotationId: string) {
    const result = await pool.query<QuotationRow>(
      `select *
       from customer_quotations
       where id = $2
         and customer_account_id = $1
       limit 1`,
      [customerUser.account.id, quotationId],
    );

    const quotation = result.rows[0];
    if (!quotation) {
      throw quotationNotFoundError();
    }

    const items = await this.getItems(quotation.id);
    const locations = await customerLocationsService.listLocations(customerUser);

    return mapQuotation(quotation, items, locations);
  }

  private async validateRelatedData(customerUser: CustomerUser, payload: CustomerQuotationPayload) {
    let pricingCity: string;
    if (
      payload.fulfilmentType === 'PICKUP' &&
      !pickupLocations.some((location) => location.id === payload.pickupLocationId)
    ) {
      throw new AppError('Pickup location was not found.', 400, 'PICKUP_LOCATION_NOT_FOUND');
    }

    const locations = await customerLocationsService.listLocations(customerUser);
    if (payload.fulfilmentType === 'PICKUP') {
      pricingCity = pickupLocations.find(
        (location) => location.id === payload.pickupLocationId,
      )!.city;
    } else {
      const shipTo = locations.find((location) => location.id === payload.shipToLocationId);
      if (!shipTo) {
        throw new AppError('Ship-to location was not found.', 400, 'SHIP_TO_LOCATION_NOT_FOUND');
      }
      pricingCity = shipTo.city;
    }

    const productIds = Array.from(new Set(payload.items.map((item) => item.productId)));
    const result = await pool.query<ProductRow>(
      `select id, product_code, product_name, description, short_description, image,
              packaging_type, uom, unit_weight_kg, commercial_uom, category
       from product_catalog
       where id = any($1::uuid[])
         and is_active = true`,
      [productIds],
    );

    if (result.rows.length !== productIds.length) {
      throw new AppError('One or more products are unavailable.', 400, 'PRODUCT_UNAVAILABLE');
    }

    const productById = new Map(result.rows.map((product) => [product.id, product]));
    payload.items.forEach((item, index) => {
      const product = productById.get(item.productId);
      if (!product) return;

      const isBag = product.packaging_type.toLowerCase().includes('bag');
      if (!isBag && item.palletRequired) {
        throw new AppError(
          `Pallets are only available for bag products at item ${index + 1}.`,
          400,
          'PALLET_NOT_ALLOWED',
        );
      }
    });

    return { pricingCityKey: normalizeCity(pricingCity) };
  }

  private async recordCustomerDecision(
    customerUser: CustomerUser,
    quotationId: string,
    newStatus: Extract<QuotationStatus, 'ACCEPTED' | 'REJECTED' | 'CLARIFICATION_REQUESTED'>,
    action: string,
    reason: string | null = null,
  ) {
    requireQuotationDecisionRole(customerUser);
    const client = await pool.connect();

    try {
      await client.query('begin');
      const current = await this.getScopedQuotationForUpdate(client, customerUser, quotationId);
      if (current.status !== 'READY_FOR_CUSTOMER') {
        throw new AppError(
          'This quotation is no longer awaiting your decision.',
          409,
          'CUSTOMER_QUOTATION_DECISION_CONFLICT',
        );
      }

      await client.query(
        `update customer_quotations
         set status = $3, updated_at = now()
         where customer_account_id = $1 and id = $2`,
        [customerUser.account.id, quotationId, newStatus],
      );
      await client.query(
        `insert into quotation_status_events (
           quotation_id, previous_status, new_status, action, reason,
           changed_by_customer_user_id
         ) values ($1, 'READY_FOR_CUSTOMER', $2, $3, $4, $5)`,
        [quotationId, newStatus, action, reason, customerUser.id],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    return this.getById(customerUser, quotationId);
  }

  private async replaceItems(
    client: pg.PoolClient,
    quotationId: string,
    payload: CustomerQuotationPayload,
  ) {
    const productIds = Array.from(new Set(payload.items.map((item) => item.productId)));
    const productResult = await client.query<ProductRow>(
      `select id, product_code, product_name, description, short_description, image,
              packaging_type, uom, category
       from product_catalog
       where id = any($1::uuid[])
         and is_active = true`,
      [productIds],
    );
    const productById = new Map(productResult.rows.map((product) => [product.id, product]));

    await client.query('delete from customer_quotation_items where quotation_id = $1', [
      quotationId,
    ]);

    for (const [index, item] of payload.items.entries()) {
      const product = productById.get(item.productId);
      if (!product) {
        throw new AppError('One or more products are unavailable.', 400, 'PRODUCT_UNAVAILABLE');
      }

      const quantityTons = item.quantityTon;
      const packagingQuantity = packagingQuantityFromTons(
        quantityTons,
        Number(product.unit_weight_kg),
        product.uom,
      );
      const legacyQuantity = packagingQuantity ?? quantityTons;

      await client.query(
        `insert into customer_quotation_items (
           quotation_id,
           product_id,
           packaging_type,
           uom,
           quantity,
           quantity_tons,
           packaging_quantity,
           pallet_required,
           pallet_type,
           pallet_quantity,
           display_order
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          quotationId,
          item.productId,
          product.packaging_type,
          product.uom,
          legacyQuantity,
          quantityTons,
          packagingQuantity,
          item.palletRequired,
          item.palletRequired ? (item.palletType ?? null) : null,
          item.palletRequired ? (item.palletQuantity ?? null) : null,
          index,
        ],
      );
    }
  }

  private async getScopedQuotationForUpdate(
    client: pg.PoolClient,
    customerUser: CustomerUser,
    quotationId: string,
  ) {
    const result = await client.query<QuotationRow>(
      `select *
       from customer_quotations
       where id = $2
         and customer_account_id = $1
       for update`,
      [customerUser.account.id, quotationId],
    );

    const row = result.rows[0];
    if (!row) {
      throw quotationNotFoundError();
    }

    return row;
  }

  private async getItems(quotationId: string) {
    const result = await pool.query<QuotationItemRow>(
      `select
         customer_quotation_items.*,
         product_catalog.product_code,
         product_catalog.product_name,
         product_catalog.description,
         product_catalog.short_description,
         product_catalog.image,
         product_catalog.category,
         product_catalog.unit_weight_kg,
         customer_quotation_items.quantity_tons as equivalent_tons
       from customer_quotation_items
       inner join product_catalog
         on product_catalog.id = customer_quotation_items.product_id
       where customer_quotation_items.quotation_id = $1
       order by customer_quotation_items.display_order asc`,
      [quotationId],
    );

    return result.rows;
  }

  private async nextReference(client: pg.PoolClient) {
    const result = await client.query<{ sequence: string }>(
      `select nextval('customer_quotation_reference_seq')::text as sequence`,
    );
    const sequence = String(result.rows[0]?.sequence ?? '1').padStart(6, '0');

    return `QT-${new Date().getFullYear()}-${sequence}`;
  }
}

export const customerQuotationsService = new CustomerQuotationsService();

function requireWritableRole(customerUser: CustomerUser) {
  if (!writableRoles.has(customerUser.role)) {
    throw new AppError(
      'You do not have permission to manage quotations.',
      403,
      'CUSTOMER_QUOTATION_FORBIDDEN',
    );
  }
}

function requireQuotationDecisionRole(customerUser: CustomerUser) {
  if (customerUser.role !== 'CUSTOMER_ADMIN') {
    throw new AppError(
      'Only a Customer Administrator can approve quotation decisions.',
      403,
      'CUSTOMER_QUOTATION_DECISION_FORBIDDEN',
    );
  }
}

function quotationNotFoundError() {
  return new AppError('Quotation was not found.', 404, 'CUSTOMER_QUOTATION_NOT_FOUND');
}

function mapQuotation(
  quotation: QuotationRow,
  items: QuotationItemRow[],
  locations: Awaited<ReturnType<typeof customerLocationsService.listLocations>>,
) {
  const commercialTermsVisible = [
    'READY_FOR_CUSTOMER',
    'ACCEPTED',
    'REJECTED',
    'CLARIFICATION_REQUESTED',
  ].includes(quotation.status);
  const shipToLocation = locations.find(
    (location) => location.id === quotation.ship_to_location_id,
  );
  const pickupLocation =
    pickupLocations.find((location) => location.id === quotation.pickup_location_id) ?? null;

  return {
    id: quotation.id,
    reference: quotation.reference,
    status: quotation.status,
    fulfilmentType: quotation.fulfilment_type,
    pickupLocationId: quotation.pickup_location_id,
    pickupLocation,
    shipToLocationId: quotation.ship_to_location_id,
    shipToLocation: shipToLocation ?? null,
    requestedDate: quotation.requested_date ? dateOnly(quotation.requested_date) : null,
    notes: quotation.notes,
    submittedAt: quotation.submitted_at ? dateTime(quotation.submitted_at) : null,
    createdAt: dateTime(quotation.created_at),
    updatedAt: dateTime(quotation.updated_at),
    validUntil:
      commercialTermsVisible && quotation.valid_until ? dateOnly(quotation.valid_until) : null,
    paymentTerms: commercialTermsVisible ? quotation.payment_terms : null,
    commercialNotes: commercialTermsVisible ? quotation.commercial_notes : null,
    subtotal: commercialTermsVisible ? nullableNumber(quotation.subtotal) : null,
    vatRate: commercialTermsVisible ? nullableNumber(quotation.vat_rate) : null,
    vatAmount: commercialTermsVisible ? nullableNumber(quotation.vat_amount) : null,
    grandTotal: commercialTermsVisible ? nullableNumber(quotation.grand_total) : null,
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      product: {
        id: item.product_id,
        productCode: item.product_code,
        productName: item.product_name,
        description: item.description,
        shortDescription: item.short_description,
        image: item.image,
        packagingType: item.packaging_type,
        uom: item.uom,
        unitWeightKg: Number(item.unit_weight_kg),
        commercialUom: COMMERCIAL_UOM,
        category: item.category,
      },
      packagingType: item.packaging_type,
      uom: item.uom,
      quantity: Number(item.quantity_tons),
      quantityTon: Number(item.quantity_tons),
      packagingQuantity:
        item.packaging_quantity === null ? null : Number(item.packaging_quantity),
      commercialUom: COMMERCIAL_UOM,
      unitWeightKg: Number(item.unit_weight_kg),
      equivalentTons: Number(item.equivalent_tons),
      palletRequired: item.pallet_required,
      palletType: item.pallet_type,
      palletQuantity: item.pallet_quantity,
      customerRate: commercialTermsVisible ? nullableNumber(item.customer_rate) : null,
      amount: commercialTermsVisible ? nullableNumber(item.amount) : null,
      commercialDiscountApplied:
        commercialTermsVisible && nullableNumber(item.discount_amount_per_ton) !== null
          ? (nullableNumber(item.discount_amount_per_ton) ?? 0) > 0
          : false,
    })),
  };
}

function mapQuotationSummary(
  quotation: QuotationRow,
  locations: Awaited<ReturnType<typeof customerLocationsService.listLocations>>,
) {
  const shipToLocation = locations.find(
    (location) => location.id === quotation.ship_to_location_id,
  );
  const pickupLocation = pickupLocations.find(
    (location) => location.id === quotation.pickup_location_id,
  );

  return {
    id: quotation.id,
    reference: quotation.reference,
    status: quotation.status,
    fulfilmentType: quotation.fulfilment_type,
    deliveryLocation: shipToLocation?.name ?? pickupLocation?.name ?? null,
    requestedDate: quotation.requested_date ? dateOnly(quotation.requested_date) : null,
    itemCount: Number(quotation.item_count ?? 0),
    submittedAt: quotation.submitted_at ? dateTime(quotation.submitted_at) : null,
    createdAt: dateTime(quotation.created_at),
    updatedAt: dateTime(quotation.updated_at),
  };
}

function dateTime(value: Date | string) {
  return new Date(String(value)).toISOString();
}

function dateOnly(value: Date | string) {
  return new Date(String(value)).toISOString().slice(0, 10);
}

function normalizeCity(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function nullableNumber(value: string | null) {
  return value === null ? null : Number(value);
}
