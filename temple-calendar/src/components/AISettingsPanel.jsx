/**
 * AISettingsPanel.jsx
 * Super-admin-only editor for the AI image-generation guardrails used by
 * Flyer Studio's "AI Gen" tab (server/routes/generate-image.js).
 *
 * Rendered inside PlatformDashboard.jsx's "AI Image Settings" tab, which is
 * already gated by the platform admin code (same code used for
 * /api/admin/stats). This panel talks to GET/PUT /api/admin/ai-settings,
 * guarded server-side by the same superAdminGuard — org-level admins and
 * regular users never see this screen or this data.
 */
import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldAlert, Save, RotateCcw } from 'lucide-react';

// Auth for platform-admin API calls: the manual ADMIN_SECRET code when one
// was typed in on the lock screen, otherwise this account's own login token
// (see PLATFORM_ADMIN_EMAILS / superAdminGuard in server/routes/admin.js) --
// so a super-admin who auto-unlocked via their regular login isn't stuck
// sending an empty x-admin-secret header that always 401s.
function adminAuthHeaders(adminCode) {
  if (adminCode) return { 'x-admin-secret': adminCode };
  const token = localStorage.getItem('cf_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}


// The 5 org types with their own distinct AI-image prompt config (see
// KNOWN_CATEGORIES in server/utils/aiSettingsStore.js). Every other org
// type -- regional/language associations, mela/fair organizer, nonprofit,
// plain community org, other -- shares the 'community' config below, so
// there's nothing separate to edit for them here.
const CATEGORY_ORDER = ['temple', 'community', 'dance_school', 'music_school', 'yoga_school', 'restaurant', 'grocery'];
const CATEGORY_TITLES = {
  temple: '🕉️ Temple org type',
  community: '🏘️ Nonprofit / Community / Regional Associations / Other org types',
  dance_school: '💃 Dance School org type',
  music_school: '🎵 Music School org type',
  yoga_school: '🧘 Yoga School org type',
  restaurant: '🍽️ Restaurant org type',
  grocery: '🛒 Grocery Store org type',
};

function toLines(arr) {
  return Array.isArray(arr) ? arr.join(', ') : '';
}
function fromLines(str) {
  return String(str || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export default function AISettingsPanel({ adminCode }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const [systemPrompt, setSystemPrompt] = useState('');
  const [blockedTermsText, setBlockedTermsText] = useState('');
  const [categories, setCategories] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/ai-settings', {
        headers: adminAuthHeaders(adminCode),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `Failed to load (${res.status})`);
      }
      const data = await res.json();
      setSystemPrompt(data.systemPrompt || '');
      setBlockedTermsText(toLines(data.blockedTerms));
      setCategories(data.categories || {});
      setUpdatedAt(data.updatedAt || null);
    } catch (err) {
      setError(err.message || 'Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  };

  // Load unconditionally on mount -- adminCode may be empty for a
  // token-based super-admin (see adminAuthHeaders above), so gating this on
  // adminCode being truthy left the panel stuck on "Loading..." forever.
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCategoryField = (key, field, value) => {
    setCategories(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      const payloadCategories = {};
      for (const key of CATEGORY_ORDER) {
        if (!categories[key]) continue;
        payloadCategories[key] = {
          label: categories[key].label || '',
          examples: categories[key].examples || '',
          styleSuffix: categories[key].styleSuffix || '',
          posterStyleSuffix: categories[key].posterStyleSuffix || '',
          referenceStyleSuffix: categories[key].referenceStyleSuffix || '',
          requiredContext: Array.isArray(categories[key].requiredContext)
            ? categories[key].requiredContext
            : fromLines(categories[key].requiredContext),
        };
      }
      const res = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders(adminCode) },
        body: JSON.stringify({
          systemPrompt,
          blockedTerms: fromLines(blockedTermsText),
          categories: payloadCategories,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `Save failed (${res.status})`);
      }
      const data = await res.json();
      setSystemPrompt(data.systemPrompt || '');
      setBlockedTermsText(toLines(data.blockedTerms));
      setCategories(data.categories || {});
      setUpdatedAt(data.updatedAt || null);
      setSavedMsg('Saved — takes effect on the next image generation.');
      setTimeout(() => setSavedMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500 py-10 text-center">Loading AI settings…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-orange-900">
          <p className="font-semibold mb-1">Super-admin only</p>
          <p className="text-orange-800">
            This controls the safety guardrails and prompt behavior for every org's AI flyer image generation
            (Flyer Studio → AI Gen). Org admins and users never see this screen or this text — it's applied
            silently on the server to every request, on top of the required-content check and OpenAI's own
            moderation filter.
          </p>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {savedMsg && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{savedMsg}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-orange-600" />
          <p className="text-sm font-semibold text-gray-900">Global system prompt</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Always appended to every AI image request, for every org, regardless of category. This is the last line
          of defense against nudity, sexual content, violence, or out-of-context images — keep it strict.
        </p>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-900 mb-2">Globally blocked terms</p>
        <p className="text-xs text-gray-500 mb-3">
          Comma-separated. Any prompt containing one of these (as a whole word, or as a phrase) is rejected before
          it ever reaches the image model or the moderation API.
        </p>
        <textarea
          value={blockedTermsText}
          onChange={e => setBlockedTermsText(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {CATEGORY_ORDER.map(key => {
        const cat = categories[key] || {};
        return (
          <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">{CATEGORY_TITLES[key] || key}</p>

            <label className="block text-xs font-semibold text-gray-600 mb-1">Description shown in error messages</label>
            <input
              value={cat.label || ''}
              onChange={e => updateCategoryField(key, 'label', e.target.value)}
              className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <label className="block text-xs font-semibold text-gray-600 mb-1">Example prompts shown to users</label>
            <input
              value={cat.examples || ''}
              onChange={e => updateCategoryField(key, 'examples', e.target.value)}
              className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Required-context keywords (comma-separated — prompt must contain at least one)
            </label>
            <textarea
              value={toLines(cat.requiredContext)}
              onChange={e => updateCategoryField(key, 'requiredContext', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Background-mode style suffix (image only, no text — org's own editable text overlays on top)
            </label>
            <textarea
              value={cat.styleSuffix || ''}
              onChange={e => updateCategoryField(key, 'styleSuffix', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <label className="block text-xs font-semibold text-gray-600 mb-1">
              AI Poster-mode style suffix (AI renders the title/date/time/venue text into the image itself)
            </label>
            <textarea
              value={cat.posterStyleSuffix || ''}
              onChange={e => updateCategoryField(key, 'posterStyleSuffix', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Reference-photo mode style suffix (used instead of the two suffixes above whenever the org selects a
              reference photo — should ask for a photographic match to the reference, not a repainted illustration)
            </label>
            <textarea
              value={cat.referenceStyleSuffix || ''}
              onChange={e => updateCategoryField(key, 'referenceStyleSuffix', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          onClick={load}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" /> Discard changes
        </button>
        {updatedAt && (
          <span className="text-xs text-gray-400">Last saved {new Date(updatedAt).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
