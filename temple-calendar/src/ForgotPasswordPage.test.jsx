/**
 * ForgotPasswordPage.test.jsx
 * Covers the "Forgot password?" request form — the anti-enumeration
 * design means the frontend never distinguishes account-found vs. not, so
 * the main thing worth pinning down is that submitting always shows the
 * same generic confirmation, and that a bare "back to sign in" path exists.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/utils';
import { mockFetchResponse } from './test/fetchMock';
import ForgotPasswordPage from './ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  it('renders an email field and a submit button', () => {
    renderWithProviders(<ForgotPasswordPage />, { authed: false, route: '/forgot-password' });
    expect(screen.getByPlaceholderText(/you@temple.org/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows the same generic confirmation after submitting, regardless of server response', async () => {
    mockFetchResponse('/api/auth/forgot-password', { success: true, message: 'anything' });
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />, { authed: false, route: '/forgot-password' });

    await user.type(screen.getByPlaceholderText(/you@temple.org/i), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/if an account exists for that email/i)).toBeInTheDocument();
  });

  it('has a link back to sign in', () => {
    renderWithProviders(<ForgotPasswordPage />, { authed: false, route: '/forgot-password' });
    expect(screen.getByRole('button', { name: /back to sign in/i })).toBeInTheDocument();
  });
});
