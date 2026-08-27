import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-fleet-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
  return {
    poolQuery: vi.fn(),
    poolConnect: vi.fn(),
    clientQuery: vi.fn(),
    clientRelease: vi.fn(),
  };
});

vi.mock('../../database/pool.js', () => ({
  pool: { query: mocks.poolQuery, connect: mocks.poolConnect },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import { customerFleetService } from './customer-fleet.service.js';
import { createDriverSchema, createTruckSchema } from './customer-fleet.validation.js';

describe('customer fleet foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.poolConnect.mockResolvedValue({
      query: mocks.clientQuery,
      release: mocks.clientRelease,
    });
  });

  it('requires customer authentication for trucks', async () => {
    const response = await request(createApp()).get('/api/v1/customer/trucks');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
  });

  it('requires customer authentication for drivers', async () => {
    const response = await request(createApp()).get('/api/v1/customer/drivers');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CUSTOMER_AUTH_REQUIRED');
  });

  it('rejects zero truck capacity', () => {
    const result = createTruckSchema.safeParse({
      plateNumber: 'ABC-1234',
      vehicleType: 'Flatbed Truck',
      capacityTon: 0,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid Saudi driver mobile', () => {
    const result = createDriverSchema.safeParse({
      name: 'Ahmed Driver',
      mobile: '+966512345678',
      licenseNumber: 'LIC-1001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid driver mobile', () => {
    const result = createDriverSchema.safeParse({
      name: 'Ahmed Driver',
      mobile: '0512345678',
      licenseNumber: 'LIC-1001',
    });
    expect(result.success).toBe(false);
  });

  it('returns a conflict when a truck plate already exists for the customer', async () => {
    mocks.clientQuery
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: '23505' })
      .mockResolvedValueOnce({});

    await expect(
      customerFleetService.createTruck(customerUser, {
        plateNumber: 'ABC-1234',
        vehicleType: 'Flatbed Truck',
        capacityTon: 20,
        status: 'ACTIVE',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CUSTOMER_FLEET_DUPLICATE' });
  });

  it('returns a conflict when a driver license already exists for the customer', async () => {
    mocks.clientQuery
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: '23505' })
      .mockResolvedValueOnce({});

    await expect(
      customerFleetService.createDriver(customerUser, {
        name: 'Ahmed Driver',
        mobile: '+966512345678',
        licenseNumber: 'LIC-1001',
        status: 'ACTIVE',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CUSTOMER_FLEET_DUPLICATE' });
  });

  it('scopes truck listings to the authenticated customer account', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });

    await customerFleetService.listTrucks(customerUser, { page: 1 });

    expect(mocks.poolQuery).toHaveBeenCalledWith(expect.any(String), [
      customerUser.account.id,
      null,
      null,
      10,
      0,
    ]);
  });

  it('rejects updates to a truck outside the authenticated customer account', async () => {
    mocks.clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    await expect(
      customerFleetService.updateTruck(customerUser, 'other-customer-truck', {
        status: 'INACTIVE',
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'CUSTOMER_FLEET_NOT_FOUND' });

    expect(mocks.clientQuery).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      [customerUser.account.id, 'other-customer-truck'],
    );
  });

  it('records old and new values when a truck is updated', async () => {
    const before = truckRow({ status: 'ACTIVE', capacity_ton: '20' });
    const after = truckRow({ status: 'INACTIVE', capacity_ton: '25' });
    mocks.clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [before] })
      .mockResolvedValueOnce({ rows: [after] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await customerFleetService.updateTruck(customerUser, before.id, {
      capacityTon: 25,
      status: 'INACTIVE',
    });

    const eventCall = mocks.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('insert into customer_fleet_events'),
    );
    expect(eventCall?.[1]).toEqual([
      customerUser.account.id,
      'TRUCK',
      before.id,
      'TRUCK_DEACTIVATED',
      customerUser.id,
      {
        oldValue: {
          id: before.id,
          truckNumber: before.truck_number,
          plateNumber: before.plate_number,
          vehicleType: before.vehicle_type,
          capacityTon: 20,
          carrierName: before.carrier_name,
          status: before.status,
        },
        newValue: {
          id: after.id,
          truckNumber: after.truck_number,
          plateNumber: after.plate_number,
          vehicleType: after.vehicle_type,
          capacityTon: 25,
          carrierName: after.carrier_name,
          status: after.status,
        },
      },
    ]);
  });
});

const customerUser: CustomerUser = {
  id: 'user-1',
  customerAccountId: 'account-1',
  name: 'Customer Admin',
  email: 'admin@example.com',
  phone: '+966512345678',
  role: 'CUSTOMER_ADMIN',
  isActive: true,
  passwordMustChange: false,
  account: {
    id: 'account-1',
    registrationId: 'registration-1',
    companyName: 'Example Cement Customer',
    status: 'ACTIVE',
  },
};

function truckRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'truck-1',
    truck_number: 'TRK-000001',
    plate_number: 'ABC-1234',
    vehicle_type: 'Flatbed Truck',
    capacity_ton: '20',
    carrier_name: null,
    status: 'ACTIVE',
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T00:00:00.000Z',
    ...overrides,
  };
}
