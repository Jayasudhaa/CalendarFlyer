/**
 * src/test/utils.jsx
 * Shared render helper for page-level tests. Renders the REAL <App/> (real
 * router, real AuthProvider) at a given URL instead of importing individual
 * page components with hand-rolled router/context stand-ins — that way a
 * test exercises the exact same route wiring and auth-guard logic
 * production traffic does, and a page moved/renamed in App.jsx's <Routes>
 * fails the test that covers it instead of silently testing nothing.
 *
 * Auth is "logged in" exactly the way the real browser is: by seeding the
 * same localStorage keys AuthContext itself reads on mount (see
 * contexts/AuthContext.jsx) — no mocking of the context internals needed.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from '../App';

// main.jsx wraps <App/> in a GoogleOAuthProvider (PremiumLogin's
// GoogleLoginButton throws without one) — mirrored here so a page test
// sees the same provider tree production actually mounts into. The client
// ID doesn't matter for tests (no real Google call is ever made), it only
// needs to be a non-empty string so the provider doesn't itself complain.
const TEST_GOOGLE_CLIENT_ID = 'test-google-client-id';

export function seedAuth({
  user = { id: 'user-test', name: 'Test Admin', email: 'admin@example.com' },
  organization = { org_id: 'org-test', name: 'Sri Lakshmi Temple', subdomain: 'test-temple', category: 'temple' },
  token = 'test-token',
} = {}) {
  localStorage.setItem('cf_token', token);
  localStorage.setItem('cf_user', JSON.stringify(user));
  localStorage.setItem('cf_org', JSON.stringify(organization));
}

/**
 * Mounts <App/> with the browser's URL already at `path` before React ever
 * renders — App's own <BrowserRouter> picks that up like a real deep link
 * or page refresh would. Pass `authed: true` to simulate an already-logged-
 * in admin (most /admin-area pages redirect to /login otherwise, which is
 * itself a legitimate thing this same helper can assert on).
 */
export function renderAppAt(path, { authed = false, authOptions } = {}) {
  if (authed) seedAuth(authOptions);
  window.history.pushState({}, '', path);
  return render(
    <GoogleOAuthProvider clientId={TEST_GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}

// ─── Isolated component rendering (feature tests) ──────────────────────────
// renderAppAt above is for whole-page smoke coverage. Feature tests that
// exercise one component's behavior in detail render it directly — still
// under the real AuthProvider (seeded via localStorage, same as above) and
// a MemoryRouter so useNavigate/useLocation calls don't throw, without
// pulling in the rest of the app's routes.
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';

export function renderWithProviders(ui, { authed = true, authOptions, route = '/' } = {}) {
  if (authed) seedAuth(authOptions); else localStorage.clear();
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}
