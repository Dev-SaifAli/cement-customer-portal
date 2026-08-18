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
});
