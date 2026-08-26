import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import { createDeliveryRequestForOrder } from '../hader-delivery/hader-delivery.service.js';
import { ordersRepository } from './orders.repository.js';
import type {
  CreateCustomerOrderPayload,
  ListCustomerOrdersQuery,
} from './customer-orders.validation.js';

const orderWritableRoles = new Set<CustomerUser['role']>(['CUSTOMER_ADMIN', 'PURCHASER']);

interface LockedContractRow {
  id: string;
  reference: string | null;
  customer_account_id: string;
  status: string;
  product_id: string;
  product_code: string;
  product_name: string;
  packaging: string;
  uom: string;
  fulfilment: 'PICKUP' | 'DELIVERY';
  pickup_location_id: string | null;
  delivery_location_id: string | null;
  delivery_city: string | null;
  registration_delivery_locations: unknown;
  pricing_city_id: string | null;
  total_quantity_tons: string | null;
  remaining_quantity_tons: string | null;
  quantity: string;
  product_price: string;
  delivery_price: string | null;
  contract_item_id: string | null;
}

interface DeliveryLocationSnapshot {
  id?: string;
  name?: string;
  city?: string;
  region?: string;
  streetAddress?: string;
  postalCode?: string;
  country?: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  contract_id: string;
  customer_account_id: string;
  ship_to_location_id: string | null;
  pickup_location_id: string | null;
  fulfilment_type: 'PICKUP' | 'DELIVERY';
  hader_city_id: string | null;
  hader_city_name: string | null;
  created_by_customer_user_id: string;
  status: 'SUBMITTED';
  requested_quantity_tons: string;
  remaining_contract_quantity_snapshot: string;
  approved_customer_rate_per_ton: string;
  amount: string;
  submitted_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  vat_rate: string;
  vat_amount: string;
  grand_total: string;
}

export class CustomerOrdersService {
  async list(customerUser: CustomerUser, query: ListCustomerOrdersQuery) {
    return ordersRepository.list({ customerAccountId: customerUser.customerAccountId }, query);
  }

  async getById(customerUser: CustomerUser, orderId: string) {
    const order = await ordersRepository.getById(orderId, {
      customerAccountId: customerUser.customerAccountId,
    });
    if (!order) throw new AppError('Order was not found.', 404, 'CUSTOMER_ORDER_NOT_FOUND');
    return order;
  }

  async createFromContract(
    customerUser: CustomerUser,
    contractId: string,
    payload: CreateCustomerOrderPayload,
  ) {
    requireOrderWriteAccess(customerUser);
    const client = await pool.connect();

    try {
      await client.query('begin');
      await client.query(`select pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
        customerUser.customerAccountId,
        payload.clientRequestId,
      ]);
      const existingOrder = await ordersRepository.getByIdempotencyKey(
        customerUser.customerAccountId,
        payload.clientRequestId,
        client,
      );
      if (existingOrder) {
        if (existingOrder.contract.id !== contractId) {
          throw new AppError(
            'The order request identifier has already been used.',
            409,
            'ORDER_REQUEST_ID_REUSED',
          );
        }
        await client.query('commit');
        return existingOrder;
      }
      const contract = await getLockedCustomerContract(client, customerUser, contractId);
      validateContractForOrder(contract);

      if (contract.fulfilment === 'DELIVERY' && !payload.preferredDeliveryDate) {
        throw new AppError(
          'Preferred delivery date is required for delivery orders.',
          400,
          'ORDER_DELIVERY_DATE_REQUIRED',
        );
      }

      const requestedQuantityTons = round(payload.requestedQuantityTons, 3);
      const remainingBefore = contractRemainingTons(contract);
      if (requestedQuantityTons > remainingBefore) {
        throw new AppError(
          'Requested quantity exceeds the remaining contract quantity.',
          409,
          'ORDER_QUANTITY_EXCEEDS_CONTRACT_REMAINING',
        );
      }

      const remainingAfter = round(remainingBefore - requestedQuantityTons, 3);
      const customerRatePerTon = round(
        Number(contract.product_price) + Number(contract.delivery_price ?? 0),
        2,
      );
      const amount = round(requestedQuantityTons * customerRatePerTon, 2);
      const vatRate = 15;
      const vatAmount = round(amount * (vatRate / 100), 2);
      const grandTotal = round(amount + vatAmount, 2);
      const shipToSnapshot = resolveDeliveryLocation(contract);
      const orderNumber = await nextOrderNumber(client);

      const orderResult = await client.query<OrderRow>(
        `insert into orders (
           order_number,
           contract_id,
           customer_account_id,
           ship_to_location_id,
           pickup_location_id,
           fulfilment_type,
           hader_city_id,
           hader_city_name,
           created_by_customer_user_id,
           status,
           requested_quantity_tons,
           remaining_contract_quantity_snapshot,
           approved_customer_rate_per_ton,
           amount,
           client_request_id,
           preferred_delivery_date,
           delivery_notes,
           ship_to_snapshot,
           pickup_location_name,
           vat_rate,
           vat_amount,
           grand_total,
           submitted_at
         )
         values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUBMITTED', $10, $11, $12, $13,
           $14, $15, $16, $17, $18, $19, $20, $21, now()
         )
         returning *`,
        [
          orderNumber,
          contract.id,
          customerUser.customerAccountId,
          contract.delivery_location_id,
          contract.pickup_location_id,
          contract.fulfilment,
          contract.pricing_city_id,
          contract.delivery_city,
          customerUser.id,
          requestedQuantityTons,
          remainingAfter,
          customerRatePerTon,
          amount,
          payload.clientRequestId,
          payload.preferredDeliveryDate ?? null,
          payload.deliveryNotes ?? null,
          shipToSnapshot ? JSON.stringify(shipToSnapshot) : null,
          contract.pickup_location_id === 'ALSAFWA_PLANT_MAIN'
            ? 'AlSafwa Cement Plant'
            : contract.pickup_location_id,
          vatRate,
          vatAmount,
          grandTotal,
        ],
      );
      const order = orderResult.rows[0];
      if (!order) {
        throw new AppError('Order could not be created.', 503, 'ORDER_CREATE_FAILED');
      }

      await client.query(
        `insert into order_events (
           order_id, event_type, previous_status, new_status,
           changed_by_customer_user_id, event_data
         ) values ($1, 'ORDER_CREATED', null, 'DRAFT', $2, $3::jsonb)`,
        [order.id, customerUser.id, JSON.stringify({ contractId: contract.id })],
      );

      await client.query(
        `insert into order_items (
           order_id,
           contract_item_id,
           product_id,
           product_code,
           product_name,
           packaging,
           contract_uom,
           requested_quantity_tons,
           equivalent_tons,
           approved_customer_rate_per_ton,
           amount
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)`,
        [
          order.id,
          contract.contract_item_id,
          contract.product_id,
          contract.product_code,
          contract.product_name,
          contract.packaging,
          contract.uom,
          requestedQuantityTons,
          customerRatePerTon,
          amount,
        ],
      );

      await client.query(
        `update contracts
         set remaining_quantity_tons = $2,
             updated_at = now()
         where id = $1`,
        [contract.id, remainingAfter],
      );

      await client.query(
        `insert into order_events (
           order_id,
           event_type,
           previous_status,
           new_status,
           changed_by_customer_user_id,
           event_data
         )
         values (
           $1,
           'ORDER_SUBMITTED',
           'DRAFT',
           'SUBMITTED',
           $2,
           jsonb_build_object(
             'contractId', $3::text,
             'requestedQuantityTons', $4::numeric,
             'remainingBeforeTons', $5::numeric,
             'remainingAfterTons', $6::numeric
           )
         )`,
        [
          order.id,
          customerUser.id,
          contract.id,
          requestedQuantityTons,
          remainingBefore,
          remainingAfter,
        ],
      );

      if (contract.fulfilment === 'DELIVERY' && payload.preferredDeliveryDate) {
        await createDeliveryRequestForOrder(client, {
          orderId: order.id,
          customerAccountId: customerUser.customerAccountId,
          haderCityId: contract.pricing_city_id,
          shipToLocationId: contract.delivery_location_id,
          quantityTon: requestedQuantityTons,
          requestedDate: payload.preferredDeliveryDate,
          customerUserId: customerUser.id,
        });
      }

      await client.query('commit');
      return mapOrder(order, contract, shipToSnapshot, payload);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const customerOrdersService = new CustomerOrdersService();

async function getLockedCustomerContract(
  client: PoolClient,
  customerUser: CustomerUser,
  contractId: string,
) {
  const result = await client.query<LockedContractRow>(
    `select
       contracts.id,
       contracts.reference,
       contracts.customer_account_id,
       contracts.status,
       contracts.product_id,
       product_catalog.product_code,
       product_catalog.product_name,
       contracts.packaging,
       contracts.uom,
       contracts.fulfilment,
       contracts.pickup_location_id,
       contracts.delivery_location_id,
       contracts.delivery_city,
       contracts.pricing_city_id,
       registration_drafts.delivery_locations as registration_delivery_locations,
       contracts.total_quantity_tons,
       contracts.remaining_quantity_tons,
       contracts.quantity,
       contracts.product_price,
       contracts.delivery_price,
       (
         select contract_items.id
         from contract_items
         where contract_items.contract_id = contracts.id
           and contract_items.product_id = contracts.product_id
         order by contract_items.display_order asc
         limit 1
       ) as contract_item_id
     from contracts
     inner join product_catalog on product_catalog.id = contracts.product_id
     inner join customer_accounts on customer_accounts.id = contracts.customer_account_id
     inner join registration_drafts on registration_drafts.id = customer_accounts.registration_id
     where contracts.id = $1
       and contracts.customer_account_id = $2
     for update of contracts`,
    [contractId, customerUser.customerAccountId],
  );

  const contract = result.rows[0];
  if (!contract) {
    throw new AppError('Contract was not found.', 404, 'CUSTOMER_CONTRACT_NOT_FOUND');
  }
  return contract;
}

function validateContractForOrder(contract: LockedContractRow) {
  if (contract.status !== 'ACTIVE') {
    throw new AppError(
      'Only active contracts can be used to create orders.',
      409,
      'CONTRACT_NOT_ACTIVE',
    );
  }
  if (contract.fulfilment === 'DELIVERY' && !contract.delivery_location_id) {
    throw new AppError(
      'The contract does not have a valid ship-to location.',
      409,
      'CONTRACT_SHIP_TO_REQUIRED',
    );
  }
  if (contract.fulfilment === 'PICKUP' && !contract.pickup_location_id) {
    throw new AppError(
      'The contract does not have a valid pickup location.',
      409,
      'CONTRACT_PICKUP_REQUIRED',
    );
  }
  if (contractRemainingTons(contract) <= 0) {
    throw new AppError(
      'The contract has no remaining quantity.',
      409,
      'CONTRACT_QUANTITY_EXHAUSTED',
    );
  }
}

function contractRemainingTons(contract: LockedContractRow) {
  const value = Number(
    contract.remaining_quantity_tons ?? contract.total_quantity_tons ?? contract.quantity,
  );
  if (!Number.isFinite(value) || value < 0) {
    throw new AppError(
      'The contract remaining quantity is invalid.',
      409,
      'CONTRACT_REMAINING_QUANTITY_INVALID',
    );
  }
  return round(value, 3);
}

function requireOrderWriteAccess(customerUser: CustomerUser) {
  if (!orderWritableRoles.has(customerUser.role)) {
    throw new AppError(
      'Customer Administrator or Purchaser access is required.',
      403,
      'CUSTOMER_ORDER_WRITE_FORBIDDEN',
    );
  }
}

async function nextOrderNumber(client: PoolClient) {
  const result = await client.query<{ sequence: string }>(
    `select nextval('order_reference_seq')::text as sequence`,
  );
  const sequence = String(result.rows[0]?.sequence ?? '1').padStart(6, '0');
  return `ORD-${new Date().getFullYear()}-${sequence}`;
}

function mapOrder(
  order: OrderRow,
  contract: LockedContractRow,
  shipTo: DeliveryLocationSnapshot | null,
  payload: CreateCustomerOrderPayload,
) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    contractId: order.contract_id,
    contract: { id: contract.id, reference: contract.reference },
    customerAccountId: order.customer_account_id,
    status: order.status,
    requestedQuantityTons: Number(order.requested_quantity_tons),
    remainingContractQuantityTons: Number(order.remaining_contract_quantity_snapshot),
    fulfilmentType: order.fulfilment_type,
    haderCity: order.hader_city_name,
    preferredDeliveryDate: payload.preferredDeliveryDate ?? null,
    deliveryNotes: payload.deliveryNotes ?? null,
    shipTo,
    pickupLocation: order.pickup_location_id
      ? {
          id: order.pickup_location_id,
          name:
            order.pickup_location_id === 'ALSAFWA_PLANT_MAIN'
              ? 'AlSafwa Cement Plant'
              : order.pickup_location_id,
        }
      : null,
    product: {
      id: contract.product_id,
      code: contract.product_code,
      name: contract.product_name,
      packaging: contract.packaging,
      uom: contract.uom,
    },
    customerRatePerTon: Number(order.approved_customer_rate_per_ton),
    subtotal: Number(order.amount),
    vatRate: Number(order.vat_rate),
    vatAmount: Number(order.vat_amount),
    grandTotal: Number(order.grand_total),
    createdBy: order.created_by_customer_user_id,
    submittedAt: new Date(String(order.submitted_at)).toISOString(),
    createdAt: new Date(String(order.created_at)).toISOString(),
    updatedAt: new Date(String(order.updated_at)).toISOString(),
  };
}

function resolveDeliveryLocation(contract: LockedContractRow) {
  if (contract.fulfilment !== 'DELIVERY' || !contract.delivery_location_id) return null;
  return (
    parseDeliveryLocations(contract.registration_delivery_locations).find(
      (location) => location.id === contract.delivery_location_id,
    ) ?? null
  );
}

function parseDeliveryLocations(value: unknown): DeliveryLocationSnapshot[] {
  if (Array.isArray(value)) return value as DeliveryLocationSnapshot[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as DeliveryLocationSnapshot[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
