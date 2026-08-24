import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesRole, SalesUser } from '../sales-auth/sales-auth.types.js';
import type {
  ListSalesQuotationsQuery,
  SalesQuotationPricingPayload,
} from './sales-quotations.validation.js';
import type { PoolClient } from 'pg';

const pageSize = 10;
const pickupLocations = [
  { id: 'ALSAFWA_PLANT_MAIN', name: 'AlSafwa Cement Plant', city: 'Jeddah', region: 'Makkah' },
];

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
type ApprovalStatus = 'NOT_REQUIRED' | 'REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface QuotationRow {
  id: string;
  reference: string | null;
  customer_account_id: string;
  customer_company_name: string;
  status: QuotationStatus;
  fulfilment_type: 'PICKUP' | 'DELIVERY';
  pickup_location_id: string | null;
  ship_to_location_id: string | null;
  requested_date: string | Date | null;
  notes: string | null;
  submitted_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  valid_until: string | Date | null;
  payment_terms: string | null;
  commercial_notes: string | null;
  subtotal: string | null;
  vat_rate: string | null;
  vat_amount: string | null;
  grand_total: string | null;
  product_price_changed: boolean;
  delivery_price_changed: boolean;
  hader_approval_status: ApprovalStatus;
  price_approval_status: ApprovalStatus;
  contact: Record<string, unknown> | null;
  delivery_locations: Array<Record<string, unknown>> | null;
  item_count?: string;
}

interface ItemRow {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  product_image: string | null;
  quantity: string;
  uom: string;
  packaging_type: string;
  product_list_price: string | null;
  product_price: string | null;
  delivery_list_price: string | null;
  delivery_price: string | null;
  customer_rate: string | null;
  amount: string | null;
  catalog_list_price: string | null;
  catalog_delivery_list_price: string | null;
}

interface EventRow {
  id: string;
  previous_status: QuotationStatus | null;
  new_status: QuotationStatus;
  action: string;
  reason: string | null;
  changed_by_sales_user_id: string | null;
  changed_by_customer_user_id: string | null;
  sales_user_name: string | null;
  customer_user_name: string | null;
  created_at: string | Date;
}

const quotationSelect = `
  select quotations.*,
         accounts.company_name as customer_company_name,
         registrations.contact,
         registrations.delivery_locations
  from customer_quotations quotations
  inner join customer_accounts accounts on accounts.id = quotations.customer_account_id
  inner join registration_drafts registrations on registrations.id = accounts.registration_id`;

export class SalesQuotationsService {
  async list(query: ListSalesQuotationsQuery) {
    const values: unknown[] = [];
    const conditions = [`quotations.status <> 'DRAFT'`];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      conditions.push(sql.replace('?', `$${values.length}`));
    };

    if (query.reference) add('quotations.reference ilike ?', `%${query.reference}%`);
    if (query.customer) add('accounts.company_name ilike ?', `%${query.customer}%`);
    if (query.submittedDate) add('quotations.submitted_at::date = ?::date', query.submittedDate);
    if (query.fulfilmentType) add('quotations.fulfilment_type = ?', query.fulfilmentType);
    if (query.status) add('quotations.status = ?', query.status);

    const where = conditions.join(' and ');
    const count = await pool.query<{ total: string }>(
      `select count(*)::text as total
       from customer_quotations quotations
       inner join customer_accounts accounts on accounts.id = quotations.customer_account_id
       where ${where}`,
      values,
    );
    const offset = (query.page - 1) * pageSize;
    const listValues = [...values, pageSize, offset];
    const result = await pool.query<QuotationRow>(
      `${quotationSelect}
       where ${where}
       order by coalesce(quotations.submitted_at, quotations.updated_at) desc
       limit $${listValues.length - 1} offset $${listValues.length}`,
      listValues,
    );

    const ids = result.rows.map((row) => row.id);
    const counts = ids.length
      ? await pool.query<{ quotation_id: string; count: string }>(
          `select quotation_id, count(*)::text as count
           from customer_quotation_items where quotation_id = any($1::uuid[])
           group by quotation_id`,
          [ids],
        )
      : { rows: [] };
    const itemCount = new Map(counts.rows.map((row) => [row.quotation_id, Number(row.count)]));
    const total = Number(count.rows[0]?.total ?? 0);

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        customer: row.customer_company_name,
        submittedAt: iso(row.submitted_at),
        itemCount: itemCount.get(row.id) ?? 0,
        fulfilmentType: row.fulfilment_type,
        total: nullableNumber(row.grand_total),
        status: row.status,
      })),
      pagination: { page: query.page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getById(id: string, user: SalesUser) {
    const quotation = await this.getQuotation(id);
    const [items, events] = await Promise.all([this.getItems(id), this.getEvents(id)]);
    return this.mapDetails(quotation, items, events, user);
  }

  async startReview(id: string, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await this.lockQuotation(client, id);
      requireStatus(current, 'PENDING_SALES_REVIEW', 'Quotation is not pending Sales review.');
      await client.query(
        `update customer_quotation_items items
         set product_list_price = products.list_price,
             product_price = products.list_price,
             delivery_list_price = case when $2 = 'DELIVERY' then products.delivery_list_price else null end,
             delivery_price = case when $2 = 'DELIVERY' then products.delivery_list_price else null end,
             customer_rate = case
               when products.list_price is null then null
               when $2 = 'DELIVERY' and products.delivery_list_price is null then null
               when $2 = 'DELIVERY' then products.list_price + products.delivery_list_price
               else products.list_price
             end,
             amount = case
               when products.list_price is null then null
               when $2 = 'DELIVERY' and products.delivery_list_price is null then null
               when $2 = 'DELIVERY' then round(items.quantity * (products.list_price + products.delivery_list_price), 2)
               else round(items.quantity * products.list_price, 2)
             end,
             updated_at = now()
         from product_catalog products
         where items.quotation_id = $1 and products.id = items.product_id`,
        [id, current.fulfilment_type],
      );
      await client.query(
        `update customer_quotations
         set status = 'UNDER_REVIEW', updated_at = now()
         where id = $1`,
        [id],
      );
      await insertEvent(
        client,
        id,
        current.status,
        'UNDER_REVIEW',
        'SALES_STARTED_REVIEW',
        null,
        user.id,
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getById(id, user);
  }

  async updatePricing(id: string, payload: SalesQuotationPricingPayload, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await this.lockQuotation(client, id);
      requireStatus(current, 'UNDER_REVIEW', 'Pricing can only be updated while under review.');
      if (new Date(`${payload.validUntil}T23:59:59Z`).getTime() < Date.now()) {
        throw new AppError(
          'Quotation validity must be today or later.',
          400,
          'QUOTATION_VALIDITY_INVALID',
        );
      }

      const items = await this.getItemsForUpdate(client, id);
      if (items.length !== payload.items.length) {
        throw new AppError(
          'All quotation items must be priced.',
          400,
          'QUOTATION_PRICING_INCOMPLETE',
        );
      }
      const inputById = new Map(payload.items.map((item) => [item.id, item]));
      let subtotal = 0;
      let productChanged = false;
      let deliveryChanged = false;
      let valuesChanged = false;

      for (const item of items) {
        const input = inputById.get(item.id);
        if (!input)
          throw new AppError(
            'All quotation items must be priced.',
            400,
            'QUOTATION_PRICING_INCOMPLETE',
          );
        const productList = nullableNumber(item.product_list_price ?? item.catalog_list_price);
        const deliveryList = nullableNumber(
          item.delivery_list_price ?? item.catalog_delivery_list_price,
        );
        if (
          productList === null ||
          (current.fulfilment_type === 'DELIVERY' && deliveryList === null)
        ) {
          throw new AppError(
            `List pricing is not configured for ${item.product_code}.`,
            409,
            'QUOTATION_LIST_PRICE_NOT_CONFIGURED',
          );
        }
        const productPrice = money(input.productPrice);
        const deliveryPrice =
          current.fulfilment_type === 'DELIVERY' ? money(input.deliveryPrice ?? -1) : 0;
        if (deliveryPrice < 0) {
          throw new AppError(
            'Delivery price is required for delivery quotations.',
            400,
            'DELIVERY_PRICE_REQUIRED',
          );
        }
        const rate = money(productPrice + deliveryPrice);
        const amount = money(Number(item.quantity) * rate);
        subtotal = money(subtotal + amount);
        productChanged ||= !sameMoney(productPrice, productList);
        deliveryChanged ||=
          current.fulfilment_type === 'DELIVERY' && !sameMoney(deliveryPrice, deliveryList ?? 0);
        valuesChanged ||=
          !sameMoney(productPrice, nullableNumber(item.product_price)) ||
          (current.fulfilment_type === 'DELIVERY' &&
            !sameMoney(deliveryPrice, nullableNumber(item.delivery_price))) ||
          !sameMoney(amount, nullableNumber(item.amount));

        await client.query(
          `update customer_quotation_items
           set product_list_price = $2, product_price = $3,
               delivery_list_price = $4, delivery_price = $5,
               customer_rate = $6, amount = $7, updated_at = now()
           where id = $1 and quotation_id = $8`,
          [
            item.id,
            productList,
            productPrice,
            current.fulfilment_type === 'DELIVERY' ? deliveryList : null,
            current.fulfilment_type === 'DELIVERY' ? deliveryPrice : null,
            rate,
            amount,
            id,
          ],
        );
      }

      const vatRate = env.QUOTATION_VAT_RATE;
      const vatAmount = money(subtotal * vatRate);
      const grandTotal = money(subtotal + vatAmount);
      valuesChanged ||=
        payload.validUntil !== dateOnly(current.valid_until) ||
        payload.paymentTerms !== (current.payment_terms ?? '') ||
        payload.commercialNotes !== (current.commercial_notes ?? '');

      await client.query(
        `update customer_quotations
         set valid_until = $2, payment_terms = $3, commercial_notes = $4,
             subtotal = $5, vat_rate = $6, vat_amount = $7, grand_total = $8,
             product_price_changed = $9, delivery_price_changed = $10,
             hader_approval_status = $11, price_approval_status = $12, updated_at = now()
         where id = $1`,
        [
          id,
          payload.validUntil,
          payload.paymentTerms,
          payload.commercialNotes,
          subtotal,
          vatRate,
          vatAmount,
          grandTotal,
          productChanged,
          deliveryChanged,
          deliveryChanged ? 'REQUIRED' : 'NOT_REQUIRED',
          productChanged ? 'REQUIRED' : 'NOT_REQUIRED',
        ],
      );
      if (valuesChanged) {
        await insertEvent(
          client,
          id,
          current.status,
          current.status,
          'PRICING_UPDATED',
          null,
          user.id,
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getById(id, user);
  }

  async submitForApproval(id: string, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await this.lockQuotation(client, id);
      requireStatus(current, 'UNDER_REVIEW', 'Quotation is not ready for approval submission.');
      ensureCommercialComplete(current);
      if (!current.product_price_changed && !current.delivery_price_changed) {
        throw new AppError(
          'This quotation does not require approval.',
          409,
          'QUOTATION_APPROVAL_NOT_REQUIRED',
        );
      }
      const next: QuotationStatus = current.delivery_price_changed
        ? 'PENDING_HADER_APPROVAL'
        : 'PENDING_PRICE_APPROVAL';
      await client.query(
        `update customer_quotations
         set status = $2,
             hader_approval_status = case when delivery_price_changed then 'PENDING' else 'NOT_REQUIRED' end,
             price_approval_status = case
               when product_price_changed and delivery_price_changed then 'REQUIRED'
               when product_price_changed then 'PENDING'
               else 'NOT_REQUIRED'
             end,
             updated_at = now()
         where id = $1`,
        [id, next],
      );
      await insertEvent(
        client,
        id,
        current.status,
        next,
        'SUBMITTED_FOR_APPROVAL',
        approvalReason(current),
        user.id,
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getById(id, user);
  }

  async approve(id: string, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await this.lockQuotation(client, id);
      const approval = activeApproval(current, user.role);
      const next: QuotationStatus =
        approval === 'HADER' && current.price_approval_status === 'REQUIRED'
          ? 'PENDING_PRICE_APPROVAL'
          : 'UNDER_REVIEW';
      await client.query(
        `update customer_quotations
         set status = $2,
             hader_approval_status = case when $3 = 'HADER' then 'APPROVED' else hader_approval_status end,
             price_approval_status = case
               when $3 = 'PRICE' then 'APPROVED'
               when $3 = 'HADER' and price_approval_status = 'REQUIRED' then 'PENDING'
               else price_approval_status
             end,
             updated_at = now()
         where id = $1`,
        [id, next, approval],
      );
      await insertEvent(
        client,
        id,
        current.status,
        next,
        `${approval}_MANAGER_APPROVED`,
        null,
        user.id,
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getById(id, user);
  }

  async reject(id: string, reason: string, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await this.lockQuotation(client, id);
      const approval = activeApproval(current, user.role);
      await client.query(
        `update customer_quotations
         set status = 'UNDER_REVIEW',
             hader_approval_status = case when $2 = 'HADER' then 'REJECTED' else hader_approval_status end,
             price_approval_status = case when $2 = 'PRICE' then 'REJECTED' else price_approval_status end,
             updated_at = now()
         where id = $1`,
        [id, approval],
      );
      await insertEvent(
        client,
        id,
        current.status,
        'UNDER_REVIEW',
        `${approval}_MANAGER_REJECTED`,
        reason,
        user.id,
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getById(id, user);
  }

  async sendToCustomer(id: string, user: SalesUser) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await this.lockQuotation(client, id);
      requireStatus(current, 'UNDER_REVIEW', 'Quotation is not ready to send.');
      ensureCommercialComplete(current);
      if (!approvalsComplete(current)) {
        throw new AppError(
          'Required commercial approvals are incomplete.',
          409,
          'QUOTATION_APPROVAL_INCOMPLETE',
        );
      }
      await client.query(
        `update customer_quotations set status = 'READY_FOR_CUSTOMER', updated_at = now() where id = $1`,
        [id],
      );
      await insertEvent(
        client,
        id,
        current.status,
        'READY_FOR_CUSTOMER',
        'SENT_TO_CUSTOMER',
        null,
        user.id,
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getById(id, user);
  }

  private async getQuotation(id: string) {
    const result = await pool.query<QuotationRow>(
      `${quotationSelect} where quotations.id = $1 limit 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row || row.status === 'DRAFT') throw notFound();
    return row;
  }

  private async lockQuotation(client: PoolClient, id: string) {
    const result = await client.query<QuotationRow>(
      `select quotations.*, accounts.company_name as customer_company_name,
              registrations.contact, registrations.delivery_locations
       from customer_quotations quotations
       inner join customer_accounts accounts on accounts.id = quotations.customer_account_id
       inner join registration_drafts registrations on registrations.id = accounts.registration_id
       where quotations.id = $1 for update`,
      [id],
    );
    const row = result.rows[0];
    if (!row || row.status === 'DRAFT') throw notFound();
    return row;
  }

  private async getItems(id: string) {
    const result = await pool.query<ItemRow>(itemSelect, [id]);
    return result.rows;
  }

  private async getItemsForUpdate(client: PoolClient, id: string) {
    const result = await client.query<ItemRow>(`${itemSelect} for update of items`, [id]);
    return result.rows;
  }

  private async getEvents(id: string) {
    const result = await pool.query<EventRow>(
      `select events.*, sales.name as sales_user_name, customers.name as customer_user_name
       from quotation_status_events events
       left join sales_users sales on sales.id = events.changed_by_sales_user_id
       left join customer_users customers on customers.id = events.changed_by_customer_user_id
       where events.quotation_id = $1 order by events.created_at asc`,
      [id],
    );
    return result.rows;
  }

  private mapDetails(
    quotation: QuotationRow,
    items: ItemRow[],
    events: EventRow[],
    user: SalesUser,
  ) {
    const contact = quotation.contact ?? {};
    const destination = resolveDestination(quotation);
    const pricingComplete = Boolean(
      quotation.valid_until &&
      quotation.payment_terms &&
      items.length > 0 &&
      items.every((item) => item.amount !== null),
    );
    return {
      id: quotation.id,
      reference: quotation.reference,
      status: quotation.status,
      customer: {
        id: quotation.customer_account_id,
        companyName: quotation.customer_company_name,
        contactName: stringValue(contact.fullName) ?? stringValue(contact.name),
        email: stringValue(contact.workEmail) ?? stringValue(contact.email),
        phone: stringValue(contact.phone),
      },
      requestedDate: dateOnly(quotation.requested_date),
      fulfilmentType: quotation.fulfilment_type,
      destination,
      notes: quotation.notes,
      submittedAt: iso(quotation.submitted_at),
      createdAt: iso(quotation.created_at),
      updatedAt: iso(quotation.updated_at),
      validUntil: dateOnly(quotation.valid_until),
      paymentTerms: quotation.payment_terms,
      commercialNotes: quotation.commercial_notes,
      subtotal: nullableNumber(quotation.subtotal),
      vatRate: nullableNumber(quotation.vat_rate) ?? env.QUOTATION_VAT_RATE,
      vatAmount: nullableNumber(quotation.vat_amount),
      grandTotal: nullableNumber(quotation.grand_total),
      productPriceChanged: quotation.product_price_changed,
      deliveryPriceChanged: quotation.delivery_price_changed,
      approvals: {
        hader: quotation.hader_approval_status,
        price: quotation.price_approval_status,
      },
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productCode: item.product_code,
        productName: item.product_name,
        image: item.product_image,
        quantity: Number(item.quantity),
        uom: item.uom,
        packagingType: item.packaging_type,
        productListPrice: nullableNumber(item.product_list_price ?? item.catalog_list_price),
        productPrice: nullableNumber(item.product_price),
        deliveryListPrice: nullableNumber(
          item.delivery_list_price ?? item.catalog_delivery_list_price,
        ),
        deliveryPrice: nullableNumber(item.delivery_price),
        customerRate: nullableNumber(item.customer_rate),
        amount: nullableNumber(item.amount),
      })),
      events: events.map((event) => ({
        id: event.id,
        previousStatus: event.previous_status,
        newStatus: event.new_status,
        action: event.action,
        reason: event.reason,
        changedBy: event.sales_user_name ?? event.customer_user_name ?? 'Portal user',
        actorType: event.changed_by_sales_user_id ? 'SALES' : 'CUSTOMER',
        createdAt: iso(event.created_at),
      })),
      allowedActions: allowedActions(quotation, pricingComplete, user.role),
    };
  }
}

export const salesQuotationsService = new SalesQuotationsService();

const itemSelect = `
  select items.*, products.product_code, products.product_name, products.image as product_image,
         products.list_price as catalog_list_price,
         products.delivery_list_price as catalog_delivery_list_price
  from customer_quotation_items items
  inner join product_catalog products on products.id = items.product_id
  where items.quotation_id = $1
  order by items.display_order asc`;

async function insertEvent(
  client: PoolClient,
  quotationId: string,
  previousStatus: QuotationStatus,
  newStatus: QuotationStatus,
  action: string,
  reason: string | null,
  salesUserId: string,
) {
  await client.query(
    `insert into quotation_status_events (
       quotation_id, previous_status, new_status, action, reason, changed_by_sales_user_id
     ) values ($1, $2, $3, $4, $5, $6)`,
    [quotationId, previousStatus, newStatus, action, reason, salesUserId],
  );
}

function activeApproval(quotation: QuotationRow, role: SalesRole) {
  if (quotation.status === 'PENDING_HADER_APPROVAL') {
    if (role !== 'HADER_MANAGER') throw forbiddenApproval();
    if (quotation.hader_approval_status !== 'PENDING') throw duplicateApproval();
    return 'HADER' as const;
  }
  if (quotation.status === 'PENDING_PRICE_APPROVAL') {
    if (role !== 'PRICE_MANAGER') throw forbiddenApproval();
    if (quotation.price_approval_status !== 'PENDING') throw duplicateApproval();
    return 'PRICE' as const;
  }
  throw duplicateApproval();
}

function allowedActions(quotation: QuotationRow, pricingComplete: boolean, role: SalesRole) {
  return {
    startReview: quotation.status === 'PENDING_SALES_REVIEW',
    editPricing: quotation.status === 'UNDER_REVIEW',
    submitApproval:
      quotation.status === 'UNDER_REVIEW' &&
      pricingComplete &&
      (quotation.product_price_changed || quotation.delivery_price_changed) &&
      !approvalsComplete(quotation),
    sendToCustomer:
      quotation.status === 'UNDER_REVIEW' && pricingComplete && approvalsComplete(quotation),
    approve:
      (quotation.status === 'PENDING_HADER_APPROVAL' && role === 'HADER_MANAGER') ||
      (quotation.status === 'PENDING_PRICE_APPROVAL' && role === 'PRICE_MANAGER'),
    reject:
      (quotation.status === 'PENDING_HADER_APPROVAL' && role === 'HADER_MANAGER') ||
      (quotation.status === 'PENDING_PRICE_APPROVAL' && role === 'PRICE_MANAGER'),
  };
}

function approvalsComplete(quotation: QuotationRow) {
  const haderComplete =
    !quotation.delivery_price_changed || quotation.hader_approval_status === 'APPROVED';
  const priceComplete =
    !quotation.product_price_changed || quotation.price_approval_status === 'APPROVED';
  return haderComplete && priceComplete;
}

function ensureCommercialComplete(quotation: QuotationRow) {
  if (!quotation.valid_until || !quotation.payment_terms || quotation.grand_total === null) {
    throw new AppError(
      'Commercial pricing and terms are incomplete.',
      400,
      'QUOTATION_PRICING_INCOMPLETE',
    );
  }
}

function approvalReason(quotation: QuotationRow) {
  if (quotation.product_price_changed && quotation.delivery_price_changed)
    return 'Product and delivery prices were modified.';
  if (quotation.product_price_changed) return 'Product price was modified.';
  return 'Delivery price was modified.';
}

function resolveDestination(quotation: QuotationRow) {
  if (quotation.fulfilment_type === 'PICKUP') {
    return pickupLocations.find((location) => location.id === quotation.pickup_location_id) ?? null;
  }
  return (
    (quotation.delivery_locations ?? []).find(
      (location) => stringValue(location.id) === quotation.ship_to_location_id,
    ) ?? null
  );
}

function requireStatus(quotation: QuotationRow, status: QuotationStatus, message: string) {
  if (quotation.status !== status) throw new AppError(message, 409, 'QUOTATION_STATUS_CONFLICT');
}

function notFound() {
  return new AppError('Quotation was not found.', 404, 'SALES_QUOTATION_NOT_FOUND');
}
function forbiddenApproval() {
  return new AppError(
    'You are not authorized for this approval step.',
    403,
    'QUOTATION_APPROVAL_FORBIDDEN',
  );
}
function duplicateApproval() {
  return new AppError(
    'This approval action is no longer available.',
    409,
    'QUOTATION_APPROVAL_CONFLICT',
  );
}
function nullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function sameMoney(left: number, right: number | null) {
  return right !== null && Math.abs(left - right) < 0.005;
}
function iso(value: string | Date | null) {
  return value ? new Date(String(value)).toISOString() : null;
}
function dateOnly(value: string | Date | null) {
  if (!value) return null;
  return new Date(String(value)).toISOString().slice(0, 10);
}
function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
