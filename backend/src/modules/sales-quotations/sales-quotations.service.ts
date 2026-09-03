import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import { notificationEvents } from '../notifications/notification-events.js';
import type { SalesRole, SalesUser } from '../sales-auth/sales-auth.types.js';
import type {
  ListSalesQuotationsQuery,
  SalesQuotationPricingPayload,
} from './sales-quotations.validation.js';
import type { PoolClient } from 'pg';
import {
  pricingLookupService,
  type QuotationPricingItemRow,
} from '../pricing/pricing-lookup.service.js';
import { pickupLocationsService } from '../pickup-locations/pickup-locations.service.js';
import { taxRateService } from '../tax-configurations/tax-rate.service.js';

const pageSize = 10;
const itemCountExpression = `(select count(*)::integer
  from customer_quotation_items filter_items
  where filter_items.quotation_id = quotations.id)`;
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
  pricing_city_id: string | null;
  pricing_city_name: string | null;
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
  contract_id: string | null;
  contract_reference: string | null;
  contract_status: string | null;
  item_count?: string;
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
  sales_user_role: SalesRole | null;
  customer_user_role: string | null;
  created_at: string | Date;
}

const quotationSelect = `
  select quotations.*,
         accounts.company_name as customer_company_name,
         pricing_cities.name as pricing_city_name,
         registrations.contact,
         registrations.delivery_locations,
         contracts.id as contract_id,
         contracts.reference as contract_reference,
         contracts.status as contract_status,
         ${itemCountExpression}::text as item_count
  from customer_quotations quotations
  inner join customer_accounts accounts on accounts.id = quotations.customer_account_id
  left join ksa_cities pricing_cities on pricing_cities.id = quotations.pricing_city_id
  inner join registration_drafts registrations on registrations.id = accounts.registration_id
  left join contracts on contracts.quotation_id = quotations.id`;

export class SalesQuotationsService {
  async list(query: ListSalesQuotationsQuery, user: SalesUser) {
    const values: unknown[] = [];
    const conditions = [`quotations.status <> 'DRAFT'`];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      conditions.push(sql.replace('?', `$${values.length}`));
    };

    if (query.reference) add('quotations.reference ilike ?', `%${query.reference}%`);
    if (query.customer) add('accounts.company_name ilike ?', `%${query.customer}%`);
    if (query.submittedDate) {
      addComparison(
        conditions,
        values,
        'quotations.submitted_at::date',
        query.submittedOperator ?? 'on',
        query.submittedDate,
        query.submittedTo,
        true,
      );
    }
    if (query.fulfilmentType) {
      add(
        `quotations.fulfilment_type ${query.fulfilmentOperator === 'notEquals' ? '<>' : '='} ?`,
        query.fulfilmentType,
      );
    }
    if (query.status) {
      add(`quotations.status ${query.statusOperator === 'notEquals' ? '<>' : '='} ?`, query.status);
    }
    if (query.itemCount !== undefined) {
      addComparison(
        conditions,
        values,
        itemCountExpression,
        query.itemCountOperator ?? 'equals',
        query.itemCount,
        query.itemCountTo,
      );
    }
    if (query.total !== undefined) {
      addComparison(
        conditions,
        values,
        'coalesce(quotations.grand_total, 0)',
        query.totalOperator ?? 'equals',
        query.total,
        query.totalTo,
      );
    }
    if (user.role === 'HADER_MANAGER') add('quotations.status = ?', 'PENDING_HADER_APPROVAL');
    if (user.role === 'PRICE_MANAGER') add('quotations.status = ?', 'PENDING_PRICE_APPROVAL');

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
        itemCount: itemCount.get(row.id) ?? Number(row.item_count ?? 0),
        fulfilmentType: row.fulfilment_type,
        total: nullableNumber(row.grand_total),
        status: row.status,
      })),
      pagination: { page: query.page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getFilterOptions(
    query: {
      field:
        'reference' | 'customer' | 'status' | 'fulfilment' | 'itemCount' | 'total' | 'submitted';
      search?: string | undefined;
      limit: number;
    },
    user: SalesUser,
  ) {
    const expressions = {
      reference: 'quotations.reference',
      customer: 'accounts.company_name',
      status: 'quotations.status::text',
      fulfilment: 'quotations.fulfilment_type::text',
      itemCount: `${itemCountExpression}::text`,
      total: 'quotations.grand_total::text',
      submitted: 'quotations.submitted_at::date::text',
    } as const;
    const expression = expressions[query.field];
    const values: unknown[] = [];
    const conditions = [
      `quotations.status <> 'DRAFT'`,
      `${expression} is not null`,
      `btrim(${expression}) <> ''`,
    ];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      conditions.push(sql.replace('?', `$${values.length}`));
    };
    if (user.role === 'HADER_MANAGER') add('quotations.status = ?', 'PENDING_HADER_APPROVAL');
    if (user.role === 'PRICE_MANAGER') add('quotations.status = ?', 'PENDING_PRICE_APPROVAL');
    if (query.search) add(`lower(${expression}) like ?`, `%${query.search.toLowerCase()}%`);
    values.push(query.limit);

    const result = await pool.query<{ value: string }>(
      `select distinct ${expression} as value
       from customer_quotations quotations
       inner join customer_accounts accounts on accounts.id = quotations.customer_account_id
       where ${conditions.join(' and ')}
       order by value asc
       limit $${values.length}`,
      values,
    );

    return result.rows.map((row) => ({
      value: row.value,
      label: formatFilterOptionLabel(query.field, row.value),
    }));
  }

  async getById(id: string, user: SalesUser) {
    const quotation = await this.getQuotation(id);
    requireQuotationVisibility(quotation, user.role);
    const [items, events] = await Promise.all([
      this.getItems(id, quotation.pricing_city_id),
      this.getEvents(id),
    ]);
    return this.mapDetails(quotation, items, events, user, await resolveDestination(quotation));
  }

  async startReview(id: string, user: SalesUser) {
    requireSalesRepresentative(user);
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await this.lockQuotation(client, id);
      if (!['PENDING_SALES_REVIEW', 'CLARIFICATION_REQUESTED'].includes(current.status)) {
        throw new AppError(
          'Quotation is not pending Sales review.',
          409,
          'QUOTATION_STATUS_CONFLICT',
        );
      }
      if (current.status === 'PENDING_SALES_REVIEW') {
        const items = await this.getItemsForUpdate(client, id, current.pricing_city_id);
        for (const item of items) {
          const productList = nullableNumber(item.catalog_list_price);
          const deliveryList =
            current.fulfilment_type === 'DELIVERY'
              ? nullableNumber(item.catalog_delivery_list_price)
              : null;
          const rate =
            productList === null ||
            (current.fulfilment_type === 'DELIVERY' && deliveryList === null)
              ? null
              : money(productList + (deliveryList ?? 0));
          const equivalentTons = requireEquivalentTons(item);
          const amount = rate === null ? null : money(equivalentTons * rate);
          await client.query(
            `update customer_quotation_items
             set product_list_price = $2, product_price = $2,
                 delivery_list_price = $3, delivery_price = $3,
                 customer_rate = $4,
                 amount = $6,
                 updated_at = now()
             where id = $1 and quotation_id = $5`,
            [item.id, productList, deliveryList, rate, id, amount],
          );
        }
      }
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
        current.status === 'CLARIFICATION_REQUESTED'
          ? 'SALES_RESUMED_AFTER_CLARIFICATION'
          : 'SALES_STARTED_REVIEW',
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
    requireSalesRepresentative(user);
    const client = await pool.connect();
    try {
      await client.query('begin');
      const current = await this.lockQuotation(client, id);
      requireStatus(current, 'UNDER_REVIEW', 'Pricing can only be updated while under review.');
      if (!current.pricing_city_id) {
        throw new AppError(
          'Pricing city is not configured for this quotation.',
          409,
          'PRICING_CITY_NOT_CONFIGURED',
        );
      }
      if (new Date(`${payload.validUntil}T23:59:59Z`).getTime() < Date.now()) {
        throw new AppError(
          'Quotation validity must be today or later.',
          400,
          'QUOTATION_VALIDITY_INVALID',
        );
      }

      const items = await this.getItemsForUpdate(client, id, current.pricing_city_id);
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
      let productValueChanged = false;
      let deliveryValueChanged = false;
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
            `List pricing is not configured for ${item.product_code} (${current.pricing_city_name ?? 'unmapped city'} · ${item.packaging_type} · ${item.uom}).`,
            409,
            'QUOTATION_LIST_PRICE_NOT_CONFIGURED',
          );
        }
        const discount = calculateProductDiscount(
          productList,
          input.discountMode,
          input.discountValue,
        );
        const productPrice = discount
          ? money(productList - discount.amountPerTon)
          : money(input.productPrice);
        const deliveryPrice =
          current.fulfilment_type === 'DELIVERY' ? money(input.deliveryPrice ?? -1) : 0;
        if (productPrice <= 0) {
          throw new AppError(
            `Final product price must be greater than zero for ${item.product_code}.`,
            400,
            'QUOTATION_PRODUCT_PRICE_INVALID',
          );
        }
        if (deliveryPrice < 0) {
          throw new AppError(
            'Delivery price is required for delivery quotations.',
            400,
            'DELIVERY_PRICE_REQUIRED',
          );
        }
        const rate = money(productPrice + deliveryPrice);
        const amount = money(requireEquivalentTons(item) * rate);
        subtotal = money(subtotal + amount);
        productChanged ||= !sameMoney(productPrice, productList);
        deliveryChanged ||=
          current.fulfilment_type === 'DELIVERY' && !sameMoney(deliveryPrice, deliveryList ?? 0);
        const productValueWasChanged = !sameMoney(productPrice, nullableNumber(item.product_price));
        const discountValueWasChanged =
          (discount?.mode ?? null) !== item.discount_mode ||
          !sameMoney(discount?.value ?? 0, nullableNumber(item.discount_value) ?? 0);
        const deliveryValueWasChanged =
          current.fulfilment_type === 'DELIVERY' &&
          !sameMoney(deliveryPrice, nullableNumber(item.delivery_price));
        productValueChanged ||= productValueWasChanged || discountValueWasChanged;
        deliveryValueChanged ||= deliveryValueWasChanged;
        valuesChanged ||=
          productValueWasChanged ||
          discountValueWasChanged ||
          deliveryValueWasChanged ||
          !sameMoney(amount, nullableNumber(item.amount));

        await client.query(
          `update customer_quotation_items
           set product_list_price = $2, product_price = $3,
               discount_mode = $4, discount_value = $5, discount_amount_per_ton = $6,
               delivery_list_price = $7, delivery_price = $8,
               customer_rate = $9, amount = $10, updated_at = now()
           where id = $1 and quotation_id = $11`,
          [
            item.id,
            productList,
            productPrice,
            discount?.mode ?? null,
            discount?.value ?? null,
            discount?.amountPerTon ?? null,
            current.fulfilment_type === 'DELIVERY' ? deliveryList : null,
            current.fulfilment_type === 'DELIVERY' ? deliveryPrice : null,
            rate,
            amount,
            id,
          ],
        );
      }

      const vatRate = await taxRateService.getRate(client);
      const vatAmount = money(subtotal * vatRate);
      const grandTotal = money(subtotal + vatAmount);
      valuesChanged ||=
        payload.validUntil !== dateOnly(current.valid_until) ||
        payload.paymentTerms !== (current.payment_terms ?? '') ||
        payload.commercialNotes !== (current.commercial_notes ?? '');
      const haderApprovalStatus = deliveryChanged
        ? current.hader_approval_status === 'APPROVED' && !deliveryValueChanged
          ? 'APPROVED'
          : 'REQUIRED'
        : 'NOT_REQUIRED';
      const priceApprovalStatus = productChanged
        ? current.price_approval_status === 'APPROVED' && !productValueChanged
          ? 'APPROVED'
          : 'REQUIRED'
        : 'NOT_REQUIRED';

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
          haderApprovalStatus,
          priceApprovalStatus,
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
    requireSalesRepresentative(user);
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
    const details = await this.getById(id, user);
    await notificationEvents.quotationApprovalRequired(
      details.status === 'PENDING_HADER_APPROVAL'
        ? 'HADER_APPROVAL_REQUIRED'
        : 'PRICE_APPROVAL_REQUIRED',
      id,
      details.reference ?? 'Quotation',
    );
    return details;
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
    const details = await this.getById(id, user);
    if (details.status === 'PENDING_PRICE_APPROVAL') {
      await notificationEvents.quotationApprovalRequired(
        'PRICE_APPROVAL_REQUIRED',
        id,
        details.reference ?? 'Quotation',
      );
    }
    return details;
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
    requireSalesRepresentative(user);
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
    const details = await this.getById(id, user);
    await notificationEvents.quotationReadyForCustomer(
      details.customer.id,
      id,
      details.reference ?? 'Quotation',
    );
    return details;
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
              pricing_cities.name as pricing_city_name,
              registrations.contact, registrations.delivery_locations
       from customer_quotations quotations
       inner join customer_accounts accounts on accounts.id = quotations.customer_account_id
       left join ksa_cities pricing_cities on pricing_cities.id = quotations.pricing_city_id
       inner join registration_drafts registrations on registrations.id = accounts.registration_id
       where quotations.id = $1 for update of quotations`,
      [id],
    );
    const row = result.rows[0];
    if (!row || row.status === 'DRAFT') throw notFound();
    return row;
  }

  private async getItems(id: string, cityId: string | null) {
    return pricingLookupService.getQuotationItems(id, cityId);
  }

  private async getItemsForUpdate(client: PoolClient, id: string, cityId: string | null) {
    return pricingLookupService.getQuotationItems(id, cityId, client, true);
  }

  private async getEvents(id: string) {
    const result = await pool.query<EventRow>(
      `select events.*, sales.name as sales_user_name, customers.name as customer_user_name,
              sales.role as sales_user_role, customers.role as customer_user_role
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
    items: QuotationPricingItemRow[],
    events: EventRow[],
    user: SalesUser,
    destination: Record<string, unknown> | null,
  ) {
    const contact = quotation.contact ?? {};
    const submittedBy = events.find((event) => event.action === 'CUSTOMER_SUBMITTED');
    const pricingComplete = Boolean(
      quotation.pricing_city_id &&
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
      submittedBy: submittedBy?.customer_user_name ?? null,
      requestedDate: dateOnly(quotation.requested_date),
      fulfilmentType: quotation.fulfilment_type,
      pricingCity: quotation.pricing_city_id
        ? { id: quotation.pricing_city_id, name: quotation.pricing_city_name }
        : null,
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
        unitWeightKg: Number(item.unit_weight_kg),
        equivalentTons: Number(item.equivalent_tons),
        quantity: Number(item.quantity_tons),
        quantityTon: Number(item.quantity_tons),
        packagingQuantity:
          item.packaging_quantity === null ? null : Number(item.packaging_quantity),
        commercialUom: 'TON',
        uom: item.uom,
        packagingType: item.packaging_type,
        productListPrice: nullableNumber(item.product_list_price ?? item.catalog_list_price),
        productPrice: nullableNumber(item.product_price ?? item.catalog_list_price),
        discountMode: item.discount_mode,
        discountValue: nullableNumber(item.discount_value),
        discountAmountPerTon: nullableNumber(item.discount_amount_per_ton),
        deliveryListPrice:
          quotation.fulfilment_type === 'DELIVERY'
            ? nullableNumber(item.delivery_list_price ?? item.catalog_delivery_list_price)
            : null,
        deliveryPrice:
          quotation.fulfilment_type === 'DELIVERY'
            ? nullableNumber(item.delivery_price ?? item.catalog_delivery_list_price)
            : null,
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
        actorRole: event.sales_user_role ?? event.customer_user_role,
        createdAt: iso(event.created_at),
      })),
      contract: quotation.contract_id
        ? {
            id: quotation.contract_id,
            reference: quotation.contract_reference,
            status: quotation.contract_status,
          }
        : null,
      allowedActions: allowedActions(quotation, pricingComplete, user.role),
    };
  }
}

export const salesQuotationsService = new SalesQuotationsService();

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
  const canPrepareCommercialQuote = role === 'SALES_REP';
  return {
    startReview:
      canPrepareCommercialQuote &&
      ['PENDING_SALES_REVIEW', 'CLARIFICATION_REQUESTED'].includes(quotation.status),
    editPricing: canPrepareCommercialQuote && quotation.status === 'UNDER_REVIEW',
    submitApproval:
      canPrepareCommercialQuote &&
      quotation.status === 'UNDER_REVIEW' &&
      pricingComplete &&
      (quotation.product_price_changed || quotation.delivery_price_changed) &&
      !approvalsComplete(quotation),
    sendToCustomer:
      canPrepareCommercialQuote &&
      quotation.status === 'UNDER_REVIEW' &&
      pricingComplete &&
      approvalsComplete(quotation),
    approve:
      (quotation.status === 'PENDING_HADER_APPROVAL' && role === 'HADER_MANAGER') ||
      (quotation.status === 'PENDING_PRICE_APPROVAL' && role === 'PRICE_MANAGER'),
    reject:
      (quotation.status === 'PENDING_HADER_APPROVAL' && role === 'HADER_MANAGER') ||
      (quotation.status === 'PENDING_PRICE_APPROVAL' && role === 'PRICE_MANAGER'),
    createContract:
      canPrepareCommercialQuote && quotation.status === 'ACCEPTED' && !quotation.contract_id,
  };
}

function requireSalesRepresentative(user: SalesUser) {
  if (user.role !== 'SALES_REP') {
    throw new AppError(
      'Only a Sales representative can prepare and send commercial quotations.',
      403,
      'QUOTATION_COMMERCIAL_ACTION_FORBIDDEN',
    );
  }
}

function requireQuotationVisibility(quotation: QuotationRow, role: SalesRole) {
  if (role === 'SALES_REP') return;
  const canReviewDeliveryException =
    role === 'HADER_MANAGER' && quotation.status === 'PENDING_HADER_APPROVAL';
  const canReviewProductException =
    role === 'PRICE_MANAGER' && quotation.status === 'PENDING_PRICE_APPROVAL';
  if (!canReviewDeliveryException && !canReviewProductException) {
    throw new AppError(
      'This quotation is not assigned to your approval stage.',
      403,
      'QUOTATION_ACCESS_FORBIDDEN',
    );
  }
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

async function resolveDestination(
  quotation: QuotationRow,
): Promise<Record<string, unknown> | null> {
  if (quotation.fulfilment_type === 'PICKUP') {
    const legacy = pickupLocations.find((location) => location.id === quotation.pickup_location_id);
    if (legacy) return legacy;
    if (!quotation.pickup_location_id) return null;
    try {
      return await pickupLocationsService.get(quotation.pickup_location_id);
    } catch {
      return null;
    }
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
function addComparison(
  conditions: string[],
  values: unknown[],
  expression: string,
  operator: 'equals' | 'greaterThan' | 'lessThan' | 'between' | 'on' | 'before' | 'after',
  value: unknown,
  secondValue?: unknown,
  dateValue = false,
) {
  const parameter = (nextValue: unknown) => {
    values.push(nextValue);
    return `$${values.length}${dateValue ? '::date' : ''}`;
  };
  const first = parameter(value);
  if (operator === 'between' && secondValue !== undefined) {
    const second = parameter(secondValue);
    conditions.push(`${expression} between ${first} and ${second}`);
    return;
  }
  const sqlOperator = {
    equals: '=',
    on: '=',
    greaterThan: '>',
    after: '>',
    lessThan: '<',
    before: '<',
    between: '=',
  }[operator];
  conditions.push(`${expression} ${sqlOperator} ${first}`);
}
function formatFilterOptionLabel(
  field: 'reference' | 'customer' | 'status' | 'fulfilment' | 'itemCount' | 'total' | 'submitted',
  value: string,
) {
  if (field === 'status') {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  if (field === 'fulfilment') return value === 'PICKUP' ? 'Pick-Up' : 'Delivery';
  if (field === 'itemCount') return `${value} ${value === '1' ? 'Item' : 'Items'}`;
  if (field === 'total') {
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(2)} SAR` : value;
  }
  return value;
}
function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function requireEquivalentTons(item: {
  equivalent_tons?: string | number | null;
  product_code: string;
}) {
  const equivalentTons = nullableNumber(item.equivalent_tons);
  if (equivalentTons === null || equivalentTons <= 0) {
    throw new AppError(
      `Product unit weight is not configured for ${item.product_code}.`,
      409,
      'PRODUCT_UNIT_WEIGHT_NOT_CONFIGURED',
    );
  }
  return equivalentTons;
}
function calculateProductDiscount(
  productListPrice: number,
  mode: 'PERCENT' | 'SAR_PER_TON' | null | undefined,
  value: number | null | undefined,
) {
  if (!mode || value === null || value === undefined || Number(value) === 0) return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new AppError('Discount must be zero or greater.', 400, 'QUOTATION_DISCOUNT_INVALID');
  }

  const amountPerTon =
    mode === 'PERCENT' ? money((productListPrice * numericValue) / 100) : money(numericValue);
  if (amountPerTon < 0 || amountPerTon >= productListPrice) {
    throw new AppError(
      'Discount must keep the final product price greater than zero.',
      400,
      'QUOTATION_DISCOUNT_INVALID',
    );
  }

  return { mode, value: numericValue, amountPerTon };
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
