import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-internal-logistics-secret-32-characters';
});
const mocks = vi.hoisted(() => ({ query: vi.fn(), clientQuery: vi.fn(), release: vi.fn() }));
vi.mock('../../database/pool.js', () => ({
  pool: {
    query: mocks.query,
    connect: vi.fn(async () => ({ query: mocks.clientQuery, release: mocks.release })),
  },
  closeDatabase: vi.fn(),
}));
import { createApp } from '../../app.js';
import { salesTokenService } from '../sales-auth/sales-token.service.js';
const userId = '11111111-1111-4111-8111-111111111111';
const entityId = '22222222-2222-4222-8222-222222222222';
const cityId = '33333333-3333-4333-8333-333333333333';
const auth = () => `Bearer ${salesTokenService.createToken({ sub: userId, type: 'sales' })}`;
const user = (role: string) => ({
  id: userId,
  name: 'Logistics User',
  email: 'logistics@example.com',
  password_hash: 'hidden',
  is_active: true,
  role,
});

describe('internal logistics API', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.clientQuery.mockReset();
    mocks.release.mockReset();
  });
  it('blocks customer/unauthenticated access', async () => {
    const res = await request(createApp()).get('/api/v1/admin/delivery-fleet');
    expect(res.status).toBe(401);
  });
  it('blocks Sales representatives from internal costs', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [user('SALES_REP')] });
    const res = await request(createApp())
      .get('/api/v1/admin/transporter-costs')
      .set('Authorization', auth());
    expect(res.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('keeps Hader Operations out of Administration master-data APIs', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [user('HADER_OPERATIONS')] });
    const res = await request(createApp())
      .get('/api/v1/admin/delivery-fleet')
      .set('Authorization', auth());
    expect(res.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('keeps Hader Managers out of transporter cost administration', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [user('HADER_MANAGER')] });
    const res = await request(createApp())
      .get('/api/v1/admin/transporter-costs')
      .set('Authorization', auth());
    expect(res.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('creates a transporter and records an audit event', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [user('PRICING_ADMIN')] });
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: entityId,
            transporter_number: 'TRN-000001',
            name: 'ABC Logistics',
            company_name: 'ABC Logistics Co',
            contact_person: 'Ahmed',
            phone: '+966501234567',
            email: null,
            cr_number: null,
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(createApp())
      .post('/api/v1/admin/transporters')
      .set('Authorization', auth())
      .send({
        name: 'ABC Logistics',
        companyName: 'ABC Logistics Co',
        contactPerson: 'Ahmed',
        phone: '0501234567',
        status: 'ACTIVE',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.transporter.transporterNumber).toBe('TRN-000001');
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('internal_logistics_events'),
      expect.arrayContaining(['TRANSPORTER_CREATED']),
    );
  });
  it('stores transporter cost strictly as SAR per TON', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [user('PRICING_ADMIN')] })
      .mockResolvedValueOnce({ rows: [{ transporter: true, city: true }] });
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: entityId,
            transporter_id: entityId,
            hader_city_id: cityId,
            cement_type: 'STANDARD_CEMENT',
            cost_per_ton: '15.00',
            updated_by_sales_user_id: userId,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(createApp())
      .post('/api/v1/admin/transporter-costs')
      .set('Authorization', auth())
      .send({
        transporterId: entityId,
        haderCityId: cityId,
        cementType: 'STANDARD_CEMENT',
        costPerTon: 15,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.cost.costPerTon).toBe(15);
    expect(mocks.clientQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('cost_per_ton'),
      expect.arrayContaining([15]),
    );
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('internal_logistics_events'),
      expect.arrayContaining(['TRANSPORTER_COST_CREATED']),
    );
  });
  it('records transporter deactivation as a distinct audit event', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [user('PRICING_ADMIN')] });
    const active = {
      id: entityId,
      transporter_number: 'TRN-000001',
      name: 'ABC Logistics',
      company_name: 'ABC Logistics Co',
      contact_person: null,
      phone: '+966501234567',
      email: null,
      cr_number: null,
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [active] })
      .mockResolvedValueOnce({ rows: [{ ...active, status: 'INACTIVE' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .patch(`/api/v1/admin/transporters/${entityId}`)
      .set('Authorization', auth())
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(200);
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('internal_logistics_events'),
      expect.arrayContaining(['TRANSPORTER_DEACTIVATED']),
    );
  });
  it('translates duplicate truck plates into a safe conflict', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [user('PRICING_ADMIN')] });
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }))
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(createApp())
      .post('/api/v1/admin/delivery-fleet')
      .set('Authorization', auth())
      .send({
        plateNumber: 'ABC-1234',
        vehicleType: 'Trailer',
        capacityTon: 30,
        status: 'AVAILABLE',
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LOGISTICS_DUPLICATE');
  });
  it('prevents Hader Operations from creating drivers', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [user('HADER_OPERATIONS')] });
    const res = await request(createApp())
      .post('/api/v1/admin/delivery-drivers')
      .set('Authorization', auth())
      .send({ name: 'Ahmed Ali', mobile: '0501234567', licenseNumber: 'LIC-1', status: 'ACTIVE' });
    expect(res.status).toBe(403);
  });
  it('allows Hader Operations to view only available assignment trucks', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [user('HADER_OPERATIONS')] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: entityId,
            truck_number: 'TRK-000001',
            plate_number: 'ABC-1234',
            vehicle_type: 'Trailer',
            capacity_ton: '30.000',
            model_year: 2025,
            assigned_driver_id: null,
            assigned_driver_name: null,
            status: 'AVAILABLE',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

    const res = await request(createApp())
      .get('/api/v1/hader/delivery-fleet')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data.trucks[0]).toMatchObject({
      truckNumber: 'TRK-000001',
      capacityTon: 30,
      status: 'AVAILABLE',
    });
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("where t.status='AVAILABLE'"),
    );
  });
  it('blocks an inactive or expired driver from being assigned as the truck default', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [user('PRICING_ADMIN')] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .post('/api/v1/admin/delivery-fleet')
      .set('Authorization', auth())
      .send({
        plateNumber: 'ABC-1234',
        vehicleType: 'Trailer',
        capacityTon: 30,
        assignedDriverId: entityId,
        status: 'AVAILABLE',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('HADER_DRIVER_NOT_ASSIGNABLE');
    expect(mocks.clientQuery).not.toHaveBeenCalled();
  });
  it('does not allow a Sales representative to read Hader assignment fleet', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [user('SALES_REP')] });
    const res = await request(createApp())
      .get('/api/v1/hader/delivery-drivers')
      .set('Authorization', auth());
    expect(res.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
