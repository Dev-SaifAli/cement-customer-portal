import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.stubGlobal(
  'fetch',
  vi.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith('/auth/captcha')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            captcha: {
              challengeId: 'test-captcha-id',
              prompt: 'What is 4 + 5?',
              expiresAt: new Date(Date.now() + 120_000).toISOString(),
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    }

    return Promise.reject(new Error(`Unhandled fetch request: ${url}`));
  }),
);
