import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.stubGlobal(
  'fetch',
  vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
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

    if (url.endsWith('/customer/auth/me')) {
      if (window.sessionStorage.getItem('test_customer_session') === 'active') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: customerAuthSession(),
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'CUSTOMER_AUTH_REQUIRED',
              message: 'Customer authentication is required.',
            },
          }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    }

    if (url.endsWith('/customer/auth/login') && options?.method === 'POST') {
      const payload = options?.body ? JSON.parse(String(options.body)) : {};

      if (payload.email === 'admin@example.com' && payload.password === 'correct-password') {
        window.sessionStorage.setItem('test_customer_session', 'active');

        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: customerAuthSession(),
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'CUSTOMER_AUTH_INVALID_CREDENTIALS',
              message: 'Invalid email or password.',
            },
          }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    }

    if (url.endsWith('/customer/auth/logout') && options?.method === 'POST') {
      window.sessionStorage.removeItem('test_customer_session');

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Logged out successfully.',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    }

    if (/\/customer\/products\/[^/?]+$/.test(url)) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              product: testProduct(),
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    }

    if (url.includes('/customer/products')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [testProduct()],
              pagination: {
                page: 1,
                pageSize: 10,
                total: 1,
                totalPages: 1,
              },
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    }

    if (url.endsWith('/registrations') && options?.method === 'POST') {
      const payload = options?.body ? JSON.parse(String(options.body)) : {};
      return Promise.resolve(registrationResponse(payload));
    }

    if (/\/registrations\/[0-9a-f-]+\/submit$/.test(url) && options?.method === 'POST') {
      return Promise.resolve(
        registrationResponse({
          reference: 'APP-2026-123456',
          status: 'PENDING_SALES_REVIEW',
          submittedAt: new Date().toISOString(),
        }),
      );
    }

    if (/\/registrations\/[0-9a-f-]+$/.test(url)) {
      const payload = options?.body ? JSON.parse(String(options.body)) : {};
      return Promise.resolve(registrationResponse(payload));
    }

    return Promise.reject(new Error(`Unhandled fetch request: ${url}`));
  }),
);

function customerAuthSession() {
  const role = window.sessionStorage.getItem('test_customer_role') ?? 'CUSTOMER_ADMIN';

  return {
    user: {
      id: 'customer-user-1',
      name: 'Customer Admin',
      email: 'admin@example.com',
      role,
    },
    account: {
      id: 'customer-account-1',
      companyName: 'Activated Cement Customer',
    },
  };
}

function testProduct() {
  return {
    id: 'product-1',
    productCode: 'CEM-OPC-50KG',
    productName: 'Ordinary Portland Cement',
    description: 'General-purpose Portland cement for concrete applications.',
    shortDescription: 'General-purpose Portland cement.',
    image: null,
    packagingType: 'Bag',
    uom: '50KG_BAG',
    category: 'Cement',
    displayOrder: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function registrationResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      registration: {
        id: '11111111-1111-4111-8111-111111111111',
        reference: null,
        status: 'DRAFT',
        currentStep: 1,
        company: {},
        contact: {},
        documents: { cr: {}, vat: {} },
        deliveryLocations: [],
        administrator: {},
        submittedAt: null,
        updatedAt: new Date().toISOString(),
        ...overrides,
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}
