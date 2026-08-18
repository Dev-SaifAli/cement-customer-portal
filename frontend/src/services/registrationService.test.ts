import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRegistrationDraft, RegistrationServiceError } from './registrationService';

afterEach(() => {
  vi.mocked(fetch).mockReset();
});

describe('registration service errors', () => {
  it('uses a safe connection message when the API cannot be reached', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('connection refused'));

    await expect(createRegistrationDraft()).rejects.toMatchObject({
      message: 'Unable to connect to the registration service.',
    });
  });

  it('does not expose an internal server error message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'private database error' },
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(createRegistrationDraft()).rejects.toMatchObject({
      message: 'Unable to process your registration right now. Please try again.',
      status: 500,
    });
  });

  it('preserves safe validation errors from a 400 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          message: 'Validation failed',
          errors: { companyName: 'Company name is required.' },
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );

    try {
      await createRegistrationDraft();
      throw new Error('Expected the request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(RegistrationServiceError);
      expect(error).toMatchObject({
        message: 'Validation failed',
        status: 400,
        errors: { companyName: 'Company name is required.' },
      });
    }
  });
});
