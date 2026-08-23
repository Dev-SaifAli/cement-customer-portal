import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveDraftButton } from '../components/registration/SaveDraftButton';
import { RegistrationProvider, useRegistration } from '../context/RegistrationContext';
import ApplicationSubmitted from '../pages/registration/ApplicationSubmitted';
import CustomerAdmin from '../pages/registration/CustomerAdmin';
import ReviewSubmit from '../pages/registration/ReviewSubmit';
import { AppRoutes } from './AppRoutes';

const routes = [
  ['/login', 'Welcome Back'],
  ['/forgot-password', 'Forgot Password?'],
  ['/forgot-password/check-email', 'Check Your Email'],
  ['/reset-password?token=example', 'Reset Your Password'],
  ['/reset-password/success', 'Password Reset Successfully'],
] as const;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.mocked(fetch).mockClear();
});

describe('authentication routes', () => {
  it.each(routes)('renders %s', (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  });

  it('navigates from the login registration link to the registration start page', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: /register your organization/i }));

    expect(
      screen.getByRole('heading', { name: 'Register Your Organization', level: 2 }),
    ).toBeInTheDocument();
    await screen.findByRole('button', { name: /start registration/i });

    const registrationCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes('/registrations'));

    expect(registrationCalls).toHaveLength(0);
  });

  it('validates customer login required fields on the existing /login page', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email address is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByText('Please complete the security verification.')).toBeInTheDocument();
  });

  it('blocks customer login before the API call when CAPTCHA is blank or incorrect', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'correct-password' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Please complete the security verification.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/security verification/i), {
      target: { value: '999' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText('Security verification answer is incorrect. Please try again.'),
    ).toBeInTheDocument();

    const customerLoginCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).endsWith('/customer/auth/login'));
    expect(customerLoginCalls).toHaveLength(0);
  });

  it('refreshes the customer login CAPTCHA challenge', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    const initialChallenge = await findCaptchaChallengeText();
    fireEvent.click(screen.getByRole('button', { name: /refresh security challenge/i }));

    await waitFor(async () => {
      expect(await findCaptchaChallengeText()).not.toBe(initialChallenge);
    });
  });

  it('shows a generic customer login error for invalid credentials on /login', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'wrong@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'wrong-password' },
    });
    fillCaptchaAnswer();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  });

  it('redirects customer login to the authenticated customer dashboard route', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'correct-password' },
    });
    fillCaptchaAnswer();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByRole('heading', {
        name: /customer dashboard/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
  });

  it('keeps customer login show/hide password working', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    const passwordInput = await screen.findByLabelText(/password/i, {
      selector: 'input',
    });
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('redirects protected customer routes to the existing /login page when unauthenticated', async () => {
    render(
      <MemoryRouter initialEntries={['/customer/dashboard']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Welcome Back', level: 1 }),
    ).toBeInTheDocument();
  });

  it('does not create a draft until the user explicitly saves company information', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    const startButton = await screen.findByRole('button', { name: /start registration/i });
    await waitFor(() => expect(startButton).toBeEnabled());

    expect(
      vi.mocked(fetch).mock.calls.filter(([input]) => String(input).includes('/registrations')),
    ).toHaveLength(0);

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Company Information', level: 1 }),
      ).toBeInTheDocument();
    });

    expect(
      vi.mocked(fetch).mock.calls.filter(([input]) => String(input).includes('/registrations')),
    ).toHaveLength(0);

    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/arabian construction/i), {
      target: { value: 'AlSafwa Test Customer' },
    });
    fireEvent.change(screen.getByPlaceholderText(/10-digit number/i), {
      target: { value: '1234567890' },
    });
    fireEvent.change(screen.getByPlaceholderText(/15-digit number/i), {
      target: { value: '123456789012345' },
    });
    fireEvent.change(screen.getByPlaceholderText(/building number/i), {
      target: { value: '123 Cement Road' },
    });
    fireEvent.change(screen.getByPlaceholderText(/jeddah/i), {
      target: { value: 'Jeddah' },
    });

    const regionSelect = screen.getAllByRole('combobox')[0];
    expect(regionSelect).toBeDefined();
    fireEvent.change(regionSelect!, {
      target: { value: 'Makkah Province' },
    });
    fireEvent.change(screen.getByPlaceholderText(/5-digit code/i), {
      target: { value: '12345' },
    });

    expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.filter(([input]) => String(input).endsWith('/registrations')),
      ).toHaveLength(1);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saved/i })).toBeDisabled();
    });

    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'PATCH'),
      ).toHaveLength(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Primary Contact Information', level: 1 }),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    });

    const registrationCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).endsWith('/registrations'));
    const updateCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([, options]) => options?.method === 'PATCH');

    expect(registrationCalls).toHaveLength(1);
    expect(updateCalls).toHaveLength(0);
  });

  it('keeps customer administrator save draft disabled until data changes and disables it after save', async () => {
    render(
      <MemoryRouter>
        <RegistrationProvider>
          <CustomerAdmin />
        </RegistrationProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    });

    const fields = screen.getAllByRole('textbox');

    fireEvent.change(fields[0]!, {
      target: { value: 'Sara Admin' },
    });
    fireEvent.change(fields[1]!, {
      target: { value: 'Portal Administrator' },
    });
    fireEvent.change(fields[2]!, {
      target: { value: 'sara.admin@example.com' },
    });
    fireEvent.change(fields[3]!, {
      target: { value: '512345678' },
    });

    const passwordFields = document.querySelectorAll<HTMLInputElement>('input[type="password"]');

    fireEvent.change(passwordFields[0]!, {
      target: { value: 'Password1' },
    });
    fireEvent.change(passwordFields[1]!, {
      target: { value: 'Password1' },
    });

    expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saved/i })).toBeDisabled();
    });
  });

  it('allows save draft after an earlier no-op save attempt', async () => {
    function NoOpSaveThenCompanyUpdate() {
      const { saveDraft, updateCompany } = useRegistration();

      return (
        <>
          <button type="button" onClick={() => void saveDraft()}>
            No-op save
          </button>
          <button
            type="button"
            onClick={() =>
              updateCompany({
                companyName: 'AlSafwa Test Customer',
                crNumber: '1234567890',
                vatNumber: '123456789012345',
                streetAddress: '123 Cement Road',
                city: 'Jeddah',
                region: 'Makkah Province',
                postalCode: '12345',
              })
            }
          >
            Enter company data
          </button>
          <SaveDraftButton className="rounded-md border border-gray-400 bg-white px-6 py-3 text-sm font-semibold text-gray-600 disabled:opacity-60" />
        </>
      );
    }

    render(
      <MemoryRouter>
        <RegistrationProvider>
          <NoOpSaveThenCompanyUpdate />
        </RegistrationProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /no-op save/i }));
    fireEvent.click(screen.getByRole('button', { name: /enter company data/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.filter(([input]) => String(input).endsWith('/registrations')),
      ).toHaveLength(1);
    });
  });

  it('renders the submitted screen from stored submitted confirmation', async () => {
    window.sessionStorage.setItem(
      'alsafwa_submitted_application',
      JSON.stringify({
        reference: 'APP-2026-123456',
        status: 'UNDER_REVIEW',
        statusLabel: 'Pending Sales Review',
        submittedAt: new Date().toISOString(),
      }),
    );

    render(
      <MemoryRouter initialEntries={['/register/submitted']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Application Submitted', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('APP-2026-123456')).toBeInTheDocument();
  });

  it('navigates from review submit to the submitted confirmation screen', async () => {
    render(
      <MemoryRouter initialEntries={['/register/review']}>
        <RegistrationProvider>
          <Routes>
            <Route
              path="/register/review"
              element={
                <>
                  <SeedCompleteRegistration />
                  <ReviewSubmit />
                </>
              }
            />
            <Route path="/register/submitted" element={<ApplicationSubmitted />} />
          </Routes>
        </RegistrationProvider>
      </MemoryRouter>,
    );

    await screen.findByText('AlSafwa Test Customer');

    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    expect(
      await screen.findByRole('heading', { name: 'Application Submitted', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('APP-2026-123456')).toBeInTheDocument();
  });
});

async function findCaptchaChallengeText() {
  const challenge = await screen.findByText(/^\d+ \+ \d+ = \?$/);
  return challenge.textContent ?? '';
}

function fillCaptchaAnswer() {
  const challengeText = screen.getByText(/^\d+ \+ \d+ = \?$/).textContent ?? '';
  const [left, right] = challengeText.match(/\d+/g)?.map(Number) ?? [];

  fireEvent.change(screen.getByLabelText(/security verification/i), {
    target: { value: String((left ?? 0) + (right ?? 0)) },
  });
}

function SeedCompleteRegistration() {
  const {
    setDeliveryLocations,
    updateAdministrator,
    updateCompany,
    updateContact,
    updateDocuments,
  } = useRegistration();

  useEffect(() => {
    updateCompany({
      companyName: 'AlSafwa Test Customer',
      crNumber: '1234567890',
      vatNumber: '123456789012345',
      streetAddress: '123 Cement Road',
      city: 'Jeddah',
      region: 'Makkah Province',
      postalCode: '12345',
    });
    updateContact({
      fullName: 'Sara Contact',
      jobTitle: 'Procurement Manager',
      email: 'sara.contact@example.com',
      phone: '512345678',
    });
    updateDocuments({
      cr: {
        file: null,
        fileName: 'cr.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        uploadedAt: '2026-08-20T10:00:00.000Z',
        expiryDate: '2099-12-31',
      },
      vat: {
        file: null,
        fileName: 'vat.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        uploadedAt: '2026-08-20T10:00:00.000Z',
        expiryDate: '2099-12-31',
      },
    });
    setDeliveryLocations([
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
        contactPhone: '512345679',
      },
    ]);
    updateAdministrator({
      fullName: 'Sara Admin',
      jobTitle: 'Portal Administrator',
      email: 'sara.admin@example.com',
      phone: '512345680',
      password: 'Password1',
      confirmPassword: 'Password1',
    });
  }, [setDeliveryLocations, updateAdministrator, updateCompany, updateContact, updateDocuments]);

  return null;
}
