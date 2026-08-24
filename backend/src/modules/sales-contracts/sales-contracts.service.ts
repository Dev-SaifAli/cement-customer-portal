import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type {
  CreateContractFromAcceptedQuotationPayload,
  ListSalesContractsQuery,
  SalesContractExtensionPayload,
  SalesContractPayload,
} from './sales-contracts.validation.js';

type ContractStatus =
  | 'DRAFT'
  | 'PENDING_SALES_REVIEW'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'ACTIVE'
  | 'CANCELLED';

type Fulfilment = 'PICKUP' | 'DELIVERY';

interface ContractRow {
  id: string;
  reference: string | null;
  customer_account_id: string;
  customer_company_name: string | null;
  product_id: string;
  product_code: string | null;
  product_name: string | null;
  packaging: string;
  uom: string;
  quantity: string;
  start_date: Date | string;
  end_date: Date | string;
  fulfilment: Fulfilment;
  pickup_location_id: string | null;
  delivery_location_id: string | null;
  delivery_city: string | null;
  pallet_required: boolean;
  pallet_type: string | null;
  product_list_price: string;
  product_price: string;
  delivery_list_price: string | null;
  delivery_price: string | null;
  quotation_id: string | null;
  quotation_reference: string | null;
  accepted_at: Date | string | null;
  pricing_city_id: string | null;
  total_quantity_tons: string | null;
  shipped_quantity_tons: string;
  remaining_quantity_tons: string | null;
  subtotal: string | null;
  vat_rate: string | null;
  vat_amount: string | null;
  grand_total: string | null;
  payment_terms: string | null;
  commercial_notes: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  items_snapshot: unknown;
  sales_user_id: string;
  sales_user_name: string | null;
  status: ContractStatus;
  activated_by: string | null;
  activated_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ContractStatusEventRow {
  id: string;
  contract_id: string;
  previous_status: ContractStatus | null;
  new_status: ContractStatus;
  action: string;
  reason: string | null;
  changed_by: string;
  changed_by_name: string | null;
  changed_by_email: string | null;
  created_at: Date | string;
}

interface CustomerAccountRow {
  id: string;
  company_name: string;
  status: string;
  application_status: string;
  delivery_locations: unknown;
}

interface ProductRow {
  id: string;
  product_code: string;
  product_name: string;
  packaging_type: string;
  uom: string;
  is_active: boolean;
}

interface DeliveryLocation {
  id?: string;
  name?: string;
  city?: string;
  region?: string;
}

interface AcceptedQuotationRow {
  id: string;
  reference: string;
  customer_account_id: string;
  customer_company_name: string;
  pricing_city_id: string | null;
  pricing_city_name: string | null;
  status: string;
  fulfilment_type: Fulfilment;
  pickup_location_id: string | null;
  ship_to_location_id: string | null;
  requested_date: Date | string | null;
  notes: string | null;
  submitted_at: Date | string | null;
  updated_at: Date | string;
  accepted_event_at: Date | string | null;
  valid_until: Date | string | null;
  payment_terms: string | null;
  commercial_notes: string | null;
  subtotal: string | null;
  vat_rate: string | null;
  vat_amount: string | null;
  grand_total: string | null;
  contact: Record<string, unknown> | null;
  delivery_locations: Array<Record<string, unknown>> | null;
  existing_contract_id: string | null;
  existing_contract_reference: string | null;
}

interface AcceptedQuotationItemRow {
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
  pallet_required: boolean;
  pallet_type: string | null;
  pallet_quantity: number | null;
  display_order: number;
  product_list_price: string | null;
  product_price: string | null;
  discount_mode: 'PERCENT' | 'SAR_PER_TON' | null;
  discount_value: string | null;
  discount_amount_per_ton: string | null;
  delivery_list_price: string | null;
  delivery_price: string | null;
  customer_rate: string | null;
  amount: string | null;
}

const pickupLocations = new Set(['ALSAFWA_PLANT_MAIN']);

export class SalesContractsService {
  async list(query: ListSalesContractsQuery) {
    const offset = (query.page - 1) * query.pageSize;
    const values: unknown[] = [];
    const filters: string[] = [];

    if (query.status) {
      values.push(query.status);
      filters.push(`contracts.status = $${values.length}`);
    }

    if (query.customerAccountId) {
      values.push(query.customerAccountId);
      filters.push(`contracts.customer_account_id = $${values.length}`);
    }

    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      filters.push(`(
        lower(coalesce(contracts.reference, '')) like $${values.length}
        or lower(customer_accounts.company_name) like $${values.length}
        or lower(product_catalog.product_code) like $${values.length}
        or lower(product_catalog.product_name) like $${values.length}
      )`);
    }

    const whereClause = filters.length > 0 ? `where ${filters.join(' and ')}` : '';
    const countResult = await pool.query<{ total: string }>(
      `select count(*)::text as total
       from contracts
       inner join customer_accounts on customer_accounts.id = contracts.customer_account_id
       inner join product_catalog on product_catalog.id = contracts.product_id
       ${whereClause}`,
      values,
    );

    const listValues = [...values, query.pageSize, offset];
    const result = await pool.query<ContractRow>(
      `${contractSelectSql}
       ${whereClause}
       order by contracts.updated_at desc, contracts.created_at desc
       limit $${listValues.length - 1}
       offset $${listValues.length}`,
      listValues,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map(mapContractSummary),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async create(payload: SalesContractPayload, salesUser: SalesUser) {
    const related = await this.validateRelatedData(payload);
    const client = await pool.connect();

    try {
      await client.query('begin');
      const result = await client.query<ContractRow>(
        `insert into contracts (
           customer_account_id,
           product_id,
           packaging,
           uom,
           quantity,
           start_date,
           end_date,
           fulfilment,
           pickup_location_id,
           delivery_location_id,
           delivery_city,
           pallet_required,
           pallet_type,
           product_list_price,
           product_price,
           delivery_list_price,
           delivery_price,
           sales_user_id,
           status
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'DRAFT')
         returning *`,
        payloadValues(payload, related.product, salesUser.id),
      );

      const contract = result.rows[0];
      if (!contract) {
        throw new AppError('Contract draft could not be created.', 503, 'CONTRACT_CREATE_FAILED');
      }

      await insertStatusEvent(
        client,
        contract.id,
        null,
        'DRAFT',
        'CREATE_DRAFT',
        null,
        salesUser.id,
      );
      await client.query('commit');

      return this.getById(contract.id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async createFromAcceptedQuotation(
    quotationId: string,
    payload: CreateContractFromAcceptedQuotationPayload,
    salesUser: SalesUser,
  ) {
    if (salesUser.role !== 'SALES_REP') {
      throw new AppError(
        'Only a Sales representative can convert accepted quotations to contracts.',
        403,
        'CONTRACT_CREATE_FORBIDDEN',
      );
    }

    const client = await pool.connect();

    try {
      await client.query('begin');
      const quotation = await getAcceptedQuotationForUpdate(client, quotationId);

      if (quotation.status !== 'ACCEPTED') {
        throw new AppError(
          'Only accepted quotations can be converted to contracts.',
          409,
          'QUOTATION_NOT_ACCEPTED',
        );
      }

      if (quotation.existing_contract_id) {
        throw new AppError(
          `This quotation already has contract ${quotation.existing_contract_reference ?? quotation.existing_contract_id}.`,
          409,
          'QUOTATION_CONTRACT_ALREADY_EXISTS',
        );
      }

      await assertActivatedCustomerAccount(client, quotation.customer_account_id);
      const items = await getAcceptedQuotationItems(client, quotation.id);
      if (items.length === 0) {
        throw new AppError(
          'Accepted quotation must contain at least one item before a contract can be created.',
          409,
          'QUOTATION_ITEMS_REQUIRED',
        );
      }

      const missingPricing = items.find(
        (item) =>
          item.product_price === null ||
          item.customer_rate === null ||
          item.amount === null ||
          (quotation.fulfilment_type === 'DELIVERY' && item.delivery_price === null),
      );
      if (missingPricing) {
        throw new AppError(
          `Accepted pricing is incomplete for ${missingPricing.product_code}.`,
          409,
          'QUOTATION_PRICING_INCOMPLETE',
        );
      }

      const acceptedQuantityTons = roundQuantity(
        items.reduce((sum, item) => sum + Number(item.equivalent_tons), 0),
      );
      const destination = resolveAcceptedDestination(quotation);
      const firstItem = items[0];
      if (!firstItem) {
        throw new AppError(
          'Accepted quotation must contain at least one item before a contract can be created.',
          409,
          'QUOTATION_ITEMS_REQUIRED',
        );
      }
      const reference = await nextReference(client);
      const snapshot = items.map(contractItemSnapshot);

      const result = await client.query<ContractRow>(
        `insert into contracts (
           reference,
           customer_account_id,
           product_id,
           packaging,
           uom,
           quantity,
           start_date,
           end_date,
           fulfilment,
           pickup_location_id,
           delivery_location_id,
           delivery_city,
           pallet_required,
           pallet_type,
           product_list_price,
           product_price,
           delivery_list_price,
           delivery_price,
           sales_user_id,
           status,
           quotation_id,
           quotation_reference,
           accepted_at,
           pricing_city_id,
           total_quantity_tons,
           subtotal,
           vat_rate,
           vat_amount,
           grand_total,
           payment_terms,
           commercial_notes,
           customer_notes,
           internal_notes,
           items_snapshot
         )
         values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17, $18, $19, 'DRAFT',
           $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
           $30, $31, $32, $33
         )
         returning *`,
        [
          reference,
          quotation.customer_account_id,
          firstItem.product_id,
          firstItem.packaging_type,
          firstItem.uom,
          acceptedQuantityTons,
          payload.startDate,
          payload.endDate,
          quotation.fulfilment_type,
          quotation.fulfilment_type === 'PICKUP' ? quotation.pickup_location_id : null,
          quotation.fulfilment_type === 'DELIVERY' ? quotation.ship_to_location_id : null,
          quotation.fulfilment_type === 'DELIVERY'
            ? (destination?.city ?? quotation.pricing_city_name ?? null)
            : null,
          Boolean(firstItem.pallet_required),
          firstItem.pallet_required ? firstItem.pallet_type : null,
          Number(firstItem.product_list_price ?? firstItem.product_price),
          Number(firstItem.product_price),
          quotation.fulfilment_type === 'DELIVERY'
            ? Number(firstItem.delivery_list_price ?? firstItem.delivery_price)
            : null,
          quotation.fulfilment_type === 'DELIVERY' ? Number(firstItem.delivery_price) : null,
          salesUser.id,
          quotation.id,
          quotation.reference,
          findAcceptedAt(quotation),
          quotation.pricing_city_id,
          acceptedQuantityTons,
          Number(quotation.subtotal ?? 0),
          Number(quotation.vat_rate ?? 0),
          Number(quotation.vat_amount ?? 0),
          Number(quotation.grand_total ?? 0),
          quotation.payment_terms,
          quotation.commercial_notes,
          quotation.notes,
          payload.internalNotes ?? null,
          JSON.stringify(snapshot),
        ],
      );

      const contract = result.rows[0];
      if (!contract) {
        throw new AppError('Contract draft could not be created.', 503, 'CONTRACT_CREATE_FAILED');
      }

      await insertStatusEvent(
        client,
        contract.id,
        null,
        'DRAFT',
        'CREATE_FROM_ACCEPTED_QUOTATION',
        `Accepted quotation ${quotation.reference} converted to contract ${reference}.`,
        salesUser.id,
      );
      await insertQuotationAuditEvent(
        client,
        quotation.id,
        'ACCEPTED',
        'ACCEPTED',
        'CONTRACT_CREATED',
        `Converted to contract ${reference}.`,
        salesUser.id,
      );
      await client.query('commit');

      return this.getById(contract.id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getById(id: string) {
    const result = await pool.query<ContractRow>(`${contractSelectSql} where contracts.id = $1`, [
      id,
    ]);

    const contract = result.rows[0];
    if (!contract) {
      throw contractNotFoundError();
    }

    const events = await pool.query<ContractStatusEventRow>(
      `select
         contract_status_events.id,
         contract_status_events.contract_id,
         contract_status_events.previous_status,
         contract_status_events.new_status,
         contract_status_events.action,
         contract_status_events.reason,
         contract_status_events.changed_by,
         sales_users.name as changed_by_name,
         sales_users.email as changed_by_email,
         contract_status_events.created_at
       from contract_status_events
       left join sales_users on sales_users.id = contract_status_events.changed_by
       where contract_status_events.contract_id = $1
       order by contract_status_events.created_at asc`,
      [id],
    );

    return mapContractDetails(contract, events.rows);
  }

  async update(id: string, payload: SalesContractPayload, salesUser: SalesUser) {
    const related = await this.validateRelatedData(payload);
    const client = await pool.connect();

    try {
      await client.query('begin');
      const current = await getContractForUpdate(client, id);
      if (current.status !== 'DRAFT') {
        throw new AppError('Only draft contracts can be updated.', 409, 'CONTRACT_NOT_EDITABLE');
      }

      const result = await client.query<ContractRow>(
        `update contracts
         set customer_account_id = $1,
             product_id = $2,
             packaging = $3,
             uom = $4,
             quantity = $5,
             start_date = $6,
             end_date = $7,
             fulfilment = $8,
             pickup_location_id = $9,
             delivery_location_id = $10,
             delivery_city = $11,
             pallet_required = $12,
             pallet_type = $13,
             product_list_price = $14,
             product_price = $15,
             delivery_list_price = $16,
             delivery_price = $17,
             sales_user_id = $18,
             updated_at = now()
         where id = $19
         returning *`,
        [...payloadValues(payload, related.product, salesUser.id), id],
      );

      if (!result.rows[0]) {
        throw contractNotFoundError();
      }

      await client.query('commit');
      return this.getById(id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async submit(id: string, salesUser: SalesUser) {
    return this.activate(id, salesUser);
  }

  async activate(id: string, salesUser: SalesUser) {
    const client = await pool.connect();

    try {
      await client.query('begin');
      const current = await getContractForUpdate(client, id);
      if (current.status !== 'DRAFT') {
        throw new AppError(
          'Only draft contracts can be submitted.',
          409,
          'CONTRACT_NOT_SUBMITTABLE',
        );
      }

      const reference = current.reference ?? (await nextReference(client));
      const newStatus = current.quotation_id || !hasCustomPricing(current)
        ? 'ACTIVE'
        : 'PENDING_SALES_REVIEW';
      const action = newStatus === 'ACTIVE' ? 'SUBMIT_ACTIVATE' : 'SUBMIT_FOR_APPROVAL';
      const reason =
        newStatus === 'PENDING_SALES_REVIEW'
          ? 'Contract includes custom pricing and requires approval.'
          : null;

      const result = await client.query<ContractRow>(
        `update contracts
         set reference = $2,
             status = $3,
             activated_by = case when $3 = 'ACTIVE' then $4 else activated_by end,
             activated_at = case when $3 = 'ACTIVE' then now() else activated_at end,
             remaining_quantity_tons = case
               when $3 = 'ACTIVE' then coalesce(remaining_quantity_tons, total_quantity_tons, quantity)
               else remaining_quantity_tons
             end,
             updated_at = now()
         where id = $1
         returning *`,
        [id, reference, newStatus, salesUser.id],
      );

      const updated = result.rows[0];
      if (!updated) {
        throw contractNotFoundError();
      }

      await insertStatusEvent(client, id, current.status, newStatus, action, reason, salesUser.id);
      await client.query('commit');

      return this.getById(id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async extend(id: string, payload: SalesContractExtensionPayload, salesUser: SalesUser) {
    const client = await pool.connect();

    try {
      await client.query('begin');
      const current = await getContractForUpdate(client, id);
      if (current.status !== 'ACTIVE') {
        throw new AppError('Only active contracts can be extended.', 409, 'CONTRACT_NOT_ACTIVE');
      }

      const currentTotal = Number(current.total_quantity_tons ?? current.quantity);
      const currentRemaining = Number(current.remaining_quantity_tons ?? currentTotal);
      const currentEndDate = dateOnly(current.end_date);
      const additionalQuantity = payload.additionalQuantityTons ?? 0;
      const nextEndDate = payload.endDate ?? currentEndDate;

      if (payload.endDate && payload.endDate <= currentEndDate) {
        throw new AppError(
          'Contract end date can only be extended.',
          400,
          'CONTRACT_END_DATE_NOT_EXTENDED',
        );
      }

      const nextTotal = roundQuantity(currentTotal + additionalQuantity);
      const nextRemaining = roundQuantity(currentRemaining + additionalQuantity);

      const result = await client.query<ContractRow>(
        `update contracts
         set total_quantity_tons = $2,
             quantity = $2,
             remaining_quantity_tons = $3,
             end_date = $4,
             updated_at = now()
         where id = $1
         returning *`,
        [id, nextTotal, nextRemaining, nextEndDate],
      );

      if (!result.rows[0]) {
        throw contractNotFoundError();
      }

      const changes = [
        additionalQuantity > 0
          ? `Quantity increased by ${additionalQuantity} TON (${currentTotal} → ${nextTotal}).`
          : null,
        payload.endDate ? `End date extended ${currentEndDate} → ${nextEndDate}.` : null,
        payload.reason ? `Reason: ${payload.reason}` : null,
      ].filter(Boolean);

      await insertStatusEvent(
        client,
        id,
        current.status,
        'ACTIVE',
        additionalQuantity > 0 && payload.endDate
          ? 'CONTRACT_QUANTITY_AND_END_DATE_EXTENDED'
          : additionalQuantity > 0
            ? 'CONTRACT_QUANTITY_EXTENDED'
            : 'CONTRACT_END_DATE_EXTENDED',
        changes.join(' '),
        salesUser.id,
      );
      await client.query('commit');

      return this.getById(id);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async validateRelatedData(payload: SalesContractPayload) {
    const [account, product] = await Promise.all([
      getActivatedCustomerAccount(payload.customerAccountId),
      getActiveProduct(payload.productId),
    ]);

    if (payload.fulfilment === 'PICKUP' && !pickupLocations.has(payload.pickupLocationId ?? '')) {
      throw new AppError('Pickup location was not found.', 400, 'PICKUP_LOCATION_NOT_FOUND');
    }

    if (payload.fulfilment === 'DELIVERY') {
      const locations = parseDeliveryLocations(account.delivery_locations);
      const deliveryLocation = locations.find(
        (location) => location.id === payload.deliveryLocationId,
      );

      if (!deliveryLocation) {
        throw new AppError(
          'Delivery location does not belong to the selected customer.',
          400,
          'DELIVERY_LOCATION_NOT_FOUND',
        );
      }
    }

    const isBag = product.packaging_type.toLowerCase().includes('bag');
    if (!isBag && payload.palletRequired) {
      throw new AppError('Pallets are only available for bag products.', 400, 'PALLET_NOT_ALLOWED');
    }

    return { account, product };
  }
}

export const salesContractsService = new SalesContractsService();

const contractSelectSql = `select
  contracts.*,
  customer_accounts.company_name as customer_company_name,
  product_catalog.product_code,
  product_catalog.product_name,
  sales_users.name as sales_user_name
 from contracts
 inner join customer_accounts on customer_accounts.id = contracts.customer_account_id
 inner join product_catalog on product_catalog.id = contracts.product_id
 inner join sales_users on sales_users.id = contracts.sales_user_id`;

function payloadValues(payload: SalesContractPayload, product: ProductRow, salesUserId: string) {
  return [
    payload.customerAccountId,
    payload.productId,
    product.packaging_type,
    product.uom,
    payload.quantity,
    payload.startDate,
    payload.endDate,
    payload.fulfilment,
    payload.fulfilment === 'PICKUP' ? payload.pickupLocationId : null,
    payload.fulfilment === 'DELIVERY' ? payload.deliveryLocationId : null,
    payload.fulfilment === 'DELIVERY' ? (payload.deliveryCity ?? null) : null,
    payload.palletRequired,
    payload.palletRequired ? (payload.palletType ?? null) : null,
    payload.productListPrice,
    payload.productPrice,
    payload.fulfilment === 'DELIVERY' ? (payload.deliveryListPrice ?? null) : null,
    payload.fulfilment === 'DELIVERY' ? (payload.deliveryPrice ?? null) : null,
    salesUserId,
  ];
}

async function getActivatedCustomerAccount(customerAccountId: string) {
  const result = await pool.query<CustomerAccountRow>(
    `select
       customer_accounts.id,
       customer_accounts.company_name,
       customer_accounts.status,
       registration_drafts.status as application_status,
       registration_drafts.delivery_locations
     from customer_accounts
     inner join registration_drafts on registration_drafts.id = customer_accounts.registration_id
     where customer_accounts.id = $1
     limit 1`,
    [customerAccountId],
  );

  const account = result.rows[0];
  if (!account || account.status !== 'ACTIVE' || account.application_status !== 'ACTIVATED') {
    throw new AppError(
      'Only activated and active customer accounts can have contracts.',
      400,
      'CUSTOMER_ACCOUNT_NOT_ACTIVE',
    );
  }

  return account;
}

async function assertActivatedCustomerAccount(client: PoolClient, customerAccountId: string) {
  const result = await client.query<CustomerAccountRow>(
    `select
       customer_accounts.id,
       customer_accounts.company_name,
       customer_accounts.status,
       registration_drafts.status as application_status,
       registration_drafts.delivery_locations
     from customer_accounts
     inner join registration_drafts on registration_drafts.id = customer_accounts.registration_id
     where customer_accounts.id = $1
     limit 1`,
    [customerAccountId],
  );

  const account = result.rows[0];
  if (!account || account.status !== 'ACTIVE' || account.application_status !== 'ACTIVATED') {
    throw new AppError(
      'Only activated and active customer accounts can have contracts.',
      400,
      'CUSTOMER_ACCOUNT_NOT_ACTIVE',
    );
  }

  return account;
}

async function getAcceptedQuotationForUpdate(client: PoolClient, quotationId: string) {
  const result = await client.query<AcceptedQuotationRow>(
    `select quotations.*,
            accounts.company_name as customer_company_name,
            pricing_cities.name as pricing_city_name,
            registrations.contact,
            registrations.delivery_locations,
            existing_contracts.id as existing_contract_id,
            existing_contracts.reference as existing_contract_reference,
            accepted_events.created_at as accepted_event_at
     from customer_quotations quotations
     inner join customer_accounts accounts on accounts.id = quotations.customer_account_id
     inner join registration_drafts registrations on registrations.id = accounts.registration_id
     left join ksa_cities pricing_cities on pricing_cities.id = quotations.pricing_city_id
     left join contracts existing_contracts on existing_contracts.quotation_id = quotations.id
     left join lateral (
       select created_at
       from quotation_status_events events
       where events.quotation_id = quotations.id
         and events.action = 'CUSTOMER_ACCEPTED'
       order by events.created_at desc
       limit 1
     ) accepted_events on true
     where quotations.id = $1
     limit 1
     for update of quotations`,
    [quotationId],
  );

  const quotation = result.rows[0];
  if (!quotation || quotation.status === 'DRAFT') {
    throw new AppError('Quotation was not found.', 404, 'SALES_QUOTATION_NOT_FOUND');
  }
  return quotation;
}

async function getAcceptedQuotationItems(client: PoolClient, quotationId: string) {
  const result = await client.query<AcceptedQuotationItemRow>(
    `select
       items.id,
       items.product_id,
       products.product_code,
       products.product_name,
       products.image as product_image,
       products.unit_weight_kg,
       products.is_white_cement,
       round((items.quantity * products.unit_weight_kg) / 1000, 6) as equivalent_tons,
       items.quantity,
       items.uom,
       items.packaging_type,
       items.pallet_required,
       items.pallet_type,
       items.pallet_quantity,
       items.display_order,
       items.product_list_price,
       items.product_price,
       items.discount_mode,
       items.discount_value,
       items.discount_amount_per_ton,
       items.delivery_list_price,
       items.delivery_price,
       items.customer_rate,
       items.amount
     from customer_quotation_items items
     inner join product_catalog products on products.id = items.product_id
     where items.quotation_id = $1
     order by items.display_order asc
     for update of items`,
    [quotationId],
  );
  return result.rows;
}

async function getActiveProduct(productId: string) {
  const result = await pool.query<ProductRow>(
    `select id, product_code, product_name, packaging_type, uom, is_active
     from product_catalog
     where id = $1
     limit 1`,
    [productId],
  );

  const product = result.rows[0];
  if (!product || !product.is_active) {
    throw new AppError('Only active products can be used in contracts.', 400, 'PRODUCT_NOT_ACTIVE');
  }

  return product;
}

async function getContractForUpdate(client: PoolClient, id: string) {
  const result = await client.query<ContractRow>(
    'select * from contracts where id = $1 for update',
    [id],
  );

  const contract = result.rows[0];
  if (!contract) {
    throw contractNotFoundError();
  }

  return contract;
}

async function insertStatusEvent(
  client: PoolClient,
  contractId: string,
  previousStatus: ContractStatus | null,
  newStatus: ContractStatus,
  action: string,
  reason: string | null,
  changedBy: string,
) {
  await client.query(
    `insert into contract_status_events (
       contract_id,
       previous_status,
       new_status,
       action,
       reason,
       changed_by
     )
     values ($1, $2, $3, $4, $5, $6)`,
    [contractId, previousStatus, newStatus, action, reason, changedBy],
  );
}

async function insertQuotationAuditEvent(
  client: PoolClient,
  quotationId: string,
  previousStatus: string,
  newStatus: string,
  action: string,
  reason: string,
  salesUserId: string,
) {
  await client.query(
    `insert into quotation_status_events (
       quotation_id,
       previous_status,
       new_status,
       action,
       reason,
       changed_by_sales_user_id
     )
     values ($1, $2, $3, $4, $5, $6)`,
    [quotationId, previousStatus, newStatus, action, reason, salesUserId],
  );
}

async function nextReference(client: PoolClient) {
  const result = await client.query<{ sequence: string }>(
    `select nextval('contract_reference_seq')::text as sequence`,
  );
  const sequence = String(result.rows[0]?.sequence ?? '1').padStart(6, '0');

  return `CT-${new Date().getFullYear()}-${sequence}`;
}

function hasCustomPricing(contract: ContractRow) {
  const productChanged = Number(contract.product_price) !== Number(contract.product_list_price);
  const deliveryChanged =
    contract.delivery_price !== null &&
    contract.delivery_list_price !== null &&
    Number(contract.delivery_price) !== Number(contract.delivery_list_price);

  return productChanged || deliveryChanged;
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

function resolveAcceptedDestination(quotation: AcceptedQuotationRow) {
  if (quotation.fulfilment_type === 'PICKUP') {
    return { id: quotation.pickup_location_id, name: 'AlSafwa Cement Plant', city: 'Jeddah' };
  }

  return (
    (quotation.delivery_locations ?? []).find(
      (location) => stringValue(location.id) === quotation.ship_to_location_id,
    ) ?? null
  );
}

function contractItemSnapshot(item: AcceptedQuotationItemRow) {
  return {
    quotationItemId: item.id,
    productId: item.product_id,
    productCode: item.product_code,
    productName: item.product_name,
    image: item.product_image,
    unitWeightKg: Number(item.unit_weight_kg),
    isWhiteCement: item.is_white_cement,
    quantity: Number(item.quantity),
    uom: item.uom,
    packagingType: item.packaging_type,
    equivalentTons: Number(item.equivalent_tons),
    productListPrice: nullableNumber(item.product_list_price),
    productPrice: nullableNumber(item.product_price),
    discountMode: item.discount_mode,
    discountValue: nullableNumber(item.discount_value),
    discountAmountPerTon: nullableNumber(item.discount_amount_per_ton),
    deliveryListPrice: nullableNumber(item.delivery_list_price),
    deliveryPrice: nullableNumber(item.delivery_price),
    customerRate: nullableNumber(item.customer_rate),
    amount: nullableNumber(item.amount),
    palletRequired: item.pallet_required,
    palletType: item.pallet_type,
    palletQuantity: item.pallet_quantity,
    displayOrder: item.display_order,
  };
}

function findAcceptedAt(quotation: AcceptedQuotationRow) {
  return quotation.accepted_event_at ?? quotation.updated_at ?? quotation.submitted_at ?? new Date();
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function mapContractSummary(row: ContractRow) {
  return {
    id: row.id,
    reference: row.reference,
    sourceQuotation: row.quotation_id
      ? {
          id: row.quotation_id,
          reference: row.quotation_reference,
          acceptedAt: row.accepted_at ? dateTime(row.accepted_at) : null,
        }
      : null,
    customerAccountId: row.customer_account_id,
    customerCompanyName: row.customer_company_name,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    quantity: Number(row.quantity),
    uom: row.uom,
    fulfilment: row.fulfilment,
    status: row.status,
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    totalQuantityTons: nullableNumber(row.total_quantity_tons),
    shippedQuantityTons: nullableNumber(row.shipped_quantity_tons) ?? 0,
    remainingQuantityTons:
      nullableNumber(row.remaining_quantity_tons) ??
      nullableNumber(row.total_quantity_tons) ??
      Number(row.quantity),
    grandTotal: nullableNumber(row.grand_total),
    customerRate: Number(row.product_price) + Number(row.delivery_price ?? 0),
    createdAt: dateTime(row.created_at),
    updatedAt: dateTime(row.updated_at),
  };
}

function mapContractDetails(row: ContractRow, events: ContractStatusEventRow[]) {
  return {
    ...mapContractSummary(row),
    packaging: row.packaging,
    pickupLocationId: row.pickup_location_id,
    deliveryLocationId: row.delivery_location_id,
    deliveryCity: row.delivery_city,
    palletRequired: row.pallet_required,
    palletType: row.pallet_type,
    productListPrice: Number(row.product_list_price),
    productPrice: Number(row.product_price),
    deliveryListPrice: row.delivery_list_price === null ? null : Number(row.delivery_list_price),
    deliveryPrice: row.delivery_price === null ? null : Number(row.delivery_price),
    pricingCityId: row.pricing_city_id,
    totalQuantityTons: nullableNumber(row.total_quantity_tons),
    subtotal: nullableNumber(row.subtotal),
    vatRate: nullableNumber(row.vat_rate),
    vatAmount: nullableNumber(row.vat_amount),
    grandTotal: nullableNumber(row.grand_total),
    paymentTerms: row.payment_terms,
    commercialNotes: row.commercial_notes,
    customerNotes: row.customer_notes,
    internalNotes: row.internal_notes,
    items: parseItemsSnapshot(row.items_snapshot),
    salesUserId: row.sales_user_id,
    salesUserName: row.sales_user_name,
    activatedBy: row.activated_by,
    activatedAt: row.activated_at ? dateTime(row.activated_at) : null,
    statusHistory: events.map((event) => ({
      id: event.id,
      previousStatus: event.previous_status,
      newStatus: event.new_status,
      action: event.action,
      reason: event.reason,
      changedBy: event.changed_by,
      changedByName: event.changed_by_name,
      changedByEmail: event.changed_by_email,
      createdAt: dateTime(event.created_at),
    })),
  };
}

function parseItemsSnapshot(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function nullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function contractNotFoundError() {
  return new AppError('Contract was not found.', 404, 'SALES_CONTRACT_NOT_FOUND');
}

function dateTime(value: Date | string) {
  return new Date(String(value)).toISOString();
}

function dateOnly(value: Date | string) {
  return new Date(String(value)).toISOString().slice(0, 10);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
