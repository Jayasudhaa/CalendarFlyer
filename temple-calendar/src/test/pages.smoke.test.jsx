/**
 * src/test/pages.smoke.test.jsx
 *
 * "Every page loads without crashing" — one test per route in App.jsx's
 * <Routes> table. This is the test that would have caught the live
 * `Uncaught ReferenceError: followerCount is not defined` crash on
 * SignupsAdminPage before it ever reached a browser: that bug was a plain
 * render-time throw, and every render-time throw in a mounted page fails
 * the matching test below instead of shipping.
 *
 * What this does NOT prove: that a page's data is correct, or that a
 * specific feature works end to end — see the feature test files
 * (broadcast.test.jsx, signups.test.jsx, follow.test.jsx, etc.) for that.
 * The fetch responses here come from a generic mock (see fetchMock.js) —
 * if a page expects a shape that mock doesn't provide and throws, check
 * whether that's this mock being incomplete or a real bug in the page
 * before assuming either way.
 *
 * Add a new route to App.jsx? Add one line to the matching array below —
 * that's the whole registration step.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderAppAt } from './utils';

// Routes anyone can hit without logging in.
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/reset-password?token=fake-test-token',
  '/calendar',
  '/public',
  '/features',
  '/pricing',
  '/about',
  '/contact',
  '/careers',
  '/privacy',
  '/terms',
  '/security',
  '/rsvp/evt-test',
  '/photos/evt-test',
  '/signups/evt-test',
];

// Routes that are part of the logged-in admin experience.
const ADMIN_ROUTES = [
  '/admin',
  '/onboarding',
  '/settings',
  '/profile',
  '/subscription',
  '/analytics',
  '/platform',
  '/photos-admin',
  '/signups-admin',
];

describe('every public page renders without throwing', () => {
  it.each(PUBLIC_ROUTES)('%s', async (path) => {
    renderAppAt(path, { authed: false });
    // Let mount-time effects (the fetches every page fires on load) settle
    // before asserting — a crash inside a .then()/async handler still fails
    // this the same way an unhandled rejection would.
    await screen.findByText(/./, {}, { timeout: 3000 }).catch(() => {});
    expect(document.body).toBeTruthy();
  });
});

describe('every admin-area page renders without throwing (logged in)', () => {
  it.each(ADMIN_ROUTES)('%s', async (path) => {
    renderAppAt(path, { authed: true });
    await screen.findByText(/./, {}, { timeout: 3000 }).catch(() => {});
    expect(document.body).toBeTruthy();
  });
});

describe('admin-area pages redirect a logged-out visitor', () => {
  // AdminCalendar (the /admin route) explicitly checks isAuthenticated and
  // redirects — this pins that guard down so it can't silently regress.
  it('/admin sends a logged-out visitor to /login', async () => {
    renderAppAt('/admin', { authed: false });
    await screen.findByText(/./, {}, { timeout: 3000 }).catch(() => {});
    expect(window.location.pathname).toBe('/login');
  });
});

describe('/select-mode renders the mode selection screen', () => {
  // Restored in this pass — it used to just redirect straight to /admin;
  // now a logged-in user sees the real Public/Admin mode choice again.
  it('shows Public Mode / Admin Mode choices for a logged-in user', async () => {
    renderAppAt('/select-mode', { authed: true });
    await screen.findByRole('heading', { name: 'Public Mode' }, { timeout: 3000 });
    expect(window.location.pathname).toBe('/select-mode');
    expect(screen.getByRole('heading', { name: 'Admin Mode' })).toBeTruthy();
  });

  it('does not crash for a logged-out visitor', async () => {
    // ModeSelection guards itself with `if (!isAuthenticated) navigate(...)`
    // (pre-existing code, unchanged here) — this only pins down that
    // mounting the route doesn't throw, matching this file's other
    // logged-out-visitor checks above.
    renderAppAt('/select-mode', { authed: false });
    await screen.findByText(/./, {}, { timeout: 3000 }).catch(() => {});
    expect(document.body).toBeTruthy();
  });
});

describe('an unknown URL', () => {
  // There is currently no catch-all/404 <Route> in App.jsx — this documents
  // today's actual behavior (a blank page, since nothing matches) rather
  // than asserting what it *should* do. Flip this if a 404 route is added.
  it('matches no route (no 404 page exists yet)', async () => {
    renderAppAt('/this-path-does-not-exist', { authed: false });
    await new Promise(r => setTimeout(r, 50));
    expect(document.body.textContent.trim()).toBe('');
  });
});
