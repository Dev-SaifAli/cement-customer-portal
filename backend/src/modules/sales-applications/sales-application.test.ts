import request from 'supertest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-sales-applications-secret-with-32-plus-chars';
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
const applicationId = '11111111-1111-4111-8111-111111111111';
const documentStorageKey = `registrations/${applicationId}/documents/cr-test.pdf`;
const documentStoragePath = path.resolve(process.cwd(), 'storage', documentStorageKey);

const salesUserRow = {
  id: salesUserId,
  name: 'Sales Reviewer',
  email: 'sales@example.com',
  password_hash: 'hash',
  is_active: true,
};

const applicationRow = {
  id: applicationId,
  reference: 'APP-2026-123456',
  status: 'PENDING_SALES_REVIEW',
  current_step: 6,
  company: {
    companyName: 'Arabian Construction Co',
    crNumber: '1234567890',
  },
  contact: {
    fullName: 'Primary Contact',
    email: 'contact@example.com',
    phone: '+966512345678',
  },
  documents: {
    cr: {
      fileName: 'cr.pdf',
      fileSize: 1024,
      fileType: 'application/pdf',
      expiryDate: '2027-01-01',
      uploadedAt: '2026-08-20T09:00:00.000Z',
      storageKey: documentStorageKey,
    },
  },
  delivery_locations: [
    {
      id: 'loc-1',
      name: 'Jeddah Site',
    },
  ],
  administrator: {
    fullName: 'Admin User',
    email: 'admin@example.com',
    password: 'plain-password',
    confirmPassword: 'plain-password',
    passwordHash: 'hash',
  },
  submitted_at: '2026-08-20T10:00:00.000Z',
  created_at: '2026-08-19T10:00:00.000Z',
  updated_at: '2026-08-20T10:00:00.000Z',
};

const statusEventRow = {
  id: '33333333-3333-4333-8333-333333333333',
  previous_status: 'PENDING_SALES_REVIEW',
  new_status: 'UNDER_REVIEW',
  reason: 'Initial review started',
  changed_by: salesUserId,
  created_at: '2026-08-20T11:00:00.000Z',
};

const authHeader = () =>
  `Bearer ${salesTokenService.createToken({
    sub: salesUserId,
    type: 'sales',
  })}`;

const mockAuthenticatedSalesUser = () => {
  query.mockResolvedValueOnce({ rows: [salesUserRow] });
};

const mockTransactionClient = () => {
  connect.mockResolvedValueOnce({
    query: clientQuery,
    release,
  });
};

describe('sales applications API', () => {
  beforeEach(() => {
    query.mockReset();
    connect.mockReset();
    clientQuery.mockReset();
    release.mockReset();
  });

  describe('GET /api/v1/sales/applications', () => {
    it('allows an authenticated Sales user to list applications', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      query.mockResolvedValueOnce({ rows: [applicationRow] });

      const response = await request(createApp())
        .get('/api/v1/sales/applications')
        .set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0]).toMatchObject({
        id: applicationId,
        reference: 'APP-2026-123456',
        status: 'PENDING_SALES_REVIEW',
        companyName: 'Arabian Construction Co',
      });
      expect(response.body.data.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('rejects unauthenticated users', async () => {
      const response = await request(createApp()).get('/api/v1/sales/applications');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('SALES_AUTH_REQUIRED');
      expect(query).not.toHaveBeenCalled();
    });

    it('rejects approval managers from the Applications module', async () => {
      query.mockResolvedValueOnce({ rows: [{ ...salesUserRow, role: 'HADER_MANAGER' }] });

      const response = await request(createApp())
        .get('/api/v1/sales/applications')
        .set('Authorization', authHeader());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('SALES_ROLE_FORBIDDEN');
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('searches useful Sales fields', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      query.mockResolvedValueOnce({ rows: [applicationRow] });

      const response = await request(createApp())
        .get('/api/v1/sales/applications?search=arabian')
        .set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(query.mock.calls[1]?.[0]).toContain("company->>'companyName'");
      expect(query.mock.calls[1]?.[0]).toContain('reference');
      expect(query.mock.calls[1]?.[1]).toContain('%arabian%');
    });

    it('filters by status', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      query.mockResolvedValueOnce({ rows: [applicationRow] });

      const response = await request(createApp())
        .get('/api/v1/sales/applications?status=PENDING_SALES_REVIEW')
        .set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(query.mock.calls[1]?.[0]).toContain('status = $1');
      expect(query.mock.calls[1]?.[1]).toEqual(['PENDING_SALES_REVIEW']);
      expect(query.mock.calls[2]?.[1]).toEqual(['PENDING_SALES_REVIEW', 20, 0]);
    });

    it('supports pagination', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({ rows: [{ total: '45' }] });
      query.mockResolvedValueOnce({ rows: [applicationRow] });

      const response = await request(createApp())
        .get('/api/v1/sales/applications?page=2&pageSize=10')
        .set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toEqual({
        page: 2,
        pageSize: 10,
        total: 45,
        totalPages: 5,
      });
      expect(query.mock.calls[2]?.[1]).toEqual([
        [
          'PENDING_SALES_REVIEW',
          'UNDER_REVIEW',
          'APPROVED',
          'REJECTED',
          'CHANGES_REQUESTED',
          'ACTIVATED',
        ],
        10,
        10,
      ]);
    });

    it('limits unreasonable page sizes', async () => {
      mockAuthenticatedSalesUser();

      const response = await request(createApp())
        .get('/api/v1/sales/applications?pageSize=101')
        .set('Authorization', authHeader());

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/sales/applications/:id', () => {
    it('allows a Sales user to retrieve an application', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({ rows: [applicationRow] });
      query.mockResolvedValueOnce({ rows: [statusEventRow] });

      const response = await request(createApp())
        .get(`/api/v1/sales/applications/${applicationId}`)
        .set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(response.body.data.application).toMatchObject({
        id: applicationId,
        company: applicationRow.company,
        contact: applicationRow.contact,
        documents: {
          cr: {
            fileName: 'cr.pdf',
            fileType: 'application/pdf',
            hasFile: true,
            uploadedAt: '2026-08-20T09:00:00.000Z',
          },
        },
        deliveryLocations: applicationRow.delivery_locations,
        statusHistory: [
          {
            changedBy: salesUserId,
            newStatus: 'UNDER_REVIEW',
          },
        ],
      });
    });

    it('returns 404 when an application does not exist', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(createApp())
        .get(`/api/v1/sales/applications/${applicationId}`)
        .set('Authorization', authHeader());

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SALES_APPLICATION_NOT_FOUND');
    });

    it('does not return sensitive administrator password data', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({ rows: [applicationRow] });
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(createApp())
        .get(`/api/v1/sales/applications/${applicationId}`)
        .set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toContain('plain-password');
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      expect(JSON.stringify(response.body)).not.toContain('password_hash');
    });

    it('does not expose internal document storage keys', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({ rows: [applicationRow] });
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(createApp())
        .get(`/api/v1/sales/applications/${applicationId}`)
        .set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toContain('storageKey');
      expect(JSON.stringify(response.body)).not.toContain(documentStorageKey);
    });
  });

  describe('GET /api/v1/sales/applications/:id/documents/:documentId', () => {
    beforeEach(async () => {
      await rm(path.resolve(process.cwd(), 'storage', 'registrations', applicationId), {
        recursive: true,
        force: true,
      });
    });

    it('streams a stored document for an authenticated Sales user', async () => {
      await mkdir(path.dirname(documentStoragePath), { recursive: true });
      await writeFile(documentStoragePath, Buffer.from('%PDF-1.4 test document'));

      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({
        rows: [
          {
            id: applicationId,
            status: 'PENDING_SALES_REVIEW',
            documents: applicationRow.documents,
          },
        ],
      });

      const response = await request(createApp())
        .get(`/api/v1/sales/applications/${applicationId}/documents/cr`)
        .set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('inline');
      expect(response.headers['content-disposition']).toContain('cr.pdf');
      expect(Buffer.from(response.body).toString()).toContain('%PDF-1.4 test document');
    });

    it('forces attachment disposition when download is requested', async () => {
      await mkdir(path.dirname(documentStoragePath), { recursive: true });
      await writeFile(documentStoragePath, Buffer.from('%PDF-1.4 test document'));

      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({
        rows: [
          {
            id: applicationId,
            status: 'PENDING_SALES_REVIEW',
            documents: applicationRow.documents,
          },
        ],
      });

      const response = await request(createApp())
        .get(`/api/v1/sales/applications/${applicationId}/documents/cr?download=1`)
        .set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('rejects unauthenticated document access', async () => {
      const response = await request(createApp()).get(
        `/api/v1/sales/applications/${applicationId}/documents/cr`,
      );

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('SALES_AUTH_REQUIRED');
    });

    it('rejects invalid application and document combinations', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({
        rows: [{ id: applicationId, status: 'PENDING_SALES_REVIEW', documents: {} }],
      });

      const response = await request(createApp())
        .get(`/api/v1/sales/applications/${applicationId}/documents/cr`)
        .set('Authorization', authHeader());

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCUMENT_FILE_NOT_FOUND');
    });

    it('returns a safe 404 when the stored file is missing', async () => {
      mockAuthenticatedSalesUser();
      query.mockResolvedValueOnce({
        rows: [
          {
            id: applicationId,
            status: 'PENDING_SALES_REVIEW',
            documents: applicationRow.documents,
          },
        ],
      });

      const response = await request(createApp())
        .get(`/api/v1/sales/applications/${applicationId}/documents/cr`)
        .set('Authorization', authHeader());

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCUMENT_FILE_NOT_FOUND');
      expect(JSON.stringify(response.body)).not.toContain('storage');
      expect(JSON.stringify(response.body)).not.toContain(documentStorageKey);
    });
  });

  describe('PATCH /api/v1/sales/applications/:id/status', () => {
    it('marks a pending application as under review', async () => {
      mockAuthenticatedSalesUser();
      mockTransactionClient();
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({ rows: [applicationRow] });
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'UNDER_REVIEW' }],
      });
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({});

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'UNDER_REVIEW' });

      expect(response.status).toBe(200);
      expect(response.body.data.statusChanged).toBe(true);
      expect(response.body.data.application.status).toBe('UNDER_REVIEW');
    });

    it('approves an application from under review', async () => {
      mockAuthenticatedSalesUser();
      mockTransactionClient();
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'UNDER_REVIEW' }],
      });
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'APPROVED' }],
      });
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({});

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'APPROVED', reason: 'Verified by Sales Team' });

      expect(response.status).toBe(200);
      expect(response.body.data.application.status).toBe('APPROVED');
    });

    it('rejects an application from under review', async () => {
      mockAuthenticatedSalesUser();
      mockTransactionClient();
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'UNDER_REVIEW' }],
      });
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'REJECTED' }],
      });
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({});

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'REJECTED', reason: 'Documents could not be verified.' });

      expect(response.status).toBe(200);
      expect(response.body.data.application.status).toBe('REJECTED');
    });

    it('requests changes from under review', async () => {
      mockAuthenticatedSalesUser();
      mockTransactionClient();
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'UNDER_REVIEW' }],
      });
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'CHANGES_REQUESTED' }],
      });
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({});

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'CHANGES_REQUESTED', reason: 'VAT certificate is unclear.' });

      expect(response.status).toBe(200);
      expect(response.body.data.application.status).toBe('CHANGES_REQUESTED');
    });

    it('rejects invalid Sales status values', async () => {
      mockAuthenticatedSalesUser();

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'DRAFT' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid transitions', async () => {
      mockAuthenticatedSalesUser();
      mockTransactionClient();
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({ rows: [applicationRow] });
      clientQuery.mockResolvedValueOnce({});

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('SALES_APPLICATION_INVALID_STATUS_TRANSITION');
      expect(clientQuery).toHaveBeenCalledWith('rollback');
    });

    it('requires a reason for rejected or changes requested applications', async () => {
      mockAuthenticatedSalesUser();

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'REJECTED' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(connect).not.toHaveBeenCalled();
    });

    it('creates status history when the status changes', async () => {
      mockAuthenticatedSalesUser();
      mockTransactionClient();
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'UNDER_REVIEW' }],
      });
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'APPROVED' }],
      });
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({});

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'APPROVED', reason: 'Verified' });

      expect(response.status).toBe(200);
      expect(clientQuery.mock.calls[3]?.[0]).toContain('insert into application_status_events');
      expect(clientQuery.mock.calls[3]?.[1]).toEqual([
        applicationId,
        'UNDER_REVIEW',
        'APPROVED',
        'Verified',
        salesUserId,
      ]);
    });

    it('uses the authenticated Sales user as changed_by instead of trusting the request body', async () => {
      mockAuthenticatedSalesUser();
      mockTransactionClient();
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'UNDER_REVIEW' }],
      });
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'APPROVED' }],
      });
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({});

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({
          status: 'APPROVED',
          reason: 'Verified',
          changed_by: 'attacker-controlled-id',
        });

      expect(response.status).toBe(200);
      expect(clientQuery.mock.calls[3]?.[1]).toContain(salesUserId);
      expect(clientQuery.mock.calls[3]?.[1]).not.toContain('attacker-controlled-id');
    });

    it('does not create duplicate history when the status is unchanged', async () => {
      mockAuthenticatedSalesUser();
      mockTransactionClient();
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'UNDER_REVIEW' }],
      });
      clientQuery.mockResolvedValueOnce({});

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'UNDER_REVIEW' });

      expect(response.status).toBe(200);
      expect(response.body.data.statusChanged).toBe(false);
      expect(clientQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('insert into application_status_events'),
        expect.any(Array),
      );
      expect(clientQuery).toHaveBeenCalledWith('commit');
    });

    it('rolls back when status history insert fails', async () => {
      mockAuthenticatedSalesUser();
      mockTransactionClient();
      clientQuery.mockResolvedValueOnce({});
      clientQuery.mockResolvedValueOnce({ rows: [applicationRow] });
      clientQuery.mockResolvedValueOnce({
        rows: [{ ...applicationRow, status: 'UNDER_REVIEW' }],
      });
      clientQuery.mockRejectedValueOnce(new Error('history insert failed'));
      clientQuery.mockResolvedValueOnce({});

      const response = await request(createApp())
        .patch(`/api/v1/sales/applications/${applicationId}/status`)
        .set('Authorization', authHeader())
        .send({ status: 'UNDER_REVIEW' });

      expect(response.status).toBe(503);
      expect(clientQuery).toHaveBeenCalledWith('rollback');
      expect(release).toHaveBeenCalledOnce();
    });
  });
});
