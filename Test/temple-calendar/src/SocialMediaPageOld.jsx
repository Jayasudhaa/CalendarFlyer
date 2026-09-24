/**
 * SocialMediaPageOld — OLD standalone test page for a one-click "Connect
 * with Facebook / Instagram" OAuth flow (via routes/social-connect.js).
 *
 * Superseded: the real, working connect experience now lives directly in
 * Settings > Social Media (SocialConnectButtons.jsx, on top of
 * routes/facebookAuth.js + routes/instagramAuth.js) -- no standalone page
 * to navigate to separately. This file is NOT imported/routed anywhere
 * anymore (confirmed nothing in src/ references it) -- kept only for
 * reference in case any of its manual-entry wizard logic is useful again.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ArrowLeft, ExternalLink, Copy, Check } from 'lucide-react';
import AdminToolbar from './components/AdminToolbar';

const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };
const GLOSS_BLACK = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)',
  boxShadow: '0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
};


export default function SocialMediaPageOld() {
  const navigate = useNavigate();
  const { organization, updateOrganization } = useAuth();

  // ── Step-by-step manual connect wizard ──────────────────────────────────
  // The OAuth buttons below need Meta's dashboard configured correctly
  // (still blocked as of writing), so this walks through the same
  // Graph API Explorer method that's already proven to work on Settings —
  // one step at a time, same progress-bar pattern as Broadcast Studio.
  const [wizardStep, setWizardStep] = useState(1); // 1-4
  const [pageNameInput, setPageNameInput] = useState('');
  const [pageIdInput, setPageIdInput] = useState('');
  const [pageTokenInput, setPageTokenInput] = useState('');
  const [wizardError, setWizardError] = useState('');
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardSuccess, setWizardSuccess] = useState('');
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [wizardConnected, setWizardConnected] = useState(false);

  const WIZARD_STEPS = [
    { key: 'name',   label: 'Page Name' },
    { key: 'lookup', label: 'Get ID' },
    { key: 'paste',  label: 'Paste Result' },
    { key: 'review', label: 'Review' },
  ];
  const wizardStepState = (index) => {
    if (wizardConnected) return 'done';
    if (index < wizardStep - 1) return 'done';
    if (index === wizardStep - 1) return 'current';
    return 'pending';
  };
  const GRAPH_QUERY = 'me?fields=id,name';
  const copyGraphQuery = () => {
    navigator.clipboard?.writeText(GRAPH_QUERY).then(() => {
      setCopiedQuery(true);
      setTimeout(() => setCopiedQuery(false), 2000);
    }).catch(() => {});
  };

  // ── Instagram wizard — shorter, since it reuses the same Facebook Page
  // selected above rather than asking for a name again (Instagram Business
  // accounts are always attached to a Facebook Page, not looked up on
  // their own).
  const [igWizardStep, setIgWizardStep] = useState(1); // 1-4
  const [igUsernameInput, setIgUsernameInput] = useState('');
  const [igIdInput, setIgIdInput] = useState('');
  const [igWizardError, setIgWizardError] = useState('');
  const [igWizardSaving, setIgWizardSaving] = useState(false);
  const [igWizardSuccess, setIgWizardSuccess] = useState('');
  const [copiedIgQuery, setCopiedIgQuery] = useState(false);
  const [igConnected, setIgConnected] = useState(false);

  const IG_WIZARD_STEPS = [
    { key: 'name',   label: 'Account Name' },
    { key: 'lookup', label: 'Get ID' },
    { key: 'paste',  label: 'Paste Result' },
    { key: 'review', label: 'Review' },
  ];
  const igWizardStepState = (index) => {
    if (igConnected) return 'done';
    if (index < igWizardStep - 1) return 'done';
    if (index === igWizardStep - 1) return 'current';
    return 'pending';
  };
  const IG_GRAPH_QUERY = 'me?fields=instagram_business_account{id,username}';
  const copyIgGraphQuery = () => {
    navigator.clipboard?.writeText(IG_GRAPH_QUERY).then(() => {
      setCopiedIgQuery(true);
      setTimeout(() => setCopiedIgQuery(false), 2000);
    }).catch(() => {});
  };

  // ── Add-a-teammate wizard — Meta App is in Development Mode, so only
  // people added to its Roles can sign in via Graph API Explorer. Purely
  // instructional (nothing here saves to the server) — it just walks
  // through the same request → add → accept → verify sequence a real Meta
  // Business Manager role request goes through.
  const [teamStep, setTeamStep] = useState(1); // 1-4
  const [teammateContact, setTeammateContact] = useState('');
  const [teamDone, setTeamDone] = useState(false);
  const TEAM_STEPS = [
    { key: 'request', label: 'Request' },
    { key: 'addrole', label: 'Add Role' },
    { key: 'accept',  label: 'Accept' },
    { key: 'verify',  label: 'Verify' },
  ];
  const teamStepState = (index) => {
    if (teamDone) return 'done';
    if (index < teamStep - 1) return 'done';
    if (index === teamStep - 1) return 'current';
    return 'pending';
  };

  const handleWizardSave = async () => {
    setWizardSaving(true);
    setWizardError('');
    try {
      const result = await updateOrganization({
        facebook_page_name: pageNameInput.trim(),
        facebook_page_id: pageIdInput.trim(),
        ...(pageTokenInput.trim() ? { facebook_page_token: pageTokenInput.trim() } : {}),
      });
      if (!result.success) throw new Error(result.error || 'Could not save — please try again.');
      setPageTokenInput('');
      setWizardConnected(true);
    } catch (err) {
      setWizardError(err.message);
    } finally {
      setWizardSaving(false);
    }
  };

  const handleIgWizardSave = async () => {
    setIgWizardSaving(true);
    setIgWizardError('');
    try {
      const result = await updateOrganization({
        instagram_account_id: igIdInput.trim(),
        instagram_username: igUsernameInput.trim(),
      });
      if (!result.success) throw new Error(result.error || 'Could not save — please try again.');
      setIgConnected(true);
    } catch (err) {
      setIgWizardError(err.message);
    } finally {
      setIgWizardSaving(false);
    }
  };

  return (
    <div className="min-h-screen" style={HALO_BG}>
      <AdminToolbar activePage="social-media" />
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              style={{ ...GLOSS_BLACK, width: 36, height: 36, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <ArrowLeft className="w-4 h-4" style={{ color: '#fff' }} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Social Media (beta)</h1>
              <p className="text-sm text-gray-500">Step-by-step Facebook connect — separate test page, doesn't touch Settings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          This is a separate test page — your existing Facebook/Instagram connection in <button className="underline font-semibold" onClick={() => navigate('/settings')}>Settings</button> is unaffected either way. Both pages save to the same place, so finishing the wizard below updates Settings too.
        </div>

        {/* ── Step-by-step manual connect wizard ── */}
        <div className="rounded-2xl shadow-[0_12px_40px_-14px_rgba(0,0,0,0.22)] border border-gray-100 overflow-hidden">
          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg,#1c1c1e,#000000)' }} className="px-5 py-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              {WIZARD_STEPS.map((s, i) => {
                const st = wizardStepState(i);
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-extrabold"
                        style={{
                          width: 20, height: 20,
                          background: st === 'done' ? '#4ade80' : st === 'current' ? '#ffffff' : 'rgba(255,255,255,0.08)',
                          color: st === 'pending' ? '#71717a' : '#0a0a0a',
                        }}
                      >
                        {st === 'done' ? '✓' : i + 1}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: st === 'pending' ? '#71717a' : '#ffffff' }}>{s.label}</span>
                    </div>
                    {i < WIZARD_STEPS.length - 1 && <span style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.18)' }} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ height: 3, width: `${(wizardStep / WIZARD_STEPS.length) * 100}%`, background: 'linear-gradient(90deg,#f0b429,#fbbf24)', transition: 'width 300ms ease' }} />
          </div>

          <div className="bg-white p-7">
            {wizardConnected ? (
              <div className="text-center py-2">
                <div className="cf-boom-stage">
                  <div className="cf-boom-ring" />
                  {[...Array(10)].map((_, i) => (
                    <span key={i} className="cf-boom-spoke" style={{ transform: `rotate(${i * 36}deg)` }}>
                      <span className="cf-boom-dot" style={{ animationDelay: `${i * 18}ms` }} />
                    </span>
                  ))}
                  <div className="cf-boom-check">✓</div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>🎉 Connected!</h3>
                <p className="text-sm text-gray-600 mt-1 mb-5">You can now post to <strong>{pageNameInput || 'your Facebook Page'}</strong> on Facebook from Broadcast.</p>
                <button type="button" onClick={() => setWizardConnected(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline">Edit connection</button>
              </div>
            ) : (
            <>
            {wizardError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{wizardError}</div>
            )}

            {wizardStep === 1 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>What's your Facebook Page called?</h3>
                <p className="text-xs text-gray-500 mb-3">The exact name as it appears on Facebook — e.g. "CalendarFly".</p>
                <input
                  type="text"
                  value={pageNameInput}
                  onChange={(e) => setPageNameInput(e.target.value)}
                  placeholder="e.g. CalendarFly"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-sm mb-4"
                  autoFocus
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!pageNameInput.trim()}
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    style={GLOSS_BLACK}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Get the Page ID from Graph API Explorer</h3>
                <ol className="text-sm text-gray-600 space-y-1.5 mb-4 list-decimal list-inside">
                  <li>Open Graph API Explorer (button below)</li>
                  <li>In "User or Page", select <strong>{pageNameInput || 'your Page'}</strong></li>
                  <li>Paste this query into the path field, then click Submit:</li>
                </ol>
                <div className="flex items-center gap-2 mb-4">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm font-mono text-gray-800">{GRAPH_QUERY}</code>
                  <button
                    type="button"
                    onClick={copyGraphQuery}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:border-gray-400 flex items-center gap-1.5 text-xs font-semibold flex-shrink-0"
                  >
                    {copiedQuery ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedQuery ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <a
                  href={`https://developers.facebook.com/tools/explorer/?method=GET&path=${encodeURIComponent(GRAPH_QUERY)}&version=v26.0`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white font-semibold text-sm mb-1"
                  style={{ background: 'linear-gradient(135deg,#1877f2,#0f5fc8)' }}
                >
                  Open Graph API Explorer (query pre-filled) <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <p className="text-xs text-gray-400 mb-4">Meta doesn't allow Graph API Explorer to be embedded directly on other sites (it blocks that for login security), so this opens it in a new tab with the query already typed in — you just need to pick your Page and hit Submit.</p>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setWizardStep(1)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">← Back</button>
                  <button type="button" onClick={() => setWizardStep(3)} className="px-5 py-2 rounded-lg text-white font-semibold text-sm" style={GLOSS_BLACK}>I ran it, continue →</button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Paste what Graph API Explorer returned</h3>
                <p className="text-xs text-gray-500 mb-3">It looked like <code className="bg-gray-100 px-1 rounded">{'{"id":"...","name":"..."}'}</code> — copy the id below. The Access Token field is optional here (needed only for posting, not just verifying).</p>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Page ID</label>
                <input
                  type="text"
                  value={pageIdInput}
                  onChange={(e) => setPageIdInput(e.target.value)}
                  placeholder="e.g. 1236054879593306"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-sm mb-3"
                  autoFocus
                />
                <label className="block text-xs font-semibold text-gray-700 mb-1">Page Access Token (optional — needed to post)</label>
                <input
                  type="password"
                  value={pageTokenInput}
                  onChange={(e) => setPageTokenInput(e.target.value)}
                  placeholder="Paste from the Access Token field in Explorer"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-sm mb-4"
                  autoComplete="new-password"
                />
                <div className="flex justify-between">
                  <button type="button" onClick={() => setWizardStep(2)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">← Back</button>
                  <button
                    type="button"
                    disabled={!pageIdInput.trim()}
                    onClick={() => setWizardStep(4)}
                    className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    style={GLOSS_BLACK}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Review & connect</h3>
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 mb-4">
                  <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-500">Page name</span><span className="font-semibold text-gray-900">{pageNameInput || '—'}</span></div>
                  <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-500">Page ID</span><span className="font-semibold text-gray-900 font-mono">{pageIdInput || '—'}</span></div>
                  <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-500">Access Token</span><span className="font-semibold text-gray-900">{pageTokenInput ? '•••• (will be saved)' : "Not provided — connect only, can't post yet"}</span></div>
                </div>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setWizardStep(3)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">← Back</button>
                  <button
                    type="button"
                    disabled={wizardSaving}
                    onClick={handleWizardSave}
                    className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#1877f2,#0f5fc8)' }}
                  >
                    {wizardSaving ? 'Saving…' : '✓ Save & Connect'}
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>

        {/* ── Instagram wizard — reuses the Facebook Page picked above ── */}
        <div className="rounded-2xl shadow-[0_12px_40px_-14px_rgba(0,0,0,0.22)] border border-gray-100 overflow-hidden">
          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg,#3a1930,#1a0a15)' }} className="px-5 py-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              {IG_WIZARD_STEPS.map((s, i) => {
                const st = igWizardStepState(i);
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-extrabold"
                        style={{
                          width: 20, height: 20,
                          background: st === 'done' ? '#4ade80' : st === 'current' ? '#ffffff' : 'rgba(255,255,255,0.12)',
                          color: st === 'pending' ? '#d4a5c8' : '#0a0a0a',
                        }}
                      >
                        {st === 'done' ? '✓' : i + 1}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: st === 'pending' ? '#d4a5c8' : '#ffffff' }}>{s.label}</span>
                    </div>
                    {i < IG_WIZARD_STEPS.length - 1 && <span style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.22)' }} />}
                  </React.Fragment>
                );
              })}
              <span className="ml-auto text-xs font-semibold" style={{ color: '#f0abfc' }}>📷 Instagram</span>
            </div>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.1)' }}>
            <div style={{ height: 3, width: `${(igWizardStep / IG_WIZARD_STEPS.length) * 100}%`, background: 'linear-gradient(90deg,#e1306c,#f0abfc)', transition: 'width 300ms ease' }} />
          </div>

          <div className="bg-white p-7">
            {igConnected ? (
              <div className="text-center py-2">
                <div className="cf-boom-stage cf-boom-ig">
                  <div className="cf-boom-ring" />
                  {[...Array(10)].map((_, i) => (
                    <span key={i} className="cf-boom-spoke" style={{ transform: `rotate(${i * 36}deg)` }}>
                      <span className="cf-boom-dot" style={{ animationDelay: `${i * 18}ms` }} />
                    </span>
                  ))}
                  <div className="cf-boom-check">✓</div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>🎉 Connected!</h3>
                <p className="text-sm text-gray-600 mt-1 mb-5">You can now post to <strong>{igUsernameInput ? '@' + igUsernameInput : 'Instagram'}</strong> from Broadcast.</p>
                <button type="button" onClick={() => setIgConnected(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline">Edit connection</button>
              </div>
            ) : (
            <>
            {igWizardError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{igWizardError}</div>
            )}

            {igWizardStep === 1 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>What's your Instagram account called?</h3>
                <p className="text-xs text-gray-500 mb-3">The exact @username as it appears on Instagram — e.g. "calendarfly_temple". It has to be a Business account already linked to the Facebook Page above.</p>
                <input
                  type="text"
                  value={igUsernameInput}
                  onChange={(e) => setIgUsernameInput(e.target.value)}
                  placeholder="e.g. calendarfly_temple"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-sm mb-4"
                  autoFocus
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!igUsernameInput.trim()}
                    onClick={() => setIgWizardStep(2)}
                    className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg,#e1306c,#833ab4)' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {igWizardStep === 2 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Get your Instagram ID from the same Page</h3>
                <p className="text-xs text-gray-500 mb-3">Instagram Business accounts are always attached to a Facebook Page — you're looking this up on the same Page you already selected for Facebook above.</p>
                <ol className="text-sm text-gray-600 space-y-1.5 mb-4 list-decimal list-inside">
                  <li>Open Graph API Explorer (button below — the query's already filled in)</li>
                  <li>Make sure "User or Page" shows your Page (e.g. {pageNameInput || organization?.social_accounts?.facebook?.page_name || 'CalendarFly'}), then click Submit</li>
                </ol>
                <div className="flex items-center gap-2 mb-4">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-xs font-mono text-gray-800 break-all">{IG_GRAPH_QUERY}</code>
                  <button
                    type="button"
                    onClick={copyIgGraphQuery}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:border-gray-400 flex items-center gap-1.5 text-xs font-semibold flex-shrink-0"
                  >
                    {copiedIgQuery ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedIgQuery ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <a
                  href={`https://developers.facebook.com/tools/explorer/?method=GET&path=${encodeURIComponent(IG_GRAPH_QUERY)}&version=v26.0`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white font-semibold text-sm mb-1"
                  style={{ background: 'linear-gradient(135deg,#e1306c,#833ab4)' }}
                >
                  Open Graph API Explorer (query pre-filled) <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <p className="text-xs text-gray-400 mb-1 mt-1">Meta doesn't allow Graph API Explorer to be embedded directly on other sites (it blocks that for login security), so this opens it in a new tab with the query already typed in.</p>
                <p className="text-xs text-gray-400 mb-4">If the result has no <code className="bg-gray-100 px-1 rounded">instagram_business_account</code> field at all, your Page doesn't have an Instagram Business account linked yet — link one from the Instagram app first (Settings → Account type and tools → linked accounts).</p>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setIgWizardStep(1)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">← Back</button>
                  <button type="button" onClick={() => setIgWizardStep(3)} className="px-5 py-2 rounded-lg text-white font-semibold text-sm" style={GLOSS_BLACK}>I ran it, continue →</button>
                </div>
              </div>
            )}

            {igWizardStep === 3 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Paste what Graph API Explorer returned</h3>
                <p className="text-xs text-gray-500 mb-3">It looked like <code className="bg-gray-100 px-1 rounded">{'{"instagram_business_account":{"id":"...","username":"..."}}'}</code> — copy the id below.</p>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Instagram Account ID</label>
                <input
                  type="text"
                  value={igIdInput}
                  onChange={(e) => setIgIdInput(e.target.value)}
                  placeholder="e.g. 17841400000000000"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-sm mb-4"
                  autoFocus
                />
                <div className="flex justify-between">
                  <button type="button" onClick={() => setIgWizardStep(2)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">← Back</button>
                  <button
                    type="button"
                    disabled={!igIdInput.trim()}
                    onClick={() => setIgWizardStep(4)}
                    className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    style={GLOSS_BLACK}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {igWizardStep === 4 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Review & connect</h3>
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 mb-4">
                  <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-500">Username</span><span className="font-semibold text-gray-900">{igUsernameInput || '—'}</span></div>
                  <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-500">Account ID</span><span className="font-semibold text-gray-900 font-mono">{igIdInput || '—'}</span></div>
                </div>
                <p className="text-xs text-gray-400 mb-4">Posting uses the Facebook Page token you already saved above — no separate Instagram token needed.</p>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setIgWizardStep(3)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">← Back</button>
                  <button
                    type="button"
                    disabled={igWizardSaving}
                    onClick={handleIgWizardSave}
                    className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#e1306c,#833ab4)' }}
                  >
                    {igWizardSaving ? 'Saving…' : '✓ Save & Connect'}
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>

        {/* ── Give a teammate access — Meta App is in Development Mode, so only
             people added to its Roles can sign in via Graph API Explorer. ── */}
        <div className="rounded-2xl shadow-[0_12px_40px_-14px_rgba(0,0,0,0.22)] border border-gray-100 overflow-hidden">
          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg,#1c1c1e,#000000)' }} className="px-5 py-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              {TEAM_STEPS.map((s, i) => {
                const st = teamStepState(i);
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-extrabold"
                        style={{
                          width: 20, height: 20,
                          background: st === 'done' ? '#4ade80' : st === 'current' ? '#ffffff' : 'rgba(255,255,255,0.08)',
                          color: st === 'pending' ? '#71717a' : '#0a0a0a',
                        }}
                      >
                        {st === 'done' ? '✓' : i + 1}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: st === 'pending' ? '#71717a' : '#ffffff' }}>{s.label}</span>
                    </div>
                    {i < TEAM_STEPS.length - 1 && <span style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.18)' }} />}
                  </React.Fragment>
                );
              })}
              <span className="ml-auto text-xs font-semibold" style={{ color: '#9ca3af' }}>Add a teammate</span>
            </div>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ height: 3, width: `${(teamDone ? TEAM_STEPS.length : teamStep) / TEAM_STEPS.length * 100}%`, background: 'linear-gradient(90deg,#9ca3af,#e5e7eb)', transition: 'width 300ms ease' }} />
          </div>

          <div className="bg-white p-7">
            {teamDone ? (
              <div className="text-center py-2">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center text-white text-2xl font-extrabold" style={GLOSS_BLACK}>✓</div>
                <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>They're set up</h3>
                <p className="text-sm text-gray-600 mt-1 mb-5">{teammateContact || 'Your teammate'} can now open Graph API Explorer and follow the Facebook and Instagram wizards above themselves.</p>
                <button type="button" onClick={() => { setTeamDone(false); setTeamStep(1); }} className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline">Add someone else</button>
              </div>
            ) : (
            <>
            {teamStep === 1 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Your teammate needs access first</h3>
                <p className="text-xs text-gray-500 mb-3">While your Meta App is in Development Mode, only people added to its Roles can sign in through Graph API Explorer — this is what causes "worked for you, blank for them." Start when they've asked you for access.</p>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Their Facebook name or email (just so you remember who to add)</label>
                <input
                  type="text"
                  value={teammateContact}
                  onChange={(e) => setTeammateContact(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-sm mb-4"
                  autoFocus
                />
                <div className="flex justify-end">
                  <button type="button" onClick={() => setTeamStep(2)} className="px-5 py-2 rounded-lg text-white font-semibold text-sm" style={GLOSS_BLACK}>Next →</button>
                </div>
              </div>
            )}

            {teamStep === 2 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Add them in App Roles</h3>
                <ol className="text-sm text-gray-600 space-y-1.5 mb-4 list-decimal list-inside">
                  <li>Go to <strong>developers.facebook.com</strong> → your app → <strong>App roles → Roles</strong> in the left sidebar<span className="block text-xs text-gray-400 ml-5">Not "Users" — that's for a different, reviewed-app flow.</span></li>
                  <li>Click <strong>Add people</strong></li>
                  <li>Choose <strong>Developer</strong> or <strong>Tester</strong>{teammateContact ? <> and enter <strong>{teammateContact}</strong></> : ' and enter their Facebook account'}</li>
                </ol>
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white font-semibold text-sm mb-4"
                  style={GLOSS_BLACK}
                >
                  Open Meta App Dashboard <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <p className="text-xs text-gray-400 mb-4">Tester is enough for Graph Explorer + connecting a Page; pick Developer only if they'll edit app settings too.</p>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setTeamStep(1)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">← Back</button>
                  <button type="button" onClick={() => setTeamStep(3)} className="px-5 py-2 rounded-lg text-white font-semibold text-sm" style={GLOSS_BLACK}>I added them, continue →</button>
                </div>
              </div>
            )}

            {teamStep === 3 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>They accept the invite</h3>
                <p className="text-sm text-gray-600 mb-4">Facebook sends {teammateContact || 'them'} a notification to accept the Role — nothing works for {teammateContact ? 'them' : 'them'} until they click Accept. If they don't see it right away, they can check it directly at <code className="bg-gray-100 px-1 rounded text-xs">facebook.com/notifications</code>.</p>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setTeamStep(2)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">← Back</button>
                  <button type="button" onClick={() => setTeamStep(4)} className="px-5 py-2 rounded-lg text-white font-semibold text-sm" style={GLOSS_BLACK}>They accepted, continue →</button>
                </div>
              </div>
            )}

            {teamStep === 4 && (
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Two boxes need to be checked</h3>
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 mb-4">
                  <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-500">Added to Meta App Roles</span><span className="font-semibold text-gray-900">Developer or Tester</span></div>
                  <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-500">Admin of the Facebook Page</span><span className="font-semibold text-gray-900">Separate — check this too</span></div>
                </div>
                <p className="text-xs text-gray-400 mb-4">Both are required — being in App Roles alone doesn't grant Page access, and being a Page admin alone doesn't let them use Graph Explorer while the app is in Development Mode.</p>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setTeamStep(3)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">← Back</button>
                  <button type="button" onClick={() => setTeamDone(true)} className="px-5 py-2 rounded-lg text-white font-semibold text-sm" style={GLOSS_BLACK}>✓ Confirm &amp; done</button>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
