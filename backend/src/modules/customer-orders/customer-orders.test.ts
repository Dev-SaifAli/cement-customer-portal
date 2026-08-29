import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-orders-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

const { connect, poolQuery, clientQuery, release } = vi.hoisted(() => ({
  connect: vi.fn(),
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock('../../database/pool.js', () => ({
  pool: { query: poolQuery, connect },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

const customerUserId = '11111111-1111-4111-8111-111111111111';
const customerAccountId = '22222222-2222-4222-8222-222222222222';
const contractId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';
const cityId = '66666666-6666-4666-8666-666666666666';
const clientRequestId = '99999999-9999-4999-8999-999999999999';
const truckId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const driverId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const directRequestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const activeTruckRow = {
  id: truckId,
  plate_number: 'ABC-1234',
  vehicle_type: 'Trailer',
  capacity_ton: '20.000',
  status: 'ACTIVE',
};
const activeDriverRow = {
  id: driverId,
  name: 'Ahmed Ali',
  mobile: '+966555000222',
  license_number: 'LIC-1001',
  status: 'ACTIVE',
};

const authenticatedCustomerUserRow = {
  id: customerUserId,
  customer_account_id: customerAccountId,
  name: 'Customer Admin',
  email: 'admin@example.com',
  phone: '+966555000111',
  password_hash: 'hashed-password',
  role: 'CUSTOMER_ADMIN',
  is_active: true,
  password_must_change: false,
  registration_id: '77777777-7777-4777-8777-777777777777',
  company_name: 'Activated Cement Customer',
  account_status: 'ACTIVE',
  application_status: 'ACTIVATED',
};

const activeContractRow = {
  id: contractId,
  reference: 'CT-2026-000025',
  customer_account_id: customerAccountId,
  status: 'ACTIVE',
  product_id: productId,
  product_code: 'CEM-OPC-50KG',
  product_name: 'Ordinary Portland Cement',
  packaging: 'Bag',
  uom: '50KG_BAG',
  fulfilment: 'DELIVERY',
  pickup_location_id: null,
  delivery_location_id: 'SHIP-TO-01',
  delivery_city: 'Jeddah',
  pricing_city_id: cityId,
  registration_delivery_locations: [
    {
      id: 'SHIP-TO-01',
      name: 'Main Site',
      city: 'Jeddah',
      region: 'Makkah',
      latitude: 21.5,
      longitude: 39.5,
    },
  ],
  total_quantity_tons: '100.000',
  remaining_quantity_tons: '80.000',
  quantity: '100.000',
  product_price: '195.00',
  delivery_price: '40.00',
  contract_item_id: '88888888-8888-4888-8888-888888888888',
};

function createValidCustomerToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({ sub: customerUserId, type: 'customer', iat: now, exp: now + 3600 }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function createOrderRequest(quantity = 10, overrides: Record<string, unknown> = {}) {
  return request(createApp())
    .post(`/api/v1/customer/contracts/${contractId}/orders`)
    .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
    .send({
      clientRequestId,
      requestedQuantityTons: quantity,
      preferredDeliveryDate: '2026-09-01',
      deliveryNotes: 'Call before arrival',
      ...overrides,
    });
}

function configureTransaction(
  contract = activeContractRow,
  fleet: {
    truck?: typeof activeTruckRow | null;
    driver?: typeof activeDriverRow | null;
  } = {},
  boundary = {
    type: 'Polygon',
    coordinates: [
      [
        [39, 21],
        [40, 21],
        [40, 22],
        [39, 22],
        [39, 21],
      ],
    ],
  },
) {
  connect.mockResolvedValue({ query: clientQuery, release });
  clientQuery.mockImplementation((sql: string) => {
    if (sql.includes('from contracts') && sql.includes('for update of contracts')) {
      return Promise.resolve({ rows: contract ? [contract] : [] });
    }
    if (sql.includes('from customer_trucks')) {
      return Promise.resolve({ rows: fleet.truck === null ? [] : [fleet.truck ?? activeTruckRow] });
    }
    if (sql.includes('from customer_drivers')) {
      return Promise.resolve({
        rows: fleet.driver === null ? [] : [fleet.driver ?? activeDriverRow],
      });
    }
    if (sql.includes('from ksa_cities')) {
      return Promise.resolve({
        rows: [
          {
            id: cityId,
            name: 'Jeddah',
            is_hader_enabled: true,
            is_active: true,
            delivery_boundary: boundary,
            boundary_updated_at: null,
            boundary_updated_by: null,
          },
        ],
      });
    }
    if (sql.includes("nextval('order_reference_seq')")) {
      return Promise.resolve({ rows: [{ sequence: '7' }] });
    }
    if (sql.includes('insert into orders')) {
      return Promise.resolve({
        rows: [
          {
            id: orderId,
            order_number: 'ORD-2026-000007',
            contract_id: contractId,
            customer_account_id: customerAccountId,
            ship_to_location_id: 'SHIP-TO-01',
            pickup_location_id: null,
            fulfilment_type: 'DELIVERY',
            hader_city_id: cityId,
            hader_city_name: 'Jeddah',
            created_by_customer_user_id: customerUserId,
            status: 'SUBMITTED',
            requested_quantity_tons: '10.000',
            remaining_contract_quantity_snapshot: '70.000',
            approved_customer_rate_per_ton: '235.00',
            amount: '2350.00',
            vat_rate: '15.00',
            vat_amount: '352.50',
            grand_total: '2702.50',
            submitted_at: '2026-08-26T08:00:00.000Z',
            created_at: '2026-08-26T08:00:00.000Z',
            updated_at: '2026-08-26T08:00:00.000Z',
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
  });
}

function directOrderQuery(sql: string) {
  if (sql.includes('from product_catalog')) {
    return Promise.resolve({
      rows: [
        {
          id: productId,
          product_code: 'CEM-OPC-50KG',
          product_name: 'Ordinary Portland Cement',
          packaging_type: 'Bag',
          uom: '50KG_BAG',
          unit_weight_kg: '50',
          is_white_cement: false,
          image: '/products/opc.png',
        },
      ],
    });
  }
  if (sql.includes('registration_drafts.delivery_locations')) {
    return Promise.resolve({
      rows: [
        {
          delivery_locations: [
            {
              id: 'SHIP-TO-01',
              name: 'Main Site',
              city: 'Jeddah',
              region: 'Makkah',
              latitude: 21.5,
              longitude: 39.5,
            },
          ],
        },
      ],
    });
  }
  if (sql.includes('from ksa_cities')) {
    return Promise.resolve({
      rows: [
        {
          id: cityId,
          name: 'Jeddah',
          is_hader_enabled: true,
          is_active: true,
          delivery_boundary: {
            type: 'Polygon',
            coordinates: [
              [
                [39, 21],
                [40, 21],
                [40, 22],
                [39, 22],
                [39, 21],
              ],
            ],
          },
          boundary_updated_at: null,
          boundary_updated_by: null,
        },
      ],
    });
  }
  if (sql.includes('from product_list_prices')) {
    return Promise.resolve({ rows: [{ list_price: '195.00' }] });
  }
  if (sql.includes('from hader_delivery_prices')) {
    return Promise.resolve({ rows: [{ delivery_price: '40.00' }] });
  }
  return null;
}

function directOrderReadRow() {
  return {
    id: orderId,
    order_number: 'ORD-2026-000008',
    contract_id: null,
    contract_reference: null,
    customer_account_id: customerAccountId,
    company_name: 'Activated Cement Customer',
    status: 'SUBMITTED',
    fulfilment_type: 'DELIVERY',
    requested_quantity_tons: '20.000',
    remaining_contract_quantity_snapshot: null,
    approved_customer_rate_per_ton: '235.00',
    amount: '4700.00',
    vat_rate: '15.00',
    vat_amount: '705.00',
    grand_total: '5405.00',
    preferred_delivery_date: '2026-09-01',
    delivery_notes: 'Call before arrival',
    ship_to_snapshot: {
      id: 'SHIP-TO-01',
      name: 'Main Site',
      city: 'Jeddah',
      latitude: 21.5,
      longitude: 39.5,
    },
    pickup_location_id: null,
    pickup_location_name: null,
    customer_truck_id: null,
    customer_driver_id: null,
    pickup_truck_snapshot: null,
    pickup_driver_snapshot: null,
    hader_city_name: 'Jeddah',
    submitted_at: '2026-08-27T08:00:00.000Z',
    created_at: '2026-08-27T08:00:00.000Z',
    updated_at: '2026-08-27T08:00:00.000Z',
    product_id: productId,
    product_code: 'CEM-OPC-50KG',
    product_name: 'Ordinary Portland Cement',
    packaging: 'Bag',
    contract_uom: '50KG_BAG',
    unit_weight_kg: '50.000',
    packaging_quantity: '400.000',
  };
}

describe('customer order from contract API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('requires customer authentication', async () => {
    const response = await request(createApp())
      .post(`/api/v1/customer/contracts/${contractId}/orders`)
      .send({ requestedQuantityTons: 10 });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
    expect(connect).not.toHaveBeenCalled();
  });

  it('creates a submitted order without handing it to Hader before Sales processing', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction();

    const response = await createOrderRequest(10);

    expect(response.status).toBe(201);
    expect(response.body.data.order).toMatchObject({
      orderNumber: 'ORD-2026-000007',
      contractId,
      status: 'SUBMITTED',
      requestedQuantityTons: 10,
      remainingContractQuantityTons: 70,
      fulfilmentType: 'DELIVERY',
      product: {
        id: productId,
        code: 'CEM-OPC-50KG',
      },
      customerRatePerTon: 235,
      subtotal: 2350,
    });
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('for update of contracts'), [
      contractId,
      customerAccountId,
    ]);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('update contracts'), [
      contractId,
      70,
    ]);
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('insert into delivery_requests'),
      expect.anything(),
    );
    expect(clientQuery).toHaveBeenCalledWith('commit');
    expect(release).toHaveBeenCalledOnce();
  });

  it('allows a contract delivery order outside the boundary and stores the zone flag', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction(
      activeContractRow,
      {},
      {
        type: 'Polygon',
        coordinates: [
          [
            [40, 23],
            [41, 23],
            [41, 24],
            [40, 24],
            [40, 23],
          ],
        ],
      },
    );

    const response = await createOrderRequest(10);

    expect(response.status).toBe(201);
    const insertCall = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('insert into orders'),
    );
    expect(insertCall?.[1]).toContain('OUTSIDE_HADER_ZONE');
  });

  it('does not create a Hader delivery request for a pick-up order', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction({
      ...activeContractRow,
      fulfilment: 'PICKUP',
      pickup_location_id: 'ALSAFWA_PLANT_MAIN',
      delivery_location_id: null,
      pricing_city_id: null,
    } as unknown as typeof activeContractRow);

    const response = await createOrderRequest(10, { truckId, driverId });

    expect(response.status).toBe(201);
    expect(response.body.data.order).toMatchObject({
      pickupTruck: {
        id: truckId,
        plateNumber: 'ABC-1234',
        vehicleType: 'Trailer',
        capacityTon: 20,
      },
      pickupDriver: {
        id: driverId,
        name: 'Ahmed Ali',
        licenseNumber: 'LIC-1001',
      },
    });
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('from customer_trucks'), [
      truckId,
      customerAccountId,
    ]);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('from customer_drivers'), [
      driverId,
      customerAccountId,
    ]);
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('insert into delivery_requests'),
      expect.anything(),
    );
  });

  it('requires both a truck and driver for a pick-up order', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction({
      ...activeContractRow,
      fulfilment: 'PICKUP',
      pickup_location_id: 'ALSAFWA_PLANT_MAIN',
      delivery_location_id: null,
      pricing_city_id: null,
    } as unknown as typeof activeContractRow);

    const response = await createOrderRequest(10, { preferredDeliveryDate: null });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('ORDER_PICKUP_FLEET_REQUIRED');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });

  it('rejects another customer truck', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction(
      {
        ...activeContractRow,
        fulfilment: 'PICKUP',
        pickup_location_id: 'ALSAFWA_PLANT_MAIN',
        delivery_location_id: null,
        pricing_city_id: null,
      } as unknown as typeof activeContractRow,
      { truck: null },
    );

    const response = await createOrderRequest(10, { truckId, driverId });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('ORDER_PICKUP_TRUCK_NOT_AVAILABLE');
  });

  it('rejects an inactive truck', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction(
      {
        ...activeContractRow,
        fulfilment: 'PICKUP',
        pickup_location_id: 'ALSAFWA_PLANT_MAIN',
        delivery_location_id: null,
        pricing_city_id: null,
      } as unknown as typeof activeContractRow,
      { truck: { ...activeTruckRow, status: 'INACTIVE' } },
    );

    const response = await createOrderRequest(10, { truckId, driverId });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ORDER_PICKUP_TRUCK_INACTIVE');
  });

  it('rejects an inactive driver', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction(
      {
        ...activeContractRow,
        fulfilment: 'PICKUP',
        pickup_location_id: 'ALSAFWA_PLANT_MAIN',
        delivery_location_id: null,
        pricing_city_id: null,
      } as unknown as typeof activeContractRow,
      { driver: { ...activeDriverRow, status: 'INACTIVE' } },
    );

    const response = await createOrderRequest(10, { truckId, driverId });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ORDER_PICKUP_DRIVER_INACTIVE');
  });

  it('rejects another customer driver', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction(
      {
        ...activeContractRow,
        fulfilment: 'PICKUP',
        pickup_location_id: 'ALSAFWA_PLANT_MAIN',
        delivery_location_id: null,
        pricing_city_id: null,
      } as unknown as typeof activeContractRow,
      { driver: null },
    );

    const response = await createOrderRequest(10, { truckId, driverId });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('ORDER_PICKUP_DRIVER_NOT_AVAILABLE');
  });

  it('rejects a truck below the requested TON capacity', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction(
      {
        ...activeContractRow,
        fulfilment: 'PICKUP',
        pickup_location_id: 'ALSAFWA_PLANT_MAIN',
        delivery_location_id: null,
        pricing_city_id: null,
      } as unknown as typeof activeContractRow,
      { truck: { ...activeTruckRow, capacity_ton: '5.000' } },
    );

    const response = await createOrderRequest(10, { truckId, driverId });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ORDER_PICKUP_TRUCK_CAPACITY_EXCEEDED');
  });

  it('does not expose a contract owned by another customer', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction(null as unknown as typeof activeContractRow);

    const response = await createOrderRequest();

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CUSTOMER_CONTRACT_NOT_FOUND');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('insert into orders'),
      expect.anything(),
    );
  });

  it('rejects a contract that is not active', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction({ ...activeContractRow, status: 'DRAFT' });

    const response = await createOrderRequest();

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONTRACT_NOT_ACTIVE');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });

  it('rejects quantity above the locked remaining contract quantity', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    configureTransaction();

    const response = await createOrderRequest(80.001);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ORDER_QUANTITY_EXCEEDS_CONTRACT_REMAINING');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('update contracts'),
      expect.anything(),
    );
  });

  it('prevents a Viewer from creating an order', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ ...authenticatedCustomerUserRow, role: 'VIEWER' }],
    });

    const response = await createOrderRequest();

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CUSTOMER_ORDER_WRITE_FORBIDDEN');
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns the existing order for a repeated client request without reducing quantity twice', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [authenticatedCustomerUserRow] });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('client_request_id = $2')) {
        return Promise.resolve({
          rows: [
            {
              id: orderId,
              order_number: 'ORD-2026-000007',
              contract_id: contractId,
              contract_reference: 'CT-2026-000025',
              customer_account_id: customerAccountId,
              company_name: 'Activated Cement Customer',
              status: 'SUBMITTED',
              fulfilment_type: 'DELIVERY',
              requested_quantity_tons: '10.000',
              remaining_contract_quantity_snapshot: '70.000',
              approved_customer_rate_per_ton: '235.00',
              amount: '2350.00',
              vat_rate: '15.00',
              vat_amount: '352.50',
              grand_total: '2702.50',
              preferred_delivery_date: '2026-09-01',
              delivery_notes: null,
              ship_to_snapshot: { id: 'SHIP-TO-01', name: 'Main Site' },
              pickup_location_id: null,
              pickup_location_name: null,
              hader_city_name: 'Jeddah',
              submitted_at: '2026-08-26T08:00:00.000Z',
              created_at: '2026-08-26T08:00:00.000Z',
              updated_at: '2026-08-26T08:00:00.000Z',
              product_id: productId,
              product_code: 'CEM-OPC-50KG',
              product_name: 'Ordinary Portland Cement',
              packaging: 'Bag',
              contract_uom: '50KG_BAG',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await createOrderRequest();

    expect(response.status).toBe(201);
    expect(response.body.data.order.orderNumber).toBe('ORD-2026-000007');
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('update contracts'),
      expect.anything(),
    );
    expect(clientQuery).toHaveBeenCalledWith('commit');
  });
});

describe('customer direct order API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('calculates a customer-safe delivered rate from authoritative per-TON pricing', async () => {
    poolQuery.mockImplementation((sql: string) => {
      if (sql.includes('from customer_users'))
        return Promise.resolve({ rows: [authenticatedCustomerUserRow] });
      return directOrderQuery(sql) ?? Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post('/api/v1/customer/orders/price')
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({
        productId,
        quantityTons: 20,
        fulfilmentType: 'DELIVERY',
        shipToLocationId: 'SHIP-TO-01',
        pickupLocationId: null,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.pricing).toMatchObject({
      quantityTons: 20,
      equivalentPackagingUnits: 400,
      customerRatePerTon: 235,
      subtotal: 4700,
      vatRate: 15,
      vatAmount: 705,
      grandTotal: 5405,
    });
    expect(response.body.data.pricing).not.toHaveProperty('productPrice');
    expect(response.body.data.pricing).not.toHaveProperty('deliveryPrice');
  });

  it('blocks a direct delivery order when its ship-to point is outside the configured boundary', async () => {
    poolQuery.mockImplementation((sql: string) => {
      if (sql.includes('from customer_users'))
        return Promise.resolve({ rows: [authenticatedCustomerUserRow] });
      if (sql.includes('registration_drafts.delivery_locations')) {
        return Promise.resolve({
          rows: [
            {
              delivery_locations: [
                {
                  id: 'SHIP-TO-01',
                  name: 'Outside Site',
                  city: 'Jeddah',
                  region: 'Makkah',
                  latitude: 25,
                  longitude: 45,
                },
              ],
            },
          ],
        });
      }
      return directOrderQuery(sql) ?? Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post('/api/v1/customer/orders/price')
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({
        productId,
        quantityTons: 20,
        fulfilmentType: 'DELIVERY',
        shipToLocationId: 'SHIP-TO-01',
        pickupLocationId: null,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DIRECT_ORDER_OUTSIDE_HADER_ZONE');
    expect(response.body.message).toBe(
      'Selected location is outside the current delivery service boundary.',
    );
  });

  it('creates a submitted direct order with a null contract and recalculated totals', async () => {
    poolQuery.mockImplementation((sql: string) => {
      if (sql.includes('from customer_users'))
        return Promise.resolve({ rows: [authenticatedCustomerUserRow] });
      if (sql.includes('from orders')) return Promise.resolve({ rows: [directOrderReadRow()] });
      return Promise.resolve({ rows: [] });
    });
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      const pricingResult = directOrderQuery(sql);
      if (pricingResult) return pricingResult;
      if (sql.includes("nextval('order_reference_seq')"))
        return Promise.resolve({ rows: [{ sequence: '8' }] });
      if (sql.includes('insert into orders')) return Promise.resolve({ rows: [{ id: orderId }] });
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post('/api/v1/customer/orders')
      .set({ Cookie: `customer_session=${createValidCustomerToken()}` })
      .send({
        clientRequestId: directRequestId,
        productId,
        quantityTons: 20,
        fulfilmentType: 'DELIVERY',
        shipToLocationId: 'SHIP-TO-01',
        pickupLocationId: null,
        requestedDeliveryDate: '2026-09-01',
        notes: 'Call before arrival',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.order).toMatchObject({
      contract: null,
      orderType: 'DIRECT',
      requestedQuantityTons: 20,
      product: {
        unitWeightKg: 50,
        equivalentPackagingUnits: 400,
      },
      customerRatePerTon: 235,
      subtotal: 4700,
      grandTotal: 5405,
    });
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('insert into orders'),
      expect.arrayContaining([customerAccountId, 'DELIVERY', cityId, 20, 235, 4700]),
    );
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('update contracts'),
      expect.anything(),
    );
    const eventCall = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('insert into order_events'),
    );
    expect(eventCall?.[0]).toContain('DIRECT_ORDER_CREATED');
    expect(eventCall?.[0]).toContain('ORDER_SUBMITTED');
    expect(eventCall?.[1]).toEqual(
      expect.arrayContaining([orderId, customerUserId, expect.stringContaining('ORD-2026-000008')]),
    );
  });
});
