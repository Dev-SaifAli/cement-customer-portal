import type { PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import { notificationEvents } from '../notifications/notification-events.js';
import {
  packagingQuantityFromTons,
  requireProductWeightConfiguration,
} from '../products/commercial-quantity.js';
import { pricingLookupService } from '../pricing/pricing-lookup.service.js';
import { ordersRepository } from './orders.repository.js';
import type {
  CreateCustomerOrderPayload,
  CreateDirectOrderPayload,
  DirectOrderPricingPayload,
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

interface PickupTruckRow {
  id: string;
  plate_number: string;
  vehicle_type: string;
  capacity_ton: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface PickupDriverRow {
  id: string;
  name: string;
  mobile: string;
  license_number: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface PickupFleetSnapshot {
  truck: {
    id: string;
    plateNumber: string;
    vehicleType: string;
    capacityTon: number;
  };
  driver: {
    id: string;
    name: string;
    mobile: string;
    licenseNumber: string;
  };
}

interface OrderRow {
  id: string;
  order_number: string;
  contract_id: string | null;
  customer_account_id: string;
  ship_to_location_id: string | null;
  pickup_location_id: string | null;
  fulfilment_type: 'PICKUP' | 'DELIVERY';
  hader_city_id: string | null;
  hader_city_name: string | null;
  created_by_customer_user_id: string;
  status: 'SUBMITTED';
  requested_quantity_tons: string;
  remaining_contract_quantity_snapshot: string | null;
  approved_customer_rate_per_ton: string;
  amount: string;
  submitted_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  vat_rate: string;
  vat_amount: string;
  grand_total: string;
  customer_truck_id: string | null;
  customer_driver_id: string | null;
  pickup_truck_snapshot: unknown;
  pickup_driver_snapshot: unknown;
}

interface DirectProductRow {
  id: string;
  product_code: string;
  product_name: string;
  packaging_type: string;
  uom: string;
  unit_weight_kg: string;
  is_white_cement: boolean;
  image: string | null;
}

interface PricingCityRow {
  id: string;
  name: string;
  is_hader_enabled: boolean;
}

interface DirectOrderContext {
  product: DirectProductRow;
  city: PricingCityRow;
  shipTo: DeliveryLocationSnapshot | null;
  pickupLocation: { id: string; name: string; city: string } | null;
  quantityTons: number;
  equivalentPackagingUnits: number | null;
  customerRatePerTon: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
}

type QueryExecutor = Pick<PoolClient, 'query'>;

const directOrderPickupLocations = [
  { id: 'ALSAFWA_PLANT_MAIN', name: 'AlSafwa Cement Plant', city: 'Jeddah' },
] as const;

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

  async priceDirect(customerUser: CustomerUser, payload: DirectOrderPricingPayload) {
    requireOrderWriteAccess(customerUser);
    const context = await resolveDirectOrderContext(customerUser, payload);
    return mapDirectPricing(context);
  }

  async createDirect(customerUser: CustomerUser, payload: CreateDirectOrderPayload) {
    requireOrderWriteAccess(customerUser);
    const client = await pool.connect();
    let createdOrderId: string | null = null;

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
        if (existingOrder.contract !== null) {
          throw new AppError(
            'The order request identifier has already been used.',
            409,
            'ORDER_REQUEST_ID_REUSED',
          );
        }
        await client.query('commit');
        return existingOrder;
      }

      const context = await resolveDirectOrderContext(customerUser, payload, client);
      if (payload.fulfilmentType === 'DELIVERY' && !payload.requestedDeliveryDate) {
        throw new AppError(
          'Requested delivery date is required for delivery orders.',
          400,
          'ORDER_DELIVERY_DATE_REQUIRED',
        );
      }

      const orderNumber = await nextOrderNumber(client);
      const orderResult = await client.query<{ id: string }>(
        `insert into orders (
           order_number, contract_id, customer_account_id, ship_to_location_id,
           pickup_location_id, fulfilment_type, hader_city_id, hader_city_name,
           created_by_customer_user_id, status, requested_quantity_tons,
           remaining_contract_quantity_snapshot, approved_customer_rate_per_ton,
           amount, client_request_id, preferred_delivery_date, delivery_notes,
           ship_to_snapshot, pickup_location_name, vat_rate, vat_amount, grand_total,
           submitted_at
         ) values (
           $1, null, $2, $3, $4, $5, $6, $7, $8, 'SUBMITTED', $9, null, $10, $11,
           $12, $13, $14, $15::jsonb, $16, $17, $18, $19, now()
         ) returning id`,
        [
          orderNumber,
          customerUser.customerAccountId,
          context.shipTo?.id ?? null,
          context.pickupLocation?.id ?? null,
          payload.fulfilmentType,
          context.city.id,
          context.city.name,
          customerUser.id,
          context.quantityTons,
          context.customerRatePerTon,
          context.subtotal,
          payload.clientRequestId,
          payload.requestedDeliveryDate ?? null,
          payload.notes ?? null,
          context.shipTo ? JSON.stringify(context.shipTo) : null,
          context.pickupLocation?.name ?? null,
          context.vatRate,
          context.vatAmount,
          context.grandTotal,
        ],
      );
      const orderId = orderResult.rows[0]?.id;
      if (!orderId) throw new AppError('Order could not be created.', 503, 'ORDER_CREATE_FAILED');
      createdOrderId = orderId;

      await client.query(
        `insert into order_items (
           order_id, contract_item_id, product_id, product_code, product_name,
           packaging, contract_uom, requested_quantity_tons, equivalent_tons,
           approved_customer_rate_per_ton, amount, unit_weight_kg, packaging_quantity
         ) values ($1, null, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11)`,
        [
          orderId,
          context.product.id,
          context.product.product_code,
          context.product.product_name,
          context.product.packaging_type,
          context.product.uom,
          context.quantityTons,
          context.customerRatePerTon,
          context.subtotal,
          Number(context.product.unit_weight_kg),
          context.equivalentPackagingUnits,
        ],
      );

      await client.query(
        `insert into order_events (
           order_id, event_type, previous_status, new_status,
           changed_by_customer_user_id, event_data
         ) values
           ($1, 'DIRECT_ORDER_CREATED', null, 'SUBMITTED', $2, $3::jsonb),
           ($1, 'ORDER_SUBMITTED', null, 'SUBMITTED', $2, $4::jsonb)`,
        [
          orderId,
          customerUser.id,
          JSON.stringify({
            source: 'DIRECT',
            orderReference: orderNumber,
            productId: context.product.id,
            quantityTons: context.quantityTons,
          }),
          JSON.stringify({
            source: 'DIRECT',
            orderReference: orderNumber,
            submittedBy: customerUser.id,
          }),
        ],
      );

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    const createdOrder = createdOrderId
      ? await ordersRepository.getById(createdOrderId, {
          customerAccountId: customerUser.customerAccountId,
        })
      : null;
    if (!createdOrder) throw new AppError('Order could not be loaded.', 503, 'ORDER_LOAD_FAILED');
    await notificationEvents.orderSubmitted(createdOrder.id, createdOrder.orderNumber);
    return createdOrder;
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
        if (!existingOrder.contract || existingOrder.contract.id !== contractId) {
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

      const pickupFleet = await resolvePickupFleet(
        client,
        customerUser,
        contract,
        payload,
        requestedQuantityTons,
      );

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
           customer_truck_id,
           customer_driver_id,
           pickup_truck_snapshot,
           pickup_driver_snapshot,
           submitted_at
         )
         values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUBMITTED', $10, $11, $12, $13,
           $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, now()
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
          pickupFleet?.truck.id ?? null,
          pickupFleet?.driver.id ?? null,
          pickupFleet ? JSON.stringify(pickupFleet.truck) : null,
          pickupFleet ? JSON.stringify(pickupFleet.driver) : null,
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
        [
          order.id,
          customerUser.id,
          JSON.stringify({
            contractId: contract.id,
            customerTruckId: pickupFleet?.truck.id ?? null,
            customerDriverId: pickupFleet?.driver.id ?? null,
          }),
        ],
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

      await client.query('commit');
      const createdOrder = mapOrder(order, contract, shipToSnapshot, payload, pickupFleet);
      await notificationEvents.orderSubmitted(createdOrder.id, createdOrder.orderNumber);
      return createdOrder;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function resolveDirectOrderContext(
  customerUser: CustomerUser,
  payload: DirectOrderPricingPayload,
  executor: QueryExecutor = pool,
): Promise<DirectOrderContext> {
  const productResult = await executor.query<DirectProductRow>(
    `select id, product_code, product_name, packaging_type, uom,
            unit_weight_kg, is_white_cement, image
     from product_catalog
     where id = $1 and is_active = true
     limit 1`,
    [payload.productId],
  );
  const product = productResult.rows[0];
  if (!product) {
    throw new AppError(
      'The selected product is not available.',
      404,
      'DIRECT_ORDER_PRODUCT_NOT_FOUND',
    );
  }

  const quantityTons = round(payload.quantityTons, 3);
  const unitWeightKg = Number(product.unit_weight_kg);
  requireProductWeightConfiguration(unitWeightKg, product.uom);
  const equivalentPackagingUnits = packagingQuantityFromTons(
    quantityTons,
    unitWeightKg,
    product.uom,
  );

  let shipTo: DeliveryLocationSnapshot | null = null;
  let pickupLocation: DirectOrderContext['pickupLocation'] = null;
  let pricingCityName: string;

  if (payload.fulfilmentType === 'DELIVERY') {
    if (!payload.shipToLocationId) {
      throw new AppError(
        'A ship-to location is required for delivery orders.',
        400,
        'DIRECT_ORDER_SHIP_TO_REQUIRED',
      );
    }

    const locationResult = await executor.query<{ delivery_locations: unknown }>(
      `select registration_drafts.delivery_locations
       from customer_accounts
       inner join registration_drafts
         on registration_drafts.id = customer_accounts.registration_id
       where customer_accounts.id = $1
         and customer_accounts.registration_id = $2
       limit 1`,
      [customerUser.account.id, customerUser.account.registrationId],
    );
    shipTo =
      parseDeliveryLocations(locationResult.rows[0]?.delivery_locations).find(
        (location) => location.id === payload.shipToLocationId,
      ) ?? null;
    if (!shipTo) {
      throw new AppError(
        'The selected delivery location is not available for this customer.',
        404,
        'DIRECT_ORDER_SHIP_TO_NOT_FOUND',
      );
    }
    if (!shipTo.city?.trim()) {
      throw new AppError(
        'Pricing city is not configured for this delivery location.',
        400,
        'DIRECT_ORDER_PRICING_CITY_MISSING',
      );
    }
    pricingCityName = shipTo.city;
  } else {
    if (!payload.pickupLocationId) {
      throw new AppError(
        'A pickup location is required for pick-up orders.',
        400,
        'DIRECT_ORDER_PICKUP_REQUIRED',
      );
    }
    pickupLocation =
      directOrderPickupLocations.find((location) => location.id === payload.pickupLocationId) ??
      null;
    if (!pickupLocation) {
      throw new AppError(
        'The selected pickup location is not available.',
        404,
        'DIRECT_ORDER_PICKUP_NOT_FOUND',
      );
    }
    pricingCityName = pickupLocation.city;
  }

  const cityResult = await executor.query<PricingCityRow>(
    `select id, name, is_hader_enabled
     from ksa_cities
     where name_key = lower(regexp_replace(btrim($1), '\\s+', ' ', 'g'))
       and is_active = true
     limit 1`,
    [pricingCityName],
  );
  const city = cityResult.rows[0];
  if (!city) {
    throw new AppError(
      'Pricing city is not configured for this delivery location.',
      400,
      'DIRECT_ORDER_PRICING_CITY_MISSING',
    );
  }

  const productPrice = await pricingLookupService.getProductListPrice(
    { productId: product.id, cityId: city.id, packaging: product.packaging_type },
    executor,
  );
  if (productPrice === null) {
    throw new AppError(
      `List pricing is not configured for ${product.product_code} in ${city.name}.`,
      409,
      'DIRECT_ORDER_PRODUCT_PRICING_MISSING',
    );
  }

  let deliveryPrice = 0;
  if (payload.fulfilmentType === 'DELIVERY') {
    if (!city.is_hader_enabled) {
      throw new AppError(
        'Hader delivery is not configured for the selected city.',
        409,
        'DIRECT_ORDER_HADER_CITY_UNAVAILABLE',
      );
    }
    const configuredDeliveryPrice = await pricingLookupService.getHaderDeliveryPrice(
      { cityId: city.id, isWhiteCement: product.is_white_cement },
      executor,
    );
    if (configuredDeliveryPrice === null) {
      throw new AppError(
        `Delivery pricing is not configured for ${city.name}.`,
        409,
        'DIRECT_ORDER_DELIVERY_PRICING_MISSING',
      );
    }
    deliveryPrice = configuredDeliveryPrice;
  }

  const customerRatePerTon = round(productPrice + deliveryPrice, 2);
  const subtotal = round(quantityTons * customerRatePerTon, 2);
  const vatRate = round(env.QUOTATION_VAT_RATE * 100, 2);
  const vatAmount = round(subtotal * env.QUOTATION_VAT_RATE, 2);

  return {
    product,
    city,
    shipTo,
    pickupLocation,
    quantityTons,
    equivalentPackagingUnits,
    customerRatePerTon,
    subtotal,
    vatRate,
    vatAmount,
    grandTotal: round(subtotal + vatAmount, 2),
  };
}

function mapDirectPricing(context: DirectOrderContext) {
  return {
    product: {
      id: context.product.id,
      code: context.product.product_code,
      name: context.product.product_name,
      image: context.product.image,
      packaging: context.product.packaging_type,
      uom: context.product.uom,
      commercialUom: 'TON' as const,
    },
    quantityTons: context.quantityTons,
    equivalentPackagingUnits: context.equivalentPackagingUnits,
    fulfilmentType: context.shipTo ? ('DELIVERY' as const) : ('PICKUP' as const),
    haderCity: { id: context.city.id, name: context.city.name },
    shipTo: context.shipTo,
    pickupLocation: context.pickupLocation,
    customerRatePerTon: context.customerRatePerTon,
    subtotal: context.subtotal,
    vatRate: context.vatRate,
    vatAmount: context.vatAmount,
    grandTotal: context.grandTotal,
  };
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

async function resolvePickupFleet(
  client: PoolClient,
  customerUser: CustomerUser,
  contract: LockedContractRow,
  payload: CreateCustomerOrderPayload,
  requestedQuantityTons: number,
): Promise<PickupFleetSnapshot | null> {
  if (contract.fulfilment !== 'PICKUP') return null;
  if (!payload.truckId || !payload.driverId) {
    throw new AppError(
      'Truck and driver are required for pickup orders.',
      400,
      'ORDER_PICKUP_FLEET_REQUIRED',
    );
  }

  const truckResult = await client.query<PickupTruckRow>(
    `select id, plate_number, vehicle_type, capacity_ton, status
     from customer_trucks
     where id = $1 and customer_account_id = $2
     for share`,
    [payload.truckId, customerUser.customerAccountId],
  );
  const truck = truckResult.rows[0];
  if (!truck) {
    throw new AppError(
      'Selected truck is not available for this customer.',
      400,
      'ORDER_PICKUP_TRUCK_NOT_AVAILABLE',
    );
  }
  if (truck.status !== 'ACTIVE') {
    throw new AppError('Selected truck is inactive.', 409, 'ORDER_PICKUP_TRUCK_INACTIVE');
  }
  if (Number(truck.capacity_ton) < requestedQuantityTons) {
    throw new AppError(
      'Selected truck capacity is lower than order quantity.',
      409,
      'ORDER_PICKUP_TRUCK_CAPACITY_EXCEEDED',
    );
  }

  const driverResult = await client.query<PickupDriverRow>(
    `select id, name, mobile, license_number, status
     from customer_drivers
     where id = $1 and customer_account_id = $2
     for share`,
    [payload.driverId, customerUser.customerAccountId],
  );
  const driver = driverResult.rows[0];
  if (!driver) {
    throw new AppError(
      'Selected driver is not available for this customer.',
      400,
      'ORDER_PICKUP_DRIVER_NOT_AVAILABLE',
    );
  }
  if (driver.status !== 'ACTIVE') {
    throw new AppError('Selected driver is inactive.', 409, 'ORDER_PICKUP_DRIVER_INACTIVE');
  }

  return {
    truck: {
      id: truck.id,
      plateNumber: truck.plate_number,
      vehicleType: truck.vehicle_type,
      capacityTon: Number(truck.capacity_ton),
    },
    driver: {
      id: driver.id,
      name: driver.name,
      mobile: driver.mobile,
      licenseNumber: driver.license_number,
    },
  };
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
  pickupFleet: PickupFleetSnapshot | null,
) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    contractId: order.contract_id,
    contract: { id: contract.id, reference: contract.reference },
    orderType: 'CONTRACT' as const,
    customerAccountId: order.customer_account_id,
    status: order.status,
    requestedQuantityTons: Number(order.requested_quantity_tons),
    remainingContractQuantityTons: Number(order.remaining_contract_quantity_snapshot),
    fulfilmentType: order.fulfilment_type,
    haderCity: order.hader_city_name,
    deliveryRequest: null,
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
    pickupTruck: pickupFleet?.truck ?? null,
    pickupDriver: pickupFleet?.driver ?? null,
    product: {
      id: contract.product_id,
      code: contract.product_code,
      name: contract.product_name,
      packaging: contract.packaging,
      uom: contract.uom,
      unitWeightKg: null,
      equivalentPackagingUnits: null,
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
