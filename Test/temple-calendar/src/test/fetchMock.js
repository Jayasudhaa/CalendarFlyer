/**
 * src/test/fetchMock.js
 * A permissive default `fetch` stub so mounting a page never makes a real
 * network call. It returns generically-shaped, plausible data for whatever
 * endpoint is hit — good enough for smoke tests (the page just needs to
 * render without throwing on `data.events.map(...)` etc.), and every field
 * a route this app actually returns has been seen at least once this
 * session (events, sheets, broadcast config, org settings, follow state).
 *
 * Feature tests that care about a SPECIFIC response override per-call with
 * `mockFetchResponse(matcher, body, init)` — matched first-in-wins, checked
 * before falling back to the generic default below.
 */
import { vi } from 'vitest';

const DEFAULT_JSON = {
  events: [], sheets: [], slots: [], hours: [], members: [], photos: [],
  announcements: [], results: [], history: [],
  count: 0, following: false, locked: false, early_access_hours: 0,
  configured: { whatsapp: false, facebook: false, instagram: false, email: false },
  organization: {
    org_id: 'org-test', name: 'Sri Lakshmi Temple', subdomain: 'test-temple',
    category: 'temple', broadcast_email: '', billing: null, logo_url: '',
  },
  user: { id: 'user-test', name: 'Test Admin', email: 'admin@example.com' },
  // Singular shapes for the /:eventId-style detail routes (RSVPPage,
  // PhotoSharePage, SignupPage) alongside the plural list shapes above —
  // different endpoints return one or the other and the mock can't know
  // which without inspecting the URL, so both are always present.
  event: { event_id: 'evt-test', title: 'Test Event', date: '2026-01-01', type: 'other', description: '' },
  sheet: { sheet_id: 'sheet-test', title: 'Test Sheet', type: 'volunteer', slots: [], early_access_hours: 0, locked: false },
  slot: { slot_id: 'slot-test', label: 'Test Slot', capacity: 3, confirmed: [], waitlist: [] },
  // GET /api/admin/stats's shape (server/routes/admin.js) -- MyProfile.jsx's
  // /platform tab reads platformStats.totals.organizations etc directly
  // with no optional chaining, so a mock missing `totals` doesn't fail
  // gracefully, it throws and takes the whole test run down with it.
  totals: { organizations: 1, users: 1, events: 0 },
  signups_last_7_days: 0, signups_last_30_days: 0,
  events_created_last_7_days: 0, events_created_last_30_days: 0,
  organizations_by_category: {}, organizations_by_plan: {},
  // The org LIST (plural, admin.js's `organizations: orgList`) -- distinct
  // from `totals.organizations` above, which is just the count. The
  // platform page's org table does `.map()` straight over this with no
  // fallback, so a mock missing it throws instead of rendering an empty table.
  organizations: [],
  success: true, error: null,
};

let overrides = [];

/** Register a one-off (or persistent) override. `matcher` is a substring or RegExp tested against the request URL. */
export function mockFetchResponse(matcher, body, init = {}) {
  overrides.push({ matcher, body, init });
}

export function clearFetchOverrides() {
  overrides = [];
}

function matches(matcher, url) {
  return matcher instanceof RegExp ? matcher.test(url) : url.includes(matcher);
}

export function installFetchMock() {
  overrides = [];
  vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
    const href = typeof url === 'string' ? url : (url?.url || String(url));
    const hit = overrides.find(o => matches(o.matcher, href));
    const status = hit?.init?.status ?? 200;
    const ok = status >= 200 && status < 300;
    const body = hit ? hit.body : DEFAULT_JSON;
    return {
      ok, status,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      headers: new Map(),
    };
  }));
}
