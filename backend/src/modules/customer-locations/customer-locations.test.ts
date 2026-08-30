import { beforeEach, describe, expect, it, vi } from 'vitest';

const { poolQuery, clientQuery, connect } = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('../../database/pool.js', () => ({
  pool: { query: poolQuery, connect },
  closeDatabase: vi.fn(),
}));

import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import { CustomerLocationsService } from './customer-locations.service.js';

const customerUser: CustomerUser = {
  id: '11111111-1111-4111-8111-111111111111',
  customerAccountId: '22222222-2222-4222-8222-222222222222',
  name: 'Customer Admin',
  email: 'admin@example.com',
  phone: '+966512345678',
  role: 'CUSTOMER_ADMIN',
  isActive: true,
  passwordMustChange: false,
  account: {
    id: '22222222-2222-4222-8222-222222222222',
    registrationId: '33333333-3333-4333-8333-333333333333',
    companyName: 'Customer Company',
    status: 'ACTIVE',
  },
};

describe('customer delivery locations', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    connect.mockReset();
    connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });
  });

  it('returns the newest created location first', async () => {
    poolQuery.mockResolvedValue({
      rows: [
        {
          delivery_locations: [
            location('older', 'LOC-000001', '2026-08-01T00:00:00.000Z'),
            location('newer', 'LOC-000002', '2026-08-29T00:00:00.000Z'),
          ],
        },
      ],
    });

    const locations = await new CustomerLocationsService().listLocations(customerUser);

    expect(locations.map((item) => item.id)).toEqual(['newer', 'older']);
  });

  it('generates and returns a database-sequence Site ID when creating a location', async () => {
    clientQuery.mockImplementation((sql: string, values?: unknown[]) => {
      if (sql.includes('select registration_drafts.delivery_locations')) {
        return Promise.resolve({ rows: [{ delivery_locations: [] }] });
      }
      if (sql.includes("nextval('customer_location_site_id_seq')")) {
        return Promise.resolve({ rows: [{ site_id: 'LOC-000123' }] });
      }
      if (sql.includes('returning delivery_locations')) {
        return Promise.resolve({ rows: [{ delivery_locations: JSON.parse(String(values?.[2])) }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const locations = await new CustomerLocationsService().addLocation(customerUser, {
      name: 'New Site',
      streetAddress: 'Industrial Road',
      city: 'Jeddah',
      region: 'Makkah',
      country: 'Saudi Arabia',
      postalCode: '21442',
      contactPerson: 'Site Contact',
      contactPhone: '+966512345678',
      isPrimary: true,
    });

    expect(locations[0]).toMatchObject({ name: 'New Site', siteId: 'LOC-000123' });
    expect(
      clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes('insert into customer_location_site_ids'),
      ),
    ).toBe(true);
  });
});

function location(id: string, siteId: string, createdAt: string) {
  return {
    id,
    siteId,
    createdAt,
    name: id,
    streetAddress: 'Street',
    city: 'Jeddah',
    region: 'Makkah',
    country: 'Saudi Arabia',
    postalCode: '21442',
    contactPerson: 'Contact',
    contactPhone: '+966512345678',
    isPrimary: id === 'older',
  };
}
