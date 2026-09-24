/**
 * ModeSelection - after login, choose how to view the calendar.
 *
 * White background, black text — matches the rest of the app now that it's
 * moved off the old purple-gradient theme (see PremiumLogin.jsx, GlassCard's
 * `light` mode).
 *
 * An Owner or Admin gets a real switcher here: click either card and you're
 * straight in, no password prompt. That's not a shortcut around security —
 * the old "Admin Verification" password step was checking the exact same
 * password you'd already logged in with, and /admin itself never re-checked
 * it either (see App.jsx's AdminCalendar, which only requires
 * isAuthenticated). Asking for it again here was a leftover from before
 * this app had per-user roles, not a real gate, so it's gone. A Viewer
 * account only ever sees the one option, since a Viewer has no admin
 * capability to switch into.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import GlassCard from './GlassCard';
import BrandMark from './components/BrandMark';
import { Eye, Shield, ArrowRight } from 'lucide-react';

export default function ModeSelection() {
  const navigate = useNavigate();
  const { user, isAuthenticated, canManage, organization } = useAuth();

  // Redirecting during render (calling navigate() directly in the component
  // body, not in an effect) updates the router while this component is
  // still rendering — React logs "Cannot update a component while
  // rendering a different component" and it can behave inconsistently
  // under StrictMode's double-render in dev. Moved into an effect so the
  // redirect happens after render commits, like every other redirect in
  // this app.
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  // Bare '/calendar' resolves NO organization on the app's own bare domain
  // (org lookup here is by subdomain, and this admin app never runs on one)
  // — same bug AdminToolbar.jsx's "View Site" link works around with the
  // same ?org= override every public calendar page reads. Without it this
  // screen would send you to an empty calendar that looks like a different,
  // unconfigured site.
  const viewerUrl = organization?.subdomain
    ? `/calendar?org=${encodeURIComponent(organization.subdomain)}`
    : '/calendar';
  const goViewer = () => navigate(viewerUrl, { replace: true });
  const goAdmin = () => navigate('/admin', { replace: true });
  const firstName = (user?.display_name || user?.email?.split('@')[0] || 'there').trim();

  return (
    <div className="relative min-h-screen bg-white flex items-center justify-center px-4 py-16">
      {/* Same soft decorative wash as PremiumLogin/PremiumSignup — kept
          subtle and grayscale so this page reads as part of the same
          monochrome product, not a one-off screen. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-gray-50 rounded-full blur-3xl -top-10 -left-10" />
        <div className="absolute w-96 h-96 bg-gray-50 rounded-full blur-3xl -bottom-10 -right-10" />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        {/* Brand + welcome */}
        <div className="text-center mb-12">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-3 mb-8">
            <BrandMark size={44} />
            <span className="text-2xl font-bold text-black" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              CalendarFly
            </span>
          </button>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">
            Events simplified, community amplified
          </p>

          <h1
            className="text-4xl sm:text-5xl font-extrabold text-black mb-3"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Welcome, {firstName}!
          </h1>
          <p className="text-gray-500 text-lg">
            {canManage
              ? 'Switch between Admin and Viewer any time to check how things look on either side.'
              : 'Continue to your calendar.'}
          </p>
        </div>

        {canManage ? (
          <div className="grid sm:grid-cols-2 gap-6">
            <GlassCard
              light
              hover
              onClick={goViewer}
              className="p-8 text-center cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mx-auto mb-5">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-black mb-2">Viewer Mode</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                See the calendar the way your community sees it — browse events and add them to Google Calendar.
              </p>
              <div className="inline-flex items-center gap-1.5 text-black font-semibold text-sm">
                Enter Viewer Mode <ArrowRight className="w-4 h-4" />
              </div>
            </GlassCard>

            <GlassCard
              light
              hover
              onClick={goAdmin}
              className="p-8 text-center cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mx-auto mb-5">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-black mb-2">Admin Mode</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Manage events, create flyers, send broadcasts, and view analytics.
              </p>
              <div className="inline-flex items-center gap-1.5 text-black font-semibold text-sm">
                Enter Admin Mode <ArrowRight className="w-4 h-4" />
              </div>
            </GlassCard>
          </div>
        ) : (
          <div className="max-w-sm mx-auto">
            <GlassCard
              light
              hover
              onClick={goViewer}
              className="p-8 text-center cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mx-auto mb-5">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-black mb-2">Your Calendar</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Browse events and add them to Google Calendar.
              </p>
              <div className="inline-flex items-center gap-1.5 text-black font-semibold text-sm">
                Continue <ArrowRight className="w-4 h-4" />
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
