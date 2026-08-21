import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../../database/pool.js', () => ({
  pool: { query },
  closeDatabase: vi.fn(),
}));

import { createApp } from '../../app.js';

describe('registration API errors', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('rejects an invalid draft id without querying PostgreSQL', async () => {
    const response = await request(createApp()).get('/api/v1/registrations/not-a-draft-id');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Registration id is invalid.',
      error: { code: 'REGISTRATION_ID_INVALID' },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 404 for a draft id that no longer exists', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp()).get(
      '/api/v1/registrations/11111111-1111-4111-8111-111111111111',
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Registration draft was not found.',
      error: { code: 'REGISTRATION_NOT_FOUND' },
    });
  });

  it('returns a safe 503 when registration persistence is unavailable', async () => {
    query.mockRejectedValueOnce(new Error('database connection failed with private details'));

    const response = await request(createApp())
      .post('/api/v1/registrations')
      .send({ currentStep: 1 });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      message: 'Registration service is temporarily unavailable.',
      error: {
        code: 'REGISTRATION_SERVICE_UNAVAILABLE',
        message: 'Registration service is temporarily unavailable.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('private details');
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('does not expose document storage keys when loading a draft', async () => {
    query.mockResolvedValueOnce({
      rows: [createCompleteDraftRow()],
    });

    const response = await request(createApp()).get(
      '/api/v1/registrations/11111111-1111-4111-8111-111111111111',
    );

    expect(response.status).toBe(200);
    expect(response.body.registration.documents.cr).toMatchObject({
      fileName: 'cr.pdf',
      uploadedAt: '2026-08-20T10:00:00.000Z',
    });
    expect(response.body.registration.documents.cr).not.toHaveProperty('storageKey');
    expect(JSON.stringify(response.body)).not.toContain('cr-storage-key.pdf');
  });

  it('submits a complete draft when documents are already persisted in storage', async () => {
    const draft = createCompleteDraftRow();
    const submittedDraft = {
      ...draft,
      status: 'PENDING_SALES_REVIEW',
      reference: 'APP-2099-123456',
      submitted_at: '2099-01-01T10:00:00.000Z',
    };

    query
      .mockResolvedValueOnce({ rows: [draft] })
      .mockResolvedValueOnce({ rows: [{ admin_password_hash: 'hashed-password' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [submittedDraft] });

    const response = await request(createApp()).post(
      '/api/v1/registrations/11111111-1111-4111-8111-111111111111/submit',
    );

    expect(response.status).toBe(200);
    expect(response.body.registration).toMatchObject({
      status: 'PENDING_SALES_REVIEW',
      reference: 'APP-2099-123456',
    });
    expect(response.body.registration.documents.cr).not.toHaveProperty('storageKey');
    expect(response.body.registration.documents.vat).not.toHaveProperty('storageKey');
  });
});

function createCompleteDraftRow() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    reference: null,
    status: 'DRAFT',
    current_step: 6,
    company: {
      companyName: 'AlSafwa Test Customer',
      crNumber: '1234567890',
      vatNumber: '123456789012345',
      streetAddress: '123 Cement Road',
      city: 'Jeddah',
      region: 'Makkah Province',
      country: 'Saudi Arabia',
      postalCode: '12345',
    },
    contact: {
      fullName: 'Sara Contact',
      jobTitle: 'Procurement Manager',
      email: 'sara.contact@example.com',
      phone: '+966512345678',
    },
    documents: {
      cr: {
        documentType: 'cr',
        documentLabel: 'Commercial Registration',
        fileName: 'cr.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        expiryDate: '2099-12-31',
        uploadedAt: '2026-08-20T10:00:00.000Z',
        storageKey:
          'registrations/11111111-1111-4111-8111-111111111111/documents/cr-storage-key.pdf',
      },
      vat: {
        documentType: 'vat',
        documentLabel: 'VAT Certificate',
        fileName: 'vat.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        expiryDate: '2099-12-31',
        uploadedAt: '2026-08-20T10:00:00.000Z',
        storageKey:
          'registrations/11111111-1111-4111-8111-111111111111/documents/vat-storage-key.pdf',
      },
    },
    delivery_locations: [
      {
        id: 'location-1',
        name: 'Main Site',
        siteId: 'SITE-1',
        streetAddress: '456 Project Road',
        city: 'Jeddah',
        region: 'Makkah Province',
        country: 'Saudi Arabia',
        postalCode: '23456',
        contactPerson: 'Ali Site',
        contactPhone: '+966512345679',
      },
    ],
    administrator: {
      fullName: 'Sara Admin',
      jobTitle: 'Portal Administrator',
      email: 'sara.admin@example.com',
      phone: '+966512345680',
    },
    submitted_at: null,
    created_at: '2026-08-20T09:00:00.000Z',
    updated_at: '2026-08-20T10:00:00.000Z',
  };
}
