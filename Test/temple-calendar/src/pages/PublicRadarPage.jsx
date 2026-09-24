/**
 * src/pages/PublicRadarPage.jsx
 * Route: /explore (public, no org subdomain needed)
 *
 * Community Radar — the cross-org discovery feed. Unlike every other public
 * page in this app (PublicCalendar, PublicAlbumPage, PublicPhotosPage), this
 * one is NOT scoped to a single org: it reads from GET /api/radar, which
 * only ever returns events an admin explicitly opted into Radar via the
 * new Discoverability setting on AddEventModal/EditEventModal. An org that
 * never touches that setting is invisible here, exactly as before this
 * page existed.
 *
 * Ranking is deliberately simple for now (soonest date first, optional
 * category filter) -- see server/routes/radar.js's header comment for why.
 *
 * Phase 1 of the "Community Passport" personalization plan (see
 * server/identity-auth.js): an optional, email-verified cross-org
 * identity that remembers the orgs you follow and a handful of interest
 * tags, and greets you with them on return visits. Skippable entirely --
 * the anonymous feed below still works exactly as before for anyone who
 * doesn't verify. Using followed orgs/interests to actually re-rank the
 * feed is a later phase; today they're just remembered and shown.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, ArrowRight, Sparkles, Check } from 'lucide-react';
import PublicPageBackdrop from '../components/PublicPageBackdrop';

const CATEGORY_LABELS = {
  temple: 'Temple', gurudwara: 'Gurudwara', mosque: 'Mosque', church: 'Church',
  cultural_association: 'Cultural Association', community_center: 'Community Center',
};

const INTEREST_LABELS = {
  'music': '🎵 Music', 'dance': '💃 Dance', 'yoga': '🧘 Yoga', 'kids-family': '👨‍👩‍👧 Kids & family',
  'food': '🍽️ Food', 'volunteering': '🤝 Volunteering', 'spiritual': '🕉️ Spiritual',
  'youth': '🧑‍🎓 Youth', 'seniors': '👵 Seniors', 'arts-culture': '🎨 Arts & culture',
  'sports': '🏸 Sports', 'language': '🗣️ Language',
};

const IDENTITY_TOKEN_KEY = 'cf_identity_token';
function getIdentityToken() { try { return localStorage.getItem(IDENTITY_TOKEN_KEY); } catch { return null; } }
function setIdentityToken(t) { try { localStorage.setItem(IDENTITY_TOKEN_KEY, t); } catch {} }
function clearIdentityToken() { try { localStorage.removeItem(IDENTITY_TOKEN_KEY); } catch {} }

async function identityFetch(path, { token, ...opts } = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function categoryLabel(cat) {
  if (!cat) return null;
  return CATEGORY_LABELS[cat] || cat.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function orgInitial(org) {
  return (org.name || '?').trim().charAt(0).toUpperCase();
}

// ── Passport: onboarding (email -> code), interests picker, and the
// verified-identity card itself. All three live in one file since none of
// them are needed anywhere else in the app yet. ──────────────────────────

function PassportOnboarding({ onVerified }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const input = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: '#ffffff', border: '1px solid #e8d5a3', borderRadius: 10,
    color: '#3d2008', fontSize: '0.95rem', outline: 'none',
  };
  const button = (disabled) => ({
    padding: '12px 20px',
    background: disabled ? '#e8d5a3' : '#3d2008',
    border: 'none', color: 'white', borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem',
  });

  const requestCode = async () => {
    if (!email.trim()) return setError('Enter your email address.');
    setError(''); setBusy(true);
    try {
      await identityFetch('/api/identity/request-code', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) return setError('Enter the code we emailed you.');
    setError(''); setBusy(true);
    try {
      const data = await identityFetch('/api/identity/verify-code', { method: 'POST', body: JSON.stringify({ email: email.trim(), code: code.trim() }) });
      setIdentityToken(data.token);
      onVerified(data.identity);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={passportCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={18} color="#3d2008" />
        <div style={{ fontWeight: 800, color: '#3d2008', fontSize: '1.05rem' }}>Save your spot</div>
      </div>
      <p style={{ color: '#7a3b00', fontSize: '0.88rem', margin: '0 0 14px', lineHeight: 1.5 }}>
        A quick email check-in unlocks personalized picks and lets you follow your favorite organizations. Browsing without one still works.
      </p>
      {step === 'email' ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, flex: 1, minWidth: 200 }} onKeyDown={(e) => e.key === 'Enter' && requestCode()} />
          <button onClick={requestCode} disabled={busy} style={button(busy)}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...input, width: 140, letterSpacing: '0.2em', textAlign: 'center' }} onKeyDown={(e) => e.key === 'Enter' && verifyCode()} />
          <button onClick={verifyCode} disabled={busy} style={button(busy)}>{busy ? 'Verifying…' : 'Verify'}</button>
          <span style={{ fontSize: '0.78rem', color: '#9a7a55' }}>Code sent to {email}</span>
        </div>
      )}
      {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#b91c1c', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}

function InterestsPicker({ initial, onSave, onSkip, busy }) {
  const [selected, setSelected] = useState(new Set(initial || []));
  const toggle = (key) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div style={passportCardStyle}>
      <div style={{ fontWeight: 800, color: '#3d2008', fontSize: '1.05rem', marginBottom: 4 }}>What are you into?</div>
      <p style={{ color: '#7a3b00', fontSize: '0.86rem', margin: '0 0 14px' }}>Pick a few -- used privately to improve what you see here, never shown to anyone else.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {Object.entries(INTEREST_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => toggle(key)} style={interestPillStyle(selected.has(key))}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => onSave([...selected])} disabled={busy} style={{ padding: '10px 18px', background: '#3d2008', border: 'none', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: '0.86rem', cursor: busy ? 'default' : 'pointer' }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {onSkip && <button onClick={onSkip} style={{ padding: '10px 18px', background: 'none', border: 'none', color: '#9a7a55', fontSize: '0.86rem', cursor: 'pointer' }}>Skip for now</button>}
      </div>
    </div>
  );
}

function PassportCard({ identity, onEditInterests, onToggleFollow, followBusy }) {
  // Only ever personalize with a name the person actually gave us
  // (identity.display_name) -- never a name guessed from their email
  // address. No display name on file means a generic greeting, not a
  // fabricated one.
  const greetingName = identity.display_name || null;
  const avatarLetter = (identity.display_name || identity.email || '?').trim().charAt(0).toUpperCase();
  return (
    <div style={passportCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(160deg,#ea580c,#92400e)', color: '#fff', fontWeight: 800, fontSize: '1.2rem',
          fontFamily: "'Playfair Display', Georgia, serif",
        }}>
          {avatarLetter}
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#9a7a55' }}>{greetingName ? `Welcome back, ${greetingName}` : 'Welcome back'}</div>
          <div style={{ fontWeight: 800, color: '#3d2008', fontSize: '1.3rem', fontFamily: "'Playfair Display', Georgia, serif" }}>
            My CalendarFly
          </div>
          <div style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600, marginTop: 2, letterSpacing: '0.02em' }}>
            Discover. Connect. Participate.
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, letterSpacing: 1, color: '#9a7a55', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
        Organizations you follow
      </div>
      {identity.followed_orgs.length === 0 ? (
        <div style={{ fontSize: '0.86rem', color: '#9a7a55', marginBottom: 16 }}>
          None yet -- follow an org from its calendar page (or from a card below) and it'll show up here.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
          {identity.followed_orgs.map((org) => (
            <div key={org.org_id} style={followedOrgCardStyle}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: org.logo_url ? `center/cover no-repeat url(${org.logo_url})` : `linear-gradient(160deg, ${org.primary_color || '#ea580c'}, #92400e)`,
              }}>
                {!org.logo_url && <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{orgInitial(org)}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3d2008', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</div>
                <button
                  onClick={() => onToggleFollow(org, false)}
                  disabled={followBusy === org.org_id}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#2f6b3a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {followBusy === org.org_id ? 'Updating…' : '✓ Following'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, color: '#9a7a55', fontWeight: 700, textTransform: 'uppercase' }}>Your interests</div>
        <button onClick={onEditInterests} style={{ background: 'none', border: 'none', color: '#c2410c', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Edit</button>
      </div>
      {identity.interests.length === 0 ? (
        <div style={{ fontSize: '0.86rem', color: '#9a7a55' }}>None set yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {identity.interests.map((key) => (
            <span key={key} style={{ fontSize: 12, fontWeight: 700, color: '#7a3b00', background: '#fdf1d9', border: '1px solid #e8d5a3', borderRadius: 999, padding: '4px 10px' }}>
              {INTEREST_LABELS[key] || key}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── "Recommended near you" -- geolocation (or a typed city/ZIP) + the new
// GET /api/discover/nearby, ranked by distance and, once an identity has
// interests set, a weak category-based interest match. Works with no
// identity at all -- distance alone still ranks something useful. ────────

function NearbyOrgs({
  orgs, loading, error, locationStatus, manualAddress, setManualAddress,
  onManualSearch, identity, followBusy, onToggleFollow,
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'inline-block', background: '#faeeda', padding: '8px 18px', borderRadius: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.6rem', fontWeight: 800, color: '#3d2008' }}>
          📍 Recommended near you
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          type="text"
          placeholder={locationStatus === 'granted' ? 'Or search a different city/ZIP' : 'Enter your city or ZIP'}
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onManualSearch()}
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e8d5a3', borderRadius: 10, color: '#3d2008', fontSize: '0.88rem', outline: 'none' }}
        />
        <button
          onClick={onManualSearch}
          style={{ padding: '10px 18px', background: '#3d2008', border: 'none', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Find nearby
        </button>
      </div>

      {locationStatus === 'locating' && <div style={emptyMiniStyle}>Finding organizations near you…</div>}
      {loading && <div style={emptyMiniStyle}>Loading nearby organizations…</div>}
      {error && <div style={emptyMiniStyle}>{error}</div>}
      {!loading && !error && locationStatus !== 'locating' && orgs.length === 0 && (
        <div style={emptyMiniStyle}>No organizations found within 15 miles yet. Try a nearby city.</div>
      )}

      {orgs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {orgs.map((org) => {
            const following = !!(identity && identity.followed_orgs.some((o) => o.org_id === org.org_id));
            return (
              <div key={org.org_id} style={nearbyCardStyle}>
                <a href={`/calendar?org=${encodeURIComponent(org.subdomain)}`} style={{ textDecoration: 'none', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: org.logo_url ? `center/cover no-repeat url(${org.logo_url})` : `linear-gradient(160deg, ${org.primary_color || '#ea580c'}, #92400e)`,
                  }}>
                    {!org.logo_url && <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{orgInitial(org)}</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#3d2008', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</div>
                    <div style={{ fontSize: 11, color: '#9a7a55' }}>
                      {org.distance_miles} mi away{org.category ? ` · ${categoryLabel(org.category)}` : ''}
                    </div>
                  </div>
                </a>
                {org.upcoming_events.length > 0 && (
                  <div style={{ fontSize: 11.5, color: '#7a3b00', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Next: {org.upcoming_events[0].title} · {formatDate(org.upcoming_events[0].date)}
                  </div>
                )}
                {identity && (
                  <button
                    onClick={() => onToggleFollow(org, !following)}
                    disabled={followBusy === org.org_id}
                    style={{
                      border: following ? '1px solid #2f6b3a' : '1px solid #b45309',
                      background: 'none', color: following ? '#2f6b3a' : '#92400e',
                      fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 999,
                      cursor: followBusy === org.org_id ? 'default' : 'pointer',
                    }}
                  >
                    {followBusy === org.org_id ? 'Updating…' : following ? '✓ Following' : '+ Follow'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickInterestBar({ selected, onToggle, busy }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'inline-block', background: '#faeeda', padding: '8px 18px', borderRadius: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.6rem', fontWeight: 800, color: '#3d2008' }}>
          Your interests{busy ? ' · saving…' : ''}
        </span>
      </div>
      <p style={{ color: '#9a7a55', fontSize: '0.82rem', margin: '0 0 10px' }}>
        Tune these any time -- they sharpen what shows up above.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(INTEREST_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => onToggle(key)} disabled={busy} style={interestPillStyle(selected.has(key))}>{label}</button>
        ))}
      </div>
    </div>
  );
}

export default function PublicRadarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Passport state -- entirely independent of the anonymous event feed
  // above/below it, so a failure here never blocks browsing.
  const [identityToken, setIdentityTokenState] = useState(getIdentityToken());
  const [identity, setIdentity] = useState(null);
  const [identityLoading, setIdentityLoading] = useState(!!identityToken);
  const [editingInterests, setEditingInterests] = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);
  const [followBusy, setFollowBusy] = useState(null);

  // "Recommended near you" -- independent of the passport above; distance-
  // based recommendations work with no identity at all.
  const [coords, setCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState('locating'); // locating|granted|denied
  const [manualAddress, setManualAddress] = useState('');
  const [nearbyOrgs, setNearbyOrgs] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/radar')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Could not load Explore.');
        return data;
      })
      .then((data) => { if (!cancelled) setEvents(data.events || []); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!identityToken) { setIdentityLoading(false); return; }
    let cancelled = false;
    identityFetch('/api/identity/me', { token: identityToken })
      .then((data) => { if (!cancelled) setIdentity(data); })
      .catch(() => { if (!cancelled) { clearIdentityToken(); setIdentityTokenState(null); } })
      .finally(() => { if (!cancelled) setIdentityLoading(false); });
    return () => { cancelled = true; };
  }, [identityToken]);

  useEffect(() => {
    if (!('geolocation' in navigator)) { setLocationStatus('denied'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationStatus('granted'); },
      () => setLocationStatus('denied'),
      { timeout: 8000 },
    );
  }, []);

  const fetchNearby = async (params) => {
    setNearbyLoading(true);
    setNearbyError('');
    try {
      const qs = new URLSearchParams({
        radius: '15',
        ...(identity && identity.interests.length ? { interests: identity.interests.join(',') } : {}),
        ...params,
      });
      const res = await fetch(`/api/discover/nearby?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load nearby organizations.');
      setNearbyOrgs(data.orgs || []);
    } catch (err) {
      setNearbyError(err.message);
    } finally {
      setNearbyLoading(false);
    }
  };

  const interestsKey = identity ? identity.interests.join(',') : '';
  useEffect(() => {
    if (coords) fetchNearby({ lat: coords.lat, lng: coords.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, interestsKey]);

  const searchManualAddress = () => {
    if (!manualAddress.trim()) return;
    fetchNearby({ address: manualAddress.trim() });
  };

  const toggleInterest = (key) => {
    if (!identity) return;
    const has = identity.interests.includes(key);
    const next = has ? identity.interests.filter((k) => k !== key) : [...identity.interests, key];
    saveInterests(next);
  };

  const saveInterests = async (interests) => {
    setSavingInterests(true);
    try {
      const data = await identityFetch('/api/identity/me', { token: identityToken, method: 'PATCH', body: JSON.stringify({ interests }) });
      setIdentity((prev) => ({ ...prev, interests: data.interests }));
      setEditingInterests(false);
    } catch {
      // Best-effort -- leave the picker open so they can retry.
    } finally {
      setSavingInterests(false);
    }
  };

  const toggleFollow = async (org, follow) => {
    const org_id = org.org_id;
    setFollowBusy(org_id);
    try {
      await identityFetch(`/api/identity/${follow ? 'follow' : 'unfollow'}/${org_id}`, { token: identityToken, method: 'POST' });
      setIdentity((prev) => ({
        ...prev,
        followed_orgs: follow
          ? [...prev.followed_orgs.filter((o) => o.org_id !== org_id), {
              org_id, name: org.name, subdomain: org.subdomain,
              category: org.category, logo_url: org.logo_url, primary_color: org.primary_color,
            }]
          : prev.followed_orgs.filter((o) => o.org_id !== org_id),
      }));
    } catch {
      // Best-effort -- UI just doesn't update on failure, no crash.
    } finally {
      setFollowBusy(null);
    }
  };

  const categories = useMemo(() => {
    const seen = new Map();
    for (const e of events) {
      if (e.org?.category) seen.set(e.org.category, (seen.get(e.org.category) || 0) + 1);
    }
    return Array.from(seen.entries()).sort((a, b) => b[1] - a[1]).map(([key]) => key);
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (activeCategory === 'all') return events;
    return events.filter((e) => e.org?.category === activeCategory);
  }, [events, activeCategory]);

  const isFirstTimeIdentity = identity && identity.interests.length === 0 && !identity.display_name;

  return (
    <div style={{ minHeight: '100vh', position: 'relative', fontFamily: "'DM Sans', sans-serif" }}>
      <PublicPageBackdrop />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto', padding: '40px 24px 72px' }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: '#9a7a55', fontWeight: 700, marginBottom: 8 }}>DISCOVER</div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#3d2008', fontSize: '1.9rem', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>
            Never miss what's happening nearby.
          </h1>
          <p style={{ color: '#92400e', fontSize: '0.92rem', margin: 0, maxWidth: 520, lineHeight: 1.5 }}>
            One place for every community event around you &mdash; temples, cultural centers, and local nonprofits.
          </p>
        </div>

        {/* ── Community Passport -- onboarding, interests, or the full card,
             depending on where this visitor is in the flow. ── */}
        {!identityToken && <PassportOnboarding onVerified={(newIdentity) => { setIdentityTokenState(getIdentityToken()); setIdentity(newIdentity); }} />}
        {identityToken && identityLoading && (
          <div style={{ ...passportCardStyle, color: '#9a7a55', fontSize: '0.88rem' }}>Loading your passport…</div>
        )}
        {identityToken && !identityLoading && identity && (isFirstTimeIdentity || editingInterests) && (
          <InterestsPicker
            initial={identity.interests}
            busy={savingInterests}
            onSave={saveInterests}
            onSkip={isFirstTimeIdentity ? () => setIdentity((prev) => ({ ...prev, interests: [] })) : undefined}
          />
        )}
        {identityToken && !identityLoading && identity && !isFirstTimeIdentity && !editingInterests && (
          <PassportCard
            identity={identity}
            onEditInterests={() => setEditingInterests(true)}
            onToggleFollow={toggleFollow}
            followBusy={followBusy}
          />
        )}

        <NearbyOrgs
          orgs={nearbyOrgs}
          loading={nearbyLoading}
          error={nearbyError}
          locationStatus={locationStatus}
          manualAddress={manualAddress}
          setManualAddress={setManualAddress}
          onManualSearch={searchManualAddress}
          identity={identity}
          followBusy={followBusy}
          onToggleFollow={toggleFollow}
        />

        {identityToken && !identityLoading && identity && (
          <QuickInterestBar
            selected={new Set(identity.interests)}
            onToggle={toggleInterest}
            busy={savingInterests}
          />
        )}

        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={pillStyle(activeCategory === 'all')}
            >
              All
            </button>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={pillStyle(activeCategory === cat)}>
                {categoryLabel(cat)}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={emptyState}>Loading events…</div>
        ) : error ? (
          <div style={emptyState}>{error}</div>
        ) : visibleEvents.length === 0 ? (
          <div style={emptyState}>No upcoming events here yet. Check back soon.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visibleEvents.map((event) => (
              <a
                key={event.event_id}
                href={`/calendar?org=${encodeURIComponent(event.org.subdomain)}`}
                style={cardStyle}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
                  background: event.image_url ? `center/cover no-repeat url(${event.image_url})` : `linear-gradient(160deg, ${event.org.primary_color || '#ea580c'}, #92400e)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!event.image_url && (
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>
                      {(event.org.name || '?').trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#2f6b3a', marginBottom: 2 }}>
                    {event.org.name}
                    {event.org.category && <span style={{ color: '#9a7a55', fontWeight: 600 }}> &middot; {categoryLabel(event.org.category)}</span>}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3d2008', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 11.5, color: '#9a7a55' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} /> {formatDate(event.date)}{event.time ? ` · ${event.time}` : ''}
                    </span>
                    {event.location && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <MapPin size={12} /> {event.location}
                      </span>
                    )}
                  </div>
                </div>

                <ArrowRight size={16} color="#c9b98e" style={{ flexShrink: 0 }} />
              </a>
            ))}
          </div>
        )}

        <div style={{ marginTop: 40, padding: '22px 24px', borderRadius: 14, background: '#fdf1d9', fontSize: '1.15rem', fontWeight: 600, color: '#7a3b00', lineHeight: 1.5 }}>
          Run an organization on CalendarFly? Turn on <b>Show on Explore</b> when creating or editing an event to be listed here.
        </div>
      </div>
    </div>
  );
}

function pillStyle(active) {
  return {
    border: active ? 'none' : '1px solid #e8d5a3',
    background: active ? '#3d2008' : '#ffffff',
    color: active ? '#fff' : '#7a3b00',
    fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999,
    cursor: 'pointer', fontFamily: 'inherit',
  };
}

function interestPillStyle(active) {
  return {
    border: active ? 'none' : '1px solid #e8d5a3',
    background: active ? '#3d2008' : '#ffffff',
    color: active ? '#fff' : '#7a3b00',
    fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 999,
    cursor: 'pointer', fontFamily: 'inherit',
  };
}

const cardStyle = {
  display: 'flex', alignItems: 'center', gap: 14, padding: 14,
  border: '1px solid #e8d5a3', borderRadius: 14,
  background: '#ffffff',
  textDecoration: 'none', boxShadow: '0 2px 10px rgba(180,120,0,0.06)',
};

const passportCardStyle = {
  background: '#ffffff', border: '1px solid #d4af37', borderRadius: 16,
  padding: '20px 22px', marginBottom: 24, boxShadow: '0 6px 24px rgba(180,120,0,0.10)',
};

const followedOrgCardStyle = {
  display: 'flex', alignItems: 'center', gap: 8, padding: 10,
  background: '#ffffff', border: '1px solid #e8d5a3', borderRadius: 12,
};

const emptyMiniStyle = {
  background: '#ffffff', border: '1px solid #d4af37', borderRadius: 14,
  padding: '18px 16px', textAlign: 'center', color: '#92400e', fontSize: '0.88rem',
  boxShadow: '0 4px 20px rgba(180,120,0,0.08)',
};

const nearbyCardStyle = {
  padding: 12, border: '1px solid #e8d5a3', borderRadius: 14,
  background: '#ffffff',
  boxShadow: '0 2px 10px rgba(180,120,0,0.06)',
};

const emptyState = {
  background: '#ffffff', border: '1px solid #d4af37', borderRadius: 14,
  padding: '40px 16px', textAlign: 'center', color: '#92400e', fontSize: '0.92rem',
  fontFamily: "'DM Sans', sans-serif",
  boxShadow: '0 4px 20px rgba(180,120,0,0.08)',
};
