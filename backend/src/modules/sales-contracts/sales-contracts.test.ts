import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-sales-contracts-secret-with-32-plus-chars';
  process.env.JWT_EXPIRES_IN = '1h';
});

const { query, connect, clientQuery, release } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock('../../database/pool.js', () => ({
  pool: {
    query,
    connect,
  },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';
import { salesTokenService } from '../sales-auth/sales-token.service.js';

const salesUserId = '22222222-2222-4222-8222-222222222222';
const customerAccountId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';
const contractId = '55555555-5555-4555-8555-555555555555';

const salesUserRow = {
  id: salesUserId,
  name: 'Sales Reviewer',
  email: 'sales@example.com',
  password_hash: 'hash',
  is_active: true,
};

const accountRow = {
  id: customerAccountId,
  company_name: 'Activated Cement Customer',
  status: 'ACTIVE',
  application_status: 'ACTIVATED',
  delivery_locations: [
    {
      id: 'loc-1',
      name: 'Jeddah Site',
      city: 'Jeddah',
      region: 'Makkah',
    },
  ],
};

const productRow = {
  id: productId,
  product_code: 'CEM-OPC-50KG',
  product_name: 'Ordinary Portland Cement',
  packaging_type: 'Bag',
  uom: 'TON',
  is_active: true,
};

const contractRow = {
  id: contractId,
  reference: 'CT-2026-000001',
  customer_account_id: customerAccountId,
  customer_company_name: 'Activated Cement Customer',
  product_id: productId,
  product_code: 'CEM-OPC-50KG',
  product_name: 'Ordinary Portland Cement',
  packaging: 'Bag',
  uom: 'TON',
  quantity: '100.000',
  start_date: '2026-09-01',
  end_date: '2026-12-31',
  fulfilment: 'DELIVERY',
  pickup_location_id: null,
  delivery_location_id: 'loc-1',
  delivery_city: 'Jeddah',
  pallet_required: true,
  pallet_type: 'Wooden',
  product_list_price: '150.00',
  product_price: '150.00',
  delivery_list_price: '35.00',
  delivery_price: '35.00',
  sales_user_id: salesUserId,
  sales_user_name: 'Sales Reviewer',
  status: 'DRAFT',
  created_at: '2026-08-24T08:00:00.000Z',
  updated_at: '2026-08-24T08:00:00.000Z',
};

const statusEventRow = {
  id: '66666666-6666-4666-8666-666666666666',
  contract_id: contractId,
  previous_status: null,
  new_status: 'DRAFT',
  action: 'CREATE_DRAFT',
  reason: null,
  changed_by: salesUserId,
  changed_by_name: 'Sales Reviewer',
  changed_by_email: 'sales@example.com',
  created_at: '2026-08-24T08:00:00.000Z',
};

const validPayload = {
  customerAccountId,
  productId,
  quantity: 100,
  startDate: '2026-09-01',
  endDate: '2026-12-31',
  fulfilment: 'DELIVERY',
  deliveryLocationId: 'loc-1',
  deliveryCity: 'Jeddah',
  palletRequired: true,
  palletType: 'Wooden',
  productListPrice: 150,
  productPrice: 150,
  deliveryListPrice: 35,
  deliveryPrice: 35,
};

const authHeader = () =>
  `Bearer ${salesTokenService.createToken({
    sub: salesUserId,
    type: 'sales',
  })}`;

function mockAuthenticatedSalesUser() {
  query.mockResolvedValueOnce({ rows: [salesUserRow] });
}

function mockTransactionClient() {
  connect.mockResolvedValueOnce({
    query: clientQuery,
    release,
  });
}

describe('sales contracts API', () => {
  beforeEach(() => {
    query.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  it('requires Sales authentication', async () => {
    const response = await request(createApp()).get('/api/v1/sales/contracts');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SALES_AUTH_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('lists contracts for authenticated Sales users', async () => {
    mockAuthenticatedSalesUser();
    query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
    query.mockResolvedValueOnce({ rows: [contractRow] });

    const response = await request(createApp())
      .get('/api/v1/sales/contracts')
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toMatchObject({
      id: contractId,
      reference: 'CT-2026-000001',
      customerCompanyName: 'Activated Cement Customer',
      productCode: 'CEM-OPC-50KG',
    });
    expect(response.body.data.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('creates a draft contract for active customers and active products', async () => {
    mockAuthenticatedSalesUser();
    query.mockResolvedValueOnce({ rows: [accountRow] });
    query.mockResolvedValueOnce({ rows: [productRow] });
    mockTransactionClient();
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...contractRow, customer_company_name: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [contractRow] });
    query.mockResolvedValueOnce({ rows: [statusEventRow] });

    const response = await request(createApp())
      .post('/api/v1/sales/contracts')
      .set('Authorization', authHeader())
      .send(validPayload);

    expect(response.status).toBe(201);
    expect(clientQuery.mock.calls[1]?.[0]).toContain('insert into contracts');
    expect(clientQuery.mock.calls[2]?.[0]).toContain('insert into contract_status_events');
    expect(response.body.data.contract).toMatchObject({
      id: contractId,
      status: 'DRAFT',
      packaging: 'Bag',
      uom: 'TON',
    });
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
  });

  it('rejects contracts for inactive or non-activated customers', async () => {
    mockAuthenticatedSalesUser();
    query.mockResolvedValueOnce({
      rows: [{ ...accountRow, application_status: 'APPROVED' }],
    });
    query.mockResolvedValueOnce({ rows: [productRow] });

    const response = await request(createApp())
      .post('/api/v1/sales/contracts')
      .set('Authorization', authHeader())
      .send(validPayload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CUSTOMER_ACCOUNT_NOT_ACTIVE');
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects delivery locations that do not belong to the selected customer', async () => {
    mockAuthenticatedSalesUser();
    query.mockResolvedValueOnce({ rows: [accountRow] });
    query.mockResolvedValueOnce({ rows: [productRow] });

    const response = await request(createApp())
      .post('/api/v1/sales/contracts')
      .set('Authorization', authHeader())
      .send({ ...validPayload, deliveryLocationId: 'other-location' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('DELIVERY_LOCATION_NOT_FOUND');
    expect(connect).not.toHaveBeenCalled();
  });

  it('submits list-price contracts directly as active contracts', async () => {
    mockAuthenticatedSalesUser();
    mockTransactionClient();
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...contractRow, reference: null }] })
      .mockResolvedValueOnce({ rows: [{ sequence: '1' }] })
      .mockResolvedValueOnce({ rows: [{ ...contractRow, status: 'ACTIVE' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [{ ...contractRow, status: 'ACTIVE' }] });
    query.mockResolvedValueOnce({
      rows: [{ ...statusEventRow, previous_status: 'DRAFT', new_status: 'ACTIVE' }],
    });

    const response = await request(createApp())
      .post(`/api/v1/sales/contracts/${contractId}/submit`)
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(clientQuery.mock.calls[3]?.[1]).toEqual([contractId, 'CT-2026-000001', 'ACTIVE']);
    expect(clientQuery.mock.calls[4]?.[1]).toEqual([
      contractId,
      'DRAFT',
      'ACTIVE',
      'SUBMIT_ACTIVATE',
      null,
      salesUserId,
    ]);
  });

  it('submits custom-price contracts for approval', async () => {
    mockAuthenticatedSalesUser();
    mockTransactionClient();
    const customContract = { ...contractRow, reference: null, product_price: '145.00' };
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [customContract] })
      .mockResolvedValueOnce({ rows: [{ sequence: '1' }] })
      .mockResolvedValueOnce({ rows: [{ ...customContract, status: 'PENDING_SALES_REVIEW' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [{ ...customContract, status: 'PENDING_SALES_REVIEW' }] });
    query.mockResolvedValueOnce({
      rows: [{ ...statusEventRow, previous_status: 'DRAFT', new_status: 'PENDING_SALES_REVIEW' }],
    });

    const response = await request(createApp())
      .post(`/api/v1/sales/contracts/${contractId}/submit`)
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(clientQuery.mock.calls[3]?.[1]).toEqual([
      contractId,
      'CT-2026-000001',
      'PENDING_SALES_REVIEW',
    ]);
    expect(clientQuery.mock.calls[4]?.[1]).toEqual([
      contractId,
      'DRAFT',
      'PENDING_SALES_REVIEW',
      'SUBMIT_FOR_APPROVAL',
      'Contract includes custom pricing and requires approval.',
      salesUserId,
    ]);
  });
});
