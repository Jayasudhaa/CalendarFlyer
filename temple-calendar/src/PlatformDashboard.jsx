/**
 * PlatformDashboard.jsx
 * Owner-only view of who's using CalendarFly and how — total orgs/users/
 * events, signups and event activity over time, and a per-org breakdown.
 *
 * Gated by the ADMIN_SECRET admin code (same one used to unlock a locked
 * Organization Type in Settings). The code is kept in memory only for this
 * page load — it is never stored in localStorage or baked into the bundle,
 * so nothing is visible in the shipped JS the way some of the older
 * admin-secret usages in this app are.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Building2, CalendarDays, RefreshCw, Lock, Sparkles, ImagePlus, ShieldCheck } from 'lucide-react';
import AISettingsPanel from './components/AISettingsPanel';
import StockLibraryGenerator from './components/StockLibraryGenerator';
import UsersAccessPanel from './components/UsersAccessPanel';
import AdminToolbar from './components/AdminToolbar';
import { ORG_CATEGORY_LABELS } from './utils/organizationCategories';

// Same flat page background used across every other admin page (Broadcast,
// Analytics, Sign-Ups, Settings) instead of this page having its own look.
const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

const CATEGORY_LABELS = {
  ...ORG_CATEGORY_LABELS,
  'not set': 'Not set',
};

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatCard({ icon: Icon, label, value, sublabel }) {
  return (
    <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--cf-bg-deep)', border: '1px solid var(--cf-border)', color: 'var(--cf-accent)',
        }}>
          <Icon size={19} />
        </div>
        <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--cf-text-secondary)', margin: 0 }}>{label}</p>
      </div>
      <p style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--cf-text-primary)', margin: 0, lineHeight: 1 }}>{value}</p>
      {sublabel && <p style={{ fontSize: '0.84rem', color: 'var(--cf-text-muted)', marginTop: 6, marginBottom: 0 }}>{sublabel}</p>}
    </div>
  );
}

export default function PlatformDashboard() {
  const navigate = useNavigate();
  const [adminCode, setAdminCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview'); // 'overview' | 'users' | 'ai-settings' | 'library'

  const loadStats = async ({ secret, token, silent } = {}) => {
    setLoading(true);
    if (!silent) setError('');
    try {
      const res = await fetch('/api/admin/stats', {
        headers: secret ? { 'x-admin-secret': secret } : { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        if (!silent) setError('Invalid admin code');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setStats(data);
      setUnlocked(true);
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  // Auto-unlock for an account already granted platform access through its
  // own regular login (see PLATFORM_ADMIN_EMAILS in server/routes/admin.js's
  // superAdminGuard) -- skips the manual admin-code prompt below entirely
  // for that one account. Silent on failure: every other org's staff just
  // sees the normal code-entry gate, with no error flashed for a check they
  // were never meant to pass.
  useEffect(() => {
    const token = localStorage.getItem('cf_token');
    if (token) loadStats({ token, silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (!adminCode) return;
    loadStats({ secret: adminCode });
  };

  // Refresh button reuses whichever path actually unlocked the page --
  // the account's own login token if that's what got in, otherwise the
  // admin code that was typed in.
  const refreshStats = () => {
    const token = localStorage.getItem('cf_token');
    if (!adminCode && token) loadStats({ token });
    else loadStats({ secret: adminCode });
  };

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', ...HALO_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--cf-bg-deep)', border: '1px solid var(--cf-border)', color: 'var(--cf-accent)',
            }}>
              <Lock size={18} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--cf-text-primary)', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Platform Overview</h1>
              <p style={{ fontSize: '0.76rem', color: 'var(--cf-text-muted)', margin: 0 }}>Owner-only — enter your admin code</p>
            </div>
          </div>
          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="password"
              autoFocus
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="Admin code"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 8,
                border: '1px solid var(--cf-border)', background: 'var(--cf-bg-base)', color: 'var(--cf-text-primary)',
                fontSize: '0.9rem',
              }}
            />
            {error && <p style={{ fontSize: '0.82rem', color: '#dc2626', margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 8, border: 'none',
                background: 'var(--cf-btn-bg)', color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Checking…' : 'View Stats'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabBtn = (key, label, Icon) => (
    <button
      onClick={() => setTab(key)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '12px 16px', fontSize: '0.95rem', fontWeight: 800,
        background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--cf-accent)' : '2px solid transparent',
        color: tab === key ? 'var(--cf-accent)' : 'var(--cf-text-muted)', cursor: 'pointer',
      }}
    >
      {Icon && <Icon size={16} />} {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', ...HALO_BG }}>
      <style>{`@keyframes pdSpin { to { transform: rotate(360deg); } } .pd-spin { animation: pdSpin 0.8s linear infinite; }`}</style>
      <AdminToolbar activePage="platform" />
      <div style={{ padding: 20 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => navigate('/admin')}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: '1px solid var(--cf-border)',
                  background: 'var(--cf-bg-surface)', color: 'var(--cf-text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <ArrowLeft size={17} />
              </button>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--cf-text-primary)', fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Platform Overview
                </div>
                <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.98rem', marginTop: 4 }}>
                  Who's using CalendarFly, and how
                </div>
              </div>
            </div>
            {tab === 'overview' && (
              <button
                onClick={refreshStats}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8,
                  border: '1px solid var(--cf-border)', background: 'var(--cf-bg-surface)', color: 'var(--cf-text-secondary)',
                  fontWeight: 800, fontSize: '0.92rem', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
                }}
              >
                <RefreshCw size={15} className={loading ? 'pd-spin' : ''} />
                Refresh
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--cf-border)', marginBottom: 20, flexWrap: 'wrap' }}>
            {tabBtn('overview', '📊 Overview')}
            {tabBtn('users', 'Users & Access', ShieldCheck)}
            {tabBtn('ai-settings', 'AI Image Settings', Sparkles)}
            {tabBtn('library', 'Stock Library', ImagePlus)}
          </div>

          {tab === 'users' && (
            <UsersAccessPanel adminCode={adminCode} organizations={stats?.organizations || []} />
          )}

          {tab === 'ai-settings' && (
            <AISettingsPanel adminCode={adminCode} />
          )}

          {tab === 'library' && (
            <StockLibraryGenerator adminCode={adminCode} />
          )}

          {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>
            )}

            {stats && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <StatCard icon={Building2} label="Organizations" value={stats.totals.organizations}
                    sublabel={`${stats.signups_last_7_days} new in last 7 days · ${stats.signups_last_30_days} in last 30`} />
                  <StatCard icon={Users} label="Users" value={stats.totals.users}
                    sublabel="Across all organizations" />
                  <StatCard icon={CalendarDays} label="Events" value={stats.totals.events}
                    sublabel={`${stats.events_created_last_7_days} new in last 7 days · ${stats.events_created_last_30_days} in last 30`} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                  <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                      <span style={{ width: 4, height: 18, borderRadius: 2, background: 'var(--cf-accent)' }} />
                      <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--cf-text-primary)', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Organizations by type</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(stats.organizations_by_category).map(([key, count]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                          <span style={{ color: 'var(--cf-text-secondary)' }}>{CATEGORY_LABELS[key] || key}</span>
                          <span style={{ fontWeight: 800, color: 'var(--cf-text-primary)' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                      <span style={{ width: 4, height: 18, borderRadius: 2, background: 'var(--cf-accent)' }} />
                      <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--cf-text-primary)', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Organizations by plan</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(stats.organizations_by_plan).map(([key, count]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                          <span style={{ color: 'var(--cf-text-secondary)', textTransform: 'capitalize' }}>{key}</span>
                          <span style={{ fontWeight: 800, color: 'var(--cf-text-primary)' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: 18, borderBottom: '1px solid var(--cf-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 4, height: 20, borderRadius: 2, background: 'var(--cf-accent)' }} />
                      <p style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--cf-text-primary)', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>All organizations</p>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--cf-text-muted)', margin: 0, marginTop: 4, marginLeft: 13 }}>Sorted by most recently signed up</p>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.95rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--cf-border)', background: 'var(--cf-bg-deep)' }}>
                          <th style={{ textAlign: 'left', padding: '13px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-accent)' }}>Organization</th>
                          <th style={{ textAlign: 'left', padding: '13px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-accent)' }}>Signup email</th>
                          <th style={{ textAlign: 'left', padding: '13px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-accent)' }}>Type</th>
                          <th style={{ textAlign: 'left', padding: '13px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-accent)' }}>Plan</th>
                          <th style={{ textAlign: 'right', padding: '13px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-accent)' }}>Users</th>
                          <th style={{ textAlign: 'right', padding: '13px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-accent)' }}>Events</th>
                          <th style={{ textAlign: 'left', padding: '13px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-accent)' }}>Signed up</th>
                          <th style={{ textAlign: 'left', padding: '13px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-accent)' }}>Last login</th>
                          <th style={{ textAlign: 'left', padding: '13px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-accent)' }}>Setup</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.organizations.map(org => (
                          <tr key={org.org_id} style={{ borderBottom: '1px solid var(--cf-border)' }}>
                            <td style={{ padding: '15px 18px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--cf-text-primary)' }}>{org.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--cf-text-muted)' }}>{org.subdomain}.calendarflyapp.com</div>
                            </td>
                            <td style={{ padding: '15px 18px', color: 'var(--cf-text-secondary)' }}>{org.signup_email || '—'}</td>
                            <td style={{ padding: '15px 18px', color: 'var(--cf-text-secondary)' }}>{CATEGORY_LABELS[org.category || 'not set'] || org.category}</td>
                            <td style={{ padding: '15px 18px', color: 'var(--cf-text-secondary)', textTransform: 'capitalize' }}>{org.plan}</td>
                            <td style={{ padding: '15px 18px', textAlign: 'right', color: 'var(--cf-text-primary)' }}>{org.users_count}</td>
                            <td style={{ padding: '15px 18px', textAlign: 'right', color: 'var(--cf-text-primary)' }}>{org.events_count}</td>
                            <td style={{ padding: '15px 18px', color: 'var(--cf-text-secondary)' }}>{formatDate(org.created_at)}</td>
                            <td style={{ padding: '15px 18px', color: 'var(--cf-text-secondary)' }}>{formatDate(org.last_login_at)}</td>
                            <td style={{ padding: '15px 18px' }}>
                              {org.onboarding_completed ? (
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#15803d', background: 'rgba(34,197,94,0.12)', padding: '3px 10px', borderRadius: 999 }}>Complete</span>
                              ) : (
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--cf-accent)', background: 'var(--cf-accent-glow)', padding: '3px 10px', borderRadius: 999 }}>In progress</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {stats.organizations.length === 0 && (
                          <tr>
                            <td colSpan={9} style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--cf-text-muted)' }}>No organizations yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
