import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRoutes } from './AppRoutes';

const routes = [
  ['/login', 'Welcome Back'],
  ['/forgot-password', 'Forgot Password?'],
  ['/forgot-password/check-email', 'Check Your Email'],
  ['/reset-password?token=example', 'Reset Your Password'],
  ['/reset-password/success', 'Password Reset Successfully'],
] as const;

afterEach(() => {
  cleanup();
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

  it('navigates from the login registration link to the registration start page', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: /register your organization/i }));

    expect(
      screen.getByRole('heading', { name: 'Register Your Organization', level: 2 }),
    ).toBeInTheDocument();
  });

  it('navigates from the registration start page to company information', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /start registration/i }));

    expect(
      screen.getByRole('heading', { name: 'Company Information', level: 1 }),
    ).toBeInTheDocument();
  });
});
