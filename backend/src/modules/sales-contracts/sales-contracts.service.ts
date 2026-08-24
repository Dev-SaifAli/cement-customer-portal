import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { SalesUser } from '../sales-auth/sales-auth.types.js';
import type {
  ListSalesContractsQuery,
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
  sales_user_id: string;
  sales_user_name: string | null;
  status: ContractStatus;
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
      const newStatus = hasCustomPricing(current) ? 'PENDING_SALES_REVIEW' : 'ACTIVE';
      const action = newStatus === 'ACTIVE' ? 'SUBMIT_ACTIVATE' : 'SUBMIT_FOR_APPROVAL';
      const reason =
        newStatus === 'PENDING_SALES_REVIEW'
          ? 'Contract includes custom pricing and requires approval.'
          : null;

      const result = await client.query<ContractRow>(
        `update contracts
         set reference = $2,
             status = $3,
             updated_at = now()
         where id = $1
         returning *`,
        [id, reference, newStatus],
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

function mapContractSummary(row: ContractRow) {
  return {
    id: row.id,
    reference: row.reference,
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
    salesUserId: row.sales_user_id,
    salesUserName: row.sales_user_name,
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

function contractNotFoundError() {
  return new AppError('Contract was not found.', 404, 'SALES_CONTRACT_NOT_FOUND');
}

function dateTime(value: Date | string) {
  return new Date(String(value)).toISOString();
}

function dateOnly(value: Date | string) {
  return new Date(String(value)).toISOString().slice(0, 10);
}
