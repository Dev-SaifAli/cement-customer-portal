import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-customer-fleet-secret-with-at-least-32-chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';
});

vi.mock('../../database/pool.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';
import { createDriverSchema, createTruckSchema } from './customer-fleet.validation.js';

describe('customer fleet foundation', () => {
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
});
