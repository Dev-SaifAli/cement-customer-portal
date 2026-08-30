import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { CustomerUser } from '../customer-auth/customer-auth.types.js';
import type { CustomerLocationInput } from './customer-locations.validation.js';

export interface CustomerLocation {
  id: string;
  name: string;
  siteId: string;
  streetAddress: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  contactPerson: string;
  contactPhone: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
  isPrimary: boolean;
  createdAt: string | null;
}

type Executor = Pick<PoolClient, 'query'>;

interface LocationsRow {
  delivery_locations: unknown;
}

export class CustomerLocationsService {
  async listLocations(customerUser: CustomerUser) {
    return this.getLocations(customerUser);
  }

  async listCities() {
    const result = await pool.query<{ id: string; name: string }>(
      `select id, name from ksa_cities where is_active = true order by name`,
    );
    return result.rows;
  }

  async addLocation(customerUser: CustomerUser, input: CustomerLocationInput) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const locations = await this.getLocations(customerUser, client);
      const id = randomUUID();
      const siteId = await nextSiteId(client);
      await client.query(
        `insert into customer_location_site_ids
         (location_id, site_id, registration_id, customer_account_id)
         values ($1, $2, $3, $4)`,
        [id, siteId, customerUser.account.registrationId, customerUser.account.id],
      );
      const next = normalizePrimaryLocations(
        [
          {
            ...toLocation(input, id, siteId, new Date().toISOString()),
            isPrimary: locations.length === 0 || input.isPrimary === true,
          },
          ...locations,
        ],
        input.isPrimary === true || locations.length === 0 ? id : undefined,
      );
      const saved = await this.saveLocations(customerUser, next, client);
      await client.query('commit');
      return saved;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateLocation(customerUser: CustomerUser, id: string, input: CustomerLocationInput) {
    const locations = await this.getLocations(customerUser);
    const exists = locations.some((location) => location.id === id);
    if (!exists) {
      throw new AppError('Delivery location was not found.', 404, 'CUSTOMER_LOCATION_NOT_FOUND');
    }

    const next = normalizePrimaryLocations(
      locations.map((location) =>
        location.id === id
          ? {
              ...toLocation(input, id, location.siteId, location.createdAt),
              isPrimary: input.isPrimary === true || location.isPrimary,
            }
          : location,
      ),
      input.isPrimary === true ? id : undefined,
    );

    return this.saveLocations(customerUser, next);
  }

  async deleteLocation(customerUser: CustomerUser, id: string) {
    const locations = await this.getLocations(customerUser);
    if (locations.length <= 1) {
      throw new AppError(
        'At least one delivery location is required.',
        400,
        'CUSTOMER_LOCATION_REQUIRED',
      );
    }

    const next = locations.filter((location) => location.id !== id);
    if (next.length === locations.length) {
      throw new AppError('Delivery location was not found.', 404, 'CUSTOMER_LOCATION_NOT_FOUND');
    }

    return this.saveLocations(customerUser, normalizePrimaryLocations(next));
  }

  async setPrimaryLocation(customerUser: CustomerUser, id: string) {
    const locations = await this.getLocations(customerUser);
    if (!locations.some((location) => location.id === id)) {
      throw new AppError('Delivery location was not found.', 404, 'CUSTOMER_LOCATION_NOT_FOUND');
    }

    return this.saveLocations(customerUser, normalizePrimaryLocations(locations, id));
  }

  private async getLocations(customerUser: CustomerUser, executor: Executor = pool) {
    const result = await executor.query<LocationsRow>(
      `select registration_drafts.delivery_locations
       from customer_accounts
       inner join registration_drafts
         on registration_drafts.id = customer_accounts.registration_id
       where customer_accounts.id = $1
         and customer_accounts.registration_id = $2
       limit 1`,
      [customerUser.account.id, customerUser.account.registrationId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError('Delivery locations were not found.', 404, 'CUSTOMER_LOCATIONS_NOT_FOUND');
    }

    return sortLocations(
      normalizePrimaryLocations(arrayOrEmpty(row.delivery_locations).map(safeLocation)),
    );
  }

  private async saveLocations(
    customerUser: CustomerUser,
    locations: CustomerLocation[],
    executor: Executor = pool,
  ) {
    const result = await executor.query<LocationsRow>(
      `update registration_drafts
       set delivery_locations = $3::jsonb,
           updated_at = now()
       where id = $2
         and exists (
           select 1
           from customer_accounts
           where customer_accounts.id = $1
             and customer_accounts.registration_id = registration_drafts.id
         )
       returning delivery_locations`,
      [customerUser.account.id, customerUser.account.registrationId, JSON.stringify(locations)],
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(
        'Delivery locations could not be saved.',
        404,
        'CUSTOMER_LOCATIONS_NOT_FOUND',
      );
    }

    return sortLocations(
      normalizePrimaryLocations(arrayOrEmpty(row.delivery_locations).map(safeLocation)),
    );
  }
}

export const customerLocationsService = new CustomerLocationsService();

function toLocation(
  input: CustomerLocationInput,
  id: string,
  siteId: string,
  createdAt: string | null,
): CustomerLocation {
  return {
    id,
    name: input.name.trim(),
    siteId,
    streetAddress: input.streetAddress.trim(),
    city: input.city.trim(),
    region: input.region.trim(),
    country: input.country.trim(),
    postalCode: input.postalCode?.trim() ?? '',
    contactPerson: input.contactPerson.trim(),
    contactPhone: input.contactPhone.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    isPrimary: input.isPrimary === true,
    createdAt,
  };
}

function safeLocation(value: unknown): CustomerLocation {
  const location = objectOrEmpty(value);
  const id = stringOrNull(location.id) ?? randomUUID();

  return {
    id,
    name: stringOrNull(location.name) ?? '',
    siteId: stringOrNull(location.siteId) ?? `LOC-${id.slice(0, 8).toUpperCase()}`,
    streetAddress: stringOrNull(location.streetAddress) ?? '',
    city: stringOrNull(location.city) ?? '',
    region: stringOrNull(location.region) ?? '',
    country: stringOrNull(location.country) ?? 'Saudi Arabia',
    postalCode: stringOrNull(location.postalCode) ?? '',
    contactPerson: stringOrNull(location.contactPerson) ?? '',
    contactPhone: stringOrNull(location.contactPhone) ?? '',
    latitude: numberOrUndefined(location.latitude),
    longitude: numberOrUndefined(location.longitude),
    isPrimary: location.isPrimary === true,
    createdAt: dateStringOrNull(location.createdAt),
  };
}

async function nextSiteId(executor: Executor) {
  const result = await executor.query<{ site_id: string }>(
    `select 'LOC-' || lpad(nextval('customer_location_site_id_seq')::text, 6, '0') as site_id`,
  );
  const siteId = result.rows[0]?.site_id;
  if (!siteId) {
    throw new AppError('Site ID could not be generated.', 503, 'SITE_ID_GENERATION_FAILED');
  }
  return siteId;
}

function sortLocations(locations: CustomerLocation[]) {
  return locations
    .map((location, index) => ({ location, index }))
    .sort((left, right) => {
      const leftTime = left.location.createdAt ? Date.parse(left.location.createdAt) : 0;
      const rightTime = right.location.createdAt ? Date.parse(right.location.createdAt) : 0;
      return rightTime - leftTime || left.index - right.index;
    })
    .map(({ location }) => location);
}

function normalizePrimaryLocations(locations: CustomerLocation[], primaryId?: string) {
  if (locations.length === 0) return [];

  const selectedPrimaryId =
    primaryId ?? locations.find((location) => location.isPrimary)?.id ?? locations[0]?.id;

  return locations.map((location) => ({
    ...location,
    isPrimary: location.id === selectedPrimaryId,
  }));
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberOrUndefined(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function dateStringOrNull(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
