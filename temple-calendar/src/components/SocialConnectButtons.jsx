/**
 * SocialConnectButtons — "Continue with Facebook" / "Continue with
 * Instagram", the real one-click OAuth connect flow (routes/facebookAuth.js
 * + routes/instagramAuth.js on the server). Shows both platforms' saved
 * connection status at once, from organization.social_accounts (same
 * source WhatsApp's block in PremiumSettings already reads from), so it
 * stays accurate across reloads rather than only right after connecting.
 *
 * Sized and styled to match the original public/connect-social.html test
 * page (big colored buttons with real platform icons, larger type) rather
 * than the smaller compact card style used elsewhere in Settings — this is
 * the primary way most admins will connect, so it's deliberately more
 * prominent than a secondary settings row.
 *
 * Replaces SocialConnectWizardsOld as the primary connect experience in
 * Settings > Social Media — that manual Graph-API-Explorer-paste flow, and
 * the original connect-social.html page, are both still reachable via the
 * clearly-labeled links/buttons at the bottom, in case OAuth is ever
 * blocked by a Meta dashboard setting and someone needs a fallback.
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { playClick } from '../utils/sound';
import SocialConnectWizardsOld from './SocialConnectWizardsOld';

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: '#fff', flexShrink: 0 }}>
    <path d="M22 12.06C22 6.53 17.52 2.04 12 2.04S2 6.53 2 12.06c0 5 3.66 9.13 8.44 9.88v-6.99h-2.54v-2.89h2.54V9.85c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.89h-2.34V21.94C18.34 21.19 22 17.06 22 12.06z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: '#fff', flexShrink: 0 }}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

export default function SocialConnectButtons() {
  const { organization, updateOrganization } = useAuth();
  const [connectingFb, setConnectingFb] = useState(false);
  const [connectingIg, setConnectingIg] = useState(false);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [showOld, setShowOld] = useState(false);

  // Right after Meta redirects back here (?fb=connected&page=... or
  // ?ig=connected&handle=..., or =denied/=error), show a one-time banner
  // and then clean the URL so refreshing the page doesn't re-show it. The
  // persistent "Connected" badges below come from organization.social_
  // accounts, not from these query params — this is just immediate
  // feedback for the click that just happened.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fb = params.get('fb');
    const ig = params.get('ig');
    if (fb === 'connected') setBanner(`Connected to Facebook Page: ${params.get('page') || ''}`);
    else if (fb === 'denied') setError('Facebook connection was cancelled.');
    else if (fb === 'error') setError('Something went wrong connecting Facebook. Please try again.');
    else if (ig === 'connected') setBanner(`Connected to Instagram: @${params.get('handle') || ''}`);
    else if (ig === 'denied') setError('Instagram connection was cancelled.');
    else if (ig === 'error') setError('Something went wrong connecting Instagram. Please try again.');

    if (fb || ig) {
      params.delete('fb');
      params.delete('ig');
      params.delete('page');
      params.delete('handle');
      const cleaned = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', cleaned);
    }
  }, []);

  const startConnect = async (platform, setConnecting) => {
    setError('');
    setBanner('');
    setConnecting(true);
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch(`/auth/${platform}/start`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || `Could not start ${platform === 'facebook' ? 'Facebook' : 'Instagram'} connect.`);
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setConnecting(false);
    }
  };

  const disconnect = async (platform) => {
    const label = platform === 'facebook' ? 'Facebook' : 'Instagram';
    if (!window.confirm(`Disconnect ${label}? Broadcasts to ${label} will fall back to the shared default account, if one is configured.`)) return;
    setError('');
    setBanner('');
    const payload = platform === 'facebook' ? { disconnect_facebook: true } : { disconnect_instagram: true };
    const result = await updateOrganization(payload);
    if (result.success) {
      setBanner(`${label} disconnected`);
    } else {
      setError(result.error || `Failed to disconnect ${label}`);
    }
  };

  const fb = organization?.social_accounts?.facebook;
  const ig = organization?.social_accounts?.instagram;

  return (
    <div className="space-y-5">
      {banner && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-base">{banner}</div>
      )}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-base">{error}</div>
      )}

      {/* Facebook */}
      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-lg">Facebook Page</h3>
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${fb?.connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {fb?.connected ? '✓ Connected' : 'Not connected'}
          </span>
        </div>
        {!fb?.connected ? (
          <button
            type="button"
            onClick={() => { playClick(); startConnect('facebook', setConnectingFb); }}
            disabled={connectingFb}
            style={{ background: '#1877F2' }}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FacebookIcon />
            {connectingFb ? 'Opening Facebook…' : 'Continue with Facebook'}
          </button>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-base text-gray-500">Broadcasting to: <span className="font-semibold text-gray-800">{fb.page_name || 'your Page'}</span></p>
            <button
              type="button"
              onClick={() => { playClick(); disconnect('facebook'); }}
              className="text-sm text-red-600 hover:text-red-700 font-semibold"
            >
              Disconnect Facebook
            </button>
          </div>
        )}
      </div>

      {/* Instagram */}
      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-lg">Instagram</h3>
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${ig?.connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {ig?.connected ? '✓ Connected' : 'Not connected'}
          </span>
        </div>
        {!ig?.connected ? (
          <button
            type="button"
            onClick={() => { playClick(); startConnect('instagram', setConnectingIg); }}
            disabled={connectingIg}
            style={{ background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <InstagramIcon />
            {connectingIg ? 'Opening Instagram…' : 'Continue with Instagram'}
          </button>
        ) : null}
        {!ig?.connected && (
          <p className="text-sm text-gray-500 mt-3">
            Don't want to connect yet? You can still pull in specific events by pasting a public post link —{' '}
            <a href="/signups-admin?tab=instagram" className="text-gray-700 hover:text-gray-900 font-semibold">try it here</a>.
          </p>
        )}
        {ig?.connected && (

          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-base text-gray-500">Connected as: <span className="font-semibold text-gray-800">@{ig.username}</span></p>
            <div className="flex items-center gap-4">
              <a href="/signups-admin?tab=instagram" className="text-sm text-gray-700 hover:text-gray-900 font-semibold">
                Review Instagram events →
              </a>
              <button
                type="button"
                onClick={() => { playClick(); disconnect('instagram'); }}
                className="text-sm text-red-600 hover:text-red-700 font-semibold"
              >
                Disconnect Instagram
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fallbacks -- kept, not deleted, just clearly labeled as the old
          ways of doing this. Bigger/clearer than a single small text link
          so they're easy to find rather than easy to miss. */}
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={() => setShowOld((s) => !s)}
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {showOld ? 'Hide manual setup (old method)' : 'Manual setup (old method)'}
        </button>
        <a
          href="/connect-social.html"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Old test page ↗
        </a>
      </div>
      {showOld && (
        <div className="mt-2 border-t border-gray-100 pt-5">
          <SocialConnectWizardsOld />
        </div>
      )}
    </div>
  );
}
