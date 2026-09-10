/**
 * ResetPasswordPage.test.jsx
 * Covers the reset-password form: no-token error state, client-side
 * validation (min length / match), and the success/error states after
 * calling useAuth().resetPassword(token, password).
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/utils';
import { mockFetchResponse } from './test/fetchMock';
import ResetPasswordPage from './ResetPasswordPage';

async function fillAndSubmit(user, password, confirmPassword) {
  await user.type(screen.getByLabelText(/^new password$/i), password);
  await user.type(screen.getByLabelText(/confirm new password/i), confirmPassword);
  await user.click(screen.getByRole('button', { name: /reset password/i }));
}

describe('ResetPasswordPage', () => {
  it('shows an error state immediately when there is no token in the URL', () => {
    renderWithProviders(<ResetPasswordPage />, { authed: false, route: '/reset-password' });
    expect(screen.getByText(/missing reset token/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request a new link/i })).toBeInTheDocument();
    // No form should be rendered when there's nothing to submit.
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
  });

  it('renders the password form when a token is present', () => {
    renderWithProviders(<ResetPasswordPage />, { authed: false, route: '/reset-password?token=abc123' });
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it('rejects a too-short password client-side without calling the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { authed: false, route: '/reset-password?token=abc123' });
    await fillAndSubmit(user, 'short', 'short');
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('rejects mismatched passwords client-side', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { authed: false, route: '/reset-password?token=abc123' });
    await fillAndSubmit(user, 'longenoughpassword', 'somethingelse123');
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
  });

  it('shows a success state and a link to sign in when the server accepts the reset', async () => {
    mockFetchResponse('/api/auth/reset-password', { success: true });
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { authed: false, route: '/reset-password?token=abc123' });
    await fillAndSubmit(user, 'longenoughpassword', 'longenoughpassword');
    expect(await screen.findByText(/password reset!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to sign in/i })).toBeInTheDocument();
  });

  it('shows the server error and a link to request a new link when the token is invalid/expired', async () => {
    mockFetchResponse('/api/auth/reset-password', { error: 'This reset link is invalid or has expired. Please request a new one.' }, { status: 400 });
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { authed: false, route: '/reset-password?token=abc123' });
    await fillAndSubmit(user, 'longenoughpassword', 'longenoughpassword');
    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request a new link/i })).toBeInTheDocument();
  });
});
