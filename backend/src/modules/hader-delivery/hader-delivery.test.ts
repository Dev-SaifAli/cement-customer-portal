import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-hader-delivery-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});
const { poolQuery, connect, clientQuery, release } = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));
vi.mock('../../database/pool.js', () => ({
  pool: { query: poolQuery, connect },
  closeDatabase: vi.fn(),
}));
import { createApp } from '../../app.js';

const userId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(
    JSON.stringify({ sub: userId, type: 'sales', iat: now, exp: now + 3600 }),
  ).toString('base64url');
  const s = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${h}.${p}`)
    .digest('base64url');
  return `${h}.${p}.${s}`;
}
function auth(role: string, fallback?: (sql: string) => { rows: unknown[] }) {
  poolQuery.mockImplementation((sql: string) =>
    sql.includes('from sales_users')
      ? Promise.resolve({
          rows: [
            {
              id: userId,
              name: 'Hader User',
              email: 'hader@example.com',
              password_hash: 'hash',
              is_active: true,
              role,
            },
          ],
        })
      : Promise.resolve(fallback?.(sql) ?? { rows: [] }),
  );
}
describe('Hader delivery APIs', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });
  it('requires internal authentication', async () => {
    const response = await request(createApp()).get('/api/v1/hader/delivery-requests');
    expect(response.status).toBe(401);
  });
  it('blocks a Sales Representative from Hader requests', async () => {
    auth('SALES_REP');
    const response = await request(createApp())
      .get('/api/v1/hader/delivery-requests')
      .set({ Cookie: `sales_session=${token()}` });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('SALES_ROLE_FORBIDDEN');
  });
  it('lists a delivery request created from a direct order', async () => {
    const orderId = '33333333-3333-4333-8333-333333333333';
    auth('HADER_OPERATIONS', (sql) => {
      if (sql.includes('select count(*)::text as total')) return { rows: [{ total: '1' }] };
      if (sql.includes('from delivery_requests dr')) {
        return {
          rows: [
            {
              ...deliveryRequestRow(orderId, 'PENDING'),
              contract_id: null,
              contract_reference: null,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const response = await request(createApp())
      .get('/api/v1/hader/delivery-requests')
      .set({ Cookie: `sales_session=${token()}` });

    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toMatchObject({
      requestNumber: 'DR26000001',
      status: 'PENDING',
      contract: null,
      order: { number: 'ORD-2026-000001' },
    });
    expect(
      poolQuery.mock.calls.some(([sql]) => String(sql).includes("sx.status<>'CANCELLED'")),
    ).toBe(true);
  });
  it.each(['/api/v1/hader/shipments', '/api/v1/hader/dispatch'])(
    'filters %s by the authoritative shipment scheduled date',
    async (path) => {
      const shipmentId = '55555555-5555-4555-8555-555555555555';
      const orderId = '33333333-3333-4333-8333-333333333333';
      auth('HADER_OPERATIONS', (sql) => {
        if (sql.includes('select count(*)::text as total')) return { rows: [{ total: '1' }] };
        if (sql.includes('inner join shipments s')) {
          return { rows: [shipmentRow(shipmentId, orderId)] };
        }
        return { rows: [] };
      });

      const response = await request(createApp())
        .get(`${path}?scheduledDate=2026-09-30`)
        .set({ Cookie: `sales_session=${token()}` });

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
      expect(
        poolQuery.mock.calls.some(
          ([sql, values]) =>
            String(sql).includes('s.scheduled_date=$1') &&
            Array.isArray(values) &&
            values[0] === '2026-09-30',
        ),
      ).toBe(true);
    },
  );
  it('returns authoritative allocation totals and all shipment history for a request', async () => {
    const orderId = '33333333-3333-4333-8333-333333333333';
    auth('HADER_OPERATIONS', (sql) => {
      if (sql.includes('select s.id,s.shipment_number')) {
        return {
          rows: [
            requestShipmentRow('55555555-5555-4555-8555-555555555551', '400.000', 'ASSIGNED'),
            requestShipmentRow('55555555-5555-4555-8555-555555555552', '350.000', 'CANCELLED'),
            requestShipmentRow('55555555-5555-4555-8555-555555555553', '250.000', 'CREATED'),
          ],
        };
      }
      if (sql.includes('from delivery_requests dr')) {
        return {
          rows: [
            {
              ...deliveryRequestRow(orderId, 'CONVERTED_TO_SHIPMENT'),
              quantity_ton: '1000.000',
              shipped_ton: '650.000',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const response = await request(createApp())
      .get(`/api/v1/hader/delivery-requests/${requestId}`)
      .set({ Cookie: `sales_session=${token()}` });

    expect(response.status).toBe(200);
    expect(response.body.data.request).toMatchObject({
      quantityTon: 1000,
      shippedTon: 650,
      remainingTon: 350,
    });
    expect(response.body.data.request.shipments).toHaveLength(3);
    expect(response.body.data.request.shipments[1]).toMatchObject({
      quantityTon: 350,
      status: 'CANCELLED',
    });
  });
  it('prevents split shipments from exceeding request TON', async () => {
    auth('HADER_MANAGER');
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of dr'))
        return Promise.resolve({
          rows: [
            {
              id: requestId,
              status: 'APPROVED',
              quantity_ton: '500.000',
              order_id: '33333333-3333-4333-8333-333333333333',
              customer_account_id: '44444444-4444-4444-8444-444444444444',
            },
          ],
        });
      if (sql.includes('sum(quantity_ton)'))
        return Promise.resolve({ rows: [{ total: '300.000' }] });
      return Promise.resolve({ rows: [] });
    });
    const response = await request(createApp())
      .post(`/api/v1/hader/delivery-requests/${requestId}/create-shipment`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({ quantityTon: 250 });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SHIPMENT_QUANTITY_EXCEEDS_REMAINING');
    expect(clientQuery).toHaveBeenCalledWith('rollback');
  });

  it('rejects a decimal quantity for a new shipment allocation', async () => {
    auth('HADER_MANAGER');

    const response = await request(createApp())
      .post(`/api/v1/hader/delivery-requests/${requestId}/create-shipment`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({ quantityTon: 200.5 });

    expect(response.status).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });

  it('creates a shipment and moves the order to processing', async () => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    const orderId = '33333333-3333-4333-8333-333333333333';
    auth('HADER_MANAGER', (sql) =>
      sql.includes('inner join shipments s')
        ? { rows: [shipmentRow(shipmentId, orderId)] }
        : { rows: [] },
    );
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of dr'))
        return Promise.resolve({ rows: [deliveryRequestRow(orderId, 'APPROVED')] });
      if (sql.includes('select id from shipments where')) return Promise.resolve({ rows: [] });
      if (sql.includes('sum(quantity_ton)')) return Promise.resolve({ rows: [{ total: '0' }] });
      if (sql.includes('insert into contract_shipment_number_counters'))
        return Promise.resolve({ rows: [{ suffix: 1 }] });
      if (sql.includes('insert into shipments'))
        return Promise.resolve({ rows: [{ id: shipmentId }] });
      if (sql.includes("update orders set status='PROCESSING'"))
        return Promise.resolve({ rows: [{ status: 'PROCESSING' }] });
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/hader/delivery-requests/${requestId}/create-shipment`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({
        clientRequestId: '66666666-6666-4666-8666-666666666666',
        quantityTon: 100,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.shipment.shipmentNumber).toBe('CT26000001_1');
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("update orders set status='PROCESSING'"),
      [orderId],
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("'SHIPMENT_CREATED','SUBMITTED','PROCESSING'"),
      [orderId, userId, JSON.stringify({ shipmentId, shipmentNumber: 'CT26000001_1' })],
    );
  });

  it('returns the existing shipment for a repeated client request', async () => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    const orderId = '33333333-3333-4333-8333-333333333333';
    auth('HADER_MANAGER', (sql) =>
      sql.includes('inner join shipments s')
        ? { rows: [shipmentRow(shipmentId, orderId)] }
        : { rows: [] },
    );
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of dr'))
        return Promise.resolve({
          rows: [deliveryRequestRow(orderId, 'CONVERTED_TO_SHIPMENT')],
        });
      if (sql.includes('select id from shipments where'))
        return Promise.resolve({ rows: [{ id: shipmentId }] });
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/hader/delivery-requests/${requestId}/create-shipment`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({
        clientRequestId: '66666666-6666-4666-8666-666666666666',
        quantityTon: 100,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.shipment.id).toBe(shipmentId);
    expect(
      clientQuery.mock.calls.some(([sql]) => String(sql).includes('insert into shipments')),
    ).toBe(false);
  });

  it('allows a Hader Manager to cancel a created shipment and records its previous state', async () => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    const orderId = '33333333-3333-4333-8333-333333333333';
    auth('HADER_MANAGER', (sql) =>
      sql.includes('inner join shipments s')
        ? { rows: [shipmentRow(shipmentId, orderId, 'CANCELLED', null)] }
        : { rows: [] },
    );
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('from shipments where id=$1 for update')) {
        return Promise.resolve({ rows: [cancellationRow(shipmentId, 'CREATED', null)] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/hader/shipments/${shipmentId}/cancel`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({ reason: '  Customer requested a replacement  ' });

    expect(response.status).toBe(200);
    expect(response.body.data.shipment.status).toBe('CANCELLED');
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("'SHIPMENT_CANCELLED'"),
      expect.arrayContaining([shipmentId, 'CREATED', userId, 'Customer requested a replacement']),
    );
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("set status='CANCELLED'"), [
      shipmentId,
    ]);
    expect(
      clientQuery.mock.calls.some(([sql]) =>
        String(sql).toLowerCase().includes('update contracts'),
      ),
    ).toBe(false);
  });

  it('allows Hader Operations to cancel an assigned shipment at the gate and releases loading state', async () => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    const orderId = '33333333-3333-4333-8333-333333333333';
    const loadingPointId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    auth('HADER_OPERATIONS', (sql) =>
      sql.includes('inner join shipments s')
        ? { rows: [shipmentRow(shipmentId, orderId, 'CANCELLED', null)] }
        : { rows: [] },
    );
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('from shipments where id=$1 for update')) {
        return Promise.resolve({
          rows: [cancellationRow(shipmentId, 'ASSIGNED', 'AT_GATE', loadingPointId)],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/hader/shipments/${shipmentId}/cancel`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({ reason: 'Truck unavailable' });

    expect(response.status).toBe(200);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('queue_position=null'), [
      shipmentId,
    ]);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('set status=case'), [
      loadingPointId,
    ]);
    const eventCall = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("'SHIPMENT_CANCELLED'"),
    );
    expect(JSON.parse(String(eventCall?.[1]?.[4]))).toMatchObject({
      mainStatus: 'ASSIGNED',
      loadingStatus: 'AT_GATE',
      loadingPointId,
      queuePosition: 2,
    });
  });

  it.each([
    ['ASSIGNED', 'LOADING'],
    ['ASSIGNED', 'LOADED'],
    ['DISPATCHED', null],
  ])('rejects cancellation from %s / %s', async (status, loadingStatus) => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    auth('HADER_MANAGER');
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) =>
      sql.includes('from shipments where id=$1 for update')
        ? Promise.resolve({ rows: [cancellationRow(shipmentId, status, loadingStatus)] })
        : Promise.resolve({ rows: [] }),
    );

    const response = await request(createApp())
      .post(`/api/v1/hader/shipments/${shipmentId}/cancel`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({ reason: 'Cancellation attempt' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SHIPMENT_CANCELLATION_INVALID');
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('SHIPMENT_CANCELLED'))).toBe(
      false,
    );
  });

  it('does not write another cancellation event for an already cancelled shipment', async () => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    auth('HADER_MANAGER');
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) =>
      sql.includes('from shipments where id=$1 for update')
        ? Promise.resolve({ rows: [cancellationRow(shipmentId, 'CANCELLED', null)] })
        : Promise.resolve({ rows: [] }),
    );

    const response = await request(createApp())
      .post(`/api/v1/hader/shipments/${shipmentId}/cancel`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({ reason: 'Duplicate cancellation' });

    expect(response.status).toBe(409);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('SHIPMENT_CANCELLED'))).toBe(
      false,
    );
  });

  it('requires a non-empty cancellation reason', async () => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    auth('HADER_MANAGER');

    const response = await request(createApp())
      .post(`/api/v1/hader/shipments/${shipmentId}/cancel`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({ reason: '   ' });

    expect(response.status).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });

  it.each(['DISPATCH_USER', 'DELIVERY_TEAM_USER', 'SALES_REP'])(
    'blocks %s users from cancelling shipments',
    async (role) => {
      const shipmentId = '55555555-5555-4555-8555-555555555555';
      auth(role);

      const response = await request(createApp())
        .post(`/api/v1/hader/shipments/${shipmentId}/cancel`)
        .set({ Cookie: `sales_session=${token()}` })
        .send({ reason: 'Not authorized' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('SALES_ROLE_FORBIDDEN');
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it('excludes cancelled shipments when reserving quantity for a replacement shipment', async () => {
    const shipmentId = '55555555-5555-4555-8555-555555555555';
    const orderId = '33333333-3333-4333-8333-333333333333';
    auth('HADER_MANAGER', (sql) =>
      sql.includes('inner join shipments s')
        ? { rows: [shipmentRow(shipmentId, orderId)] }
        : { rows: [] },
    );
    connect.mockResolvedValue({ query: clientQuery, release });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('for update of dr')) {
        return Promise.resolve({
          rows: [
            {
              ...deliveryRequestRow(orderId, 'CONVERTED_TO_SHIPMENT'),
              quantity_ton: '1000.000',
            },
          ],
        });
      }
      if (sql.includes('select id from shipments where')) return Promise.resolve({ rows: [] });
      if (sql.includes('sum(quantity_ton)'))
        return Promise.resolve({ rows: [{ total: '400.000' }] });
      if (sql.includes('insert into contract_shipment_number_counters')) {
        return Promise.resolve({ rows: [{ suffix: 2 }] });
      }
      if (sql.includes('insert into shipments')) {
        return Promise.resolve({ rows: [{ id: shipmentId }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createApp())
      .post(`/api/v1/hader/delivery-requests/${requestId}/create-shipment`)
      .set({ Cookie: `sales_session=${token()}` })
      .send({ quantityTon: 600 });

    expect(response.status).toBe(201);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("status<>'CANCELLED'"), [
      requestId,
    ]);
  });
});

function deliveryRequestRow(orderId: string, status: string) {
  return {
    id: requestId,
    request_number: 'DR26000001',
    order_id: orderId,
    order_number: 'ORD-2026-000001',
    contract_id: '77777777-7777-4777-8777-777777777777',
    contract_reference: 'CT26000001',
    customer_account_id: '44444444-4444-4444-8444-444444444444',
    company_name: 'Customer Company',
    contact_name: 'Customer Admin',
    contact_phone: '+966512345678',
    product_id: '88888888-8888-4888-8888-888888888888',
    product_code: 'CEM-OPC-50KG',
    product_name: 'Ordinary Portland Cement',
    packaging: 'Bag',
    contract_uom: 'TON',
    unit_weight_kg: '50',
    quantity_ton: '500.000',
    hader_city_id: '99999999-9999-4999-8999-999999999999',
    hader_city_name: 'Jeddah',
    ship_to_location_id: 'site-1',
    ship_to_snapshot: { name: 'Main Site', city: 'Jeddah' },
    requested_date: '2026-08-30',
    delivery_notes: null,
    customer_rate_per_ton: '200.00',
    total_amount: '100000.00',
    status,
    rejection_reason: null,
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T00:00:00.000Z',
    shipped_ton: '100.000',
  };
}

function shipmentRow(
  shipmentId: string,
  orderId: string,
  status = 'CREATED',
  loadingStatus: string | null = null,
) {
  return {
    ...deliveryRequestRow(orderId, 'CONVERTED_TO_SHIPMENT'),
    shipment_id: shipmentId,
    shipment_number: 'CT26000001_1',
    shipment_quantity_ton: '100.000',
    shipment_status: status,
    loading_status: loadingStatus,
    scheduled_date: null,
    delivered_at: null,
    shipment_created_at: '2026-08-27T00:00:00.000Z',
  };
}

function requestShipmentRow(id: string, quantityTon: string, status: string) {
  return {
    id,
    shipment_number: `SHP-${id.slice(-3)}`,
    quantity_ton: quantityTon,
    status,
    scheduled_date: '2026-09-30',
    loading_status: null,
    transporter_id: null,
    transporter_name: null,
    hader_truck_id: null,
    truck_number: null,
    plate_number: null,
    hader_driver_id: null,
    driver_name: null,
  };
}

function cancellationRow(
  shipmentId: string,
  status: string,
  loadingStatus: string | null,
  loadingPointId: string | null = null,
) {
  return {
    id: shipmentId,
    status,
    loading_status: loadingStatus,
    transporter_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    hader_truck_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    hader_driver_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    scheduled_date: '2026-09-30',
    scheduled_time: '09:30',
    loading_point_id: loadingPointId,
    loading_point_type: loadingPointId ? 'BAGGING_LINE' : null,
    queue_position: loadingPointId ? 2 : null,
  };
}
