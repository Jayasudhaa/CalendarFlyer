/**
 * src/pages/RSVPAdmin.jsx
 * RSVP Analytics — real page (routed at /analytics), not a popup.
 *
 * This is a thin wrapper: it fetches events itself (via useEvents, same
 * hook the rest of the admin app uses) and renders the shared
 * RSVPAnalyticsPage component full-page instead of inside a dark-backdrop
 * modal overlay. RSVPAnalyticsPage already has the more correct/complete
 * implementation (stable eventId-based keys, legacy `meal:` attendance
 * fallback, richer error surfacing) — kept as the single source of truth so
 * the two RSVP-analytics UIs don't keep drifting apart.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import RSVPAnalyticsPage from '../components/RSVPAnalyticsPage';
import AdminToolbar from '../components/AdminToolbar';

// Same soft warm-gold halo background used on the admin calendar page —
// applied consistently across every admin page (Broadcast, Flyer, Analytics,
// My Profile, Subscription, Settings) instead of each having its own look.
// Was a warm-gold radial halo (var(--cf-accent-glow) x3) — dropped for a
// flat pure-white page background as part of the black & white redesign
// (same fix as App.jsx/CalendarGrid.jsx/MyProfile.jsx).
const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

export default function RSVPAdmin() {
  const { events, loading } = useEvents();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', ...HALO_BG }}>
      <AdminToolbar activePage="analytics" />
      <div style={{ padding: 20 }}>
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            minHeight: 'calc(100vh - 98px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {loading && events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--cf-text-muted, #9a7a55)' }}>
              ⏳ Loading events...
            </div>
          ) : (
            <RSVPAnalyticsPage events={events} onClose={() => navigate('/admin')} />
          )}
        </div>
      </div>
    </div>
  );
}
