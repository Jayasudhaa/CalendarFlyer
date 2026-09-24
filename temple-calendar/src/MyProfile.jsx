/**
 * MyProfile - dedicated account page (display name + password + team + platform)
 * Split out of the old catch-all Settings page so "My Profile" in the
 * account menu goes somewhere that's actually about the person, not the org.
 *
 * The Team and Platform tabs used to be their own routed pages
 * (pages/TeamManagementPage.jsx and PlatformDashboard.jsx, reached via
 * /team, /platform, and their own nav button/menu items). Per request they
 * now live here as tabs instead of separate destinations — /team and
 * /platform redirect to /profile?tab=team / ?tab=platform (see App.jsx) so
 * old links/bookmarks still work, and the standalone nav entries were
 * removed from AdminToolbar.jsx. All the logic below (team invite/role/
 * remove, platform stats/admin-code unlock) is carried over unchanged from
 * those pages.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AdminToolbar from './components/AdminToolbar';
import { ArrowLeft, User, Lock, Mail, Shield, Building2, UserCog, Crown, Eye, UserPlus, Trash2, X, Users, CalendarDays, RefreshCw, Sparkles, ImagePlus, ShieldCheck, CreditCard, Check, Loader2, AlertTriangle } from 'lucide-react';
import AISettingsPanel from './components/AISettingsPanel';
import StockLibraryGenerator from './components/StockLibraryGenerator';
import UsersAccessPanel from './components/UsersAccessPanel';

// Was a warm-gold halo background (radial var(--cf-accent-glow) x3) shared
// across every admin page — dropped in favor of a flat pure-white page
// background (var(--cf-bg-base)) as part of the black & white redesign;
// same fix already applied on the admin calendar page (App.jsx) and
// CalendarGrid.jsx's per-cell tint. The buttons/icon badges below now use
// the glossy black accent from the toolbar and flyer editor instead of
// orange/blue, per the approved "Glossy Black Accents" design option.
const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };
const GLOSS_BLACK = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)',
  boxShadow: '0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
};

const ROLE_META = {
  owner:  { label: 'Owner',  icon: Crown, badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  admin:  { label: 'Admin',  icon: Shield, badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  viewer: { label: 'Viewer', icon: Eye,   badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.viewer;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badgeClass}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  );
}

function authHeaders() {
  const token = localStorage.getItem('cf_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ── Subscription tab — carried over unchanged from the old SubscriptionPage.jsx
// (now reached at /profile?tab=subscription instead of its own /subscription
// route — see App.jsx's redirect). All state/handlers below use a `sub`
// prefix to stay clear of this file's own `organization`/`org` naming.
const SUB_PLANS = [
  {
    key: 'free',
    name: 'Organization Free',
    price: '$0',
    limits: { events_per_month: 30, flyers_per_month: 0, rsvp_responses: 50, chatbot_messages: 0, users: 1, storage_gb: 1 },
    features: ['Public organization page & calendar', 'Instagram + Facebook broadcast', 'WhatsApp broadcast (requires a WhatsApp Business number)', 'Event creation — 30 events/month', 'Basic announcements'],
  },
  {
    key: 'starter',
    name: 'Organization Plus',
    price: '$49',
    limits: { events_per_month: 50, flyers_per_month: 20, rsvp_responses: 500, chatbot_messages: 500, users: 3, storage_gb: 5 },
    features: ['Everything in Organization Free', 'AI Flyer Studio — 30 AI image generations/month', 'Flyer templates', 'Scheduled announcements', '50 events/month'],
  },
  {
    key: 'pro',
    name: 'Organization Pro',
    price: '$79',
    popular: true,
    limits: { events_per_month: -1, flyers_per_month: -1, rsvp_responses: -1, chatbot_messages: 2000, users: 10, storage_gb: 20 },
    features: ['Everything in Organization Plus', 'Unlimited events', 'AI-powered analytics', 'AI-powered search and summary — upload files, get summaries & action items', 'Searchable media gallery', 'AI Chatbot (2000 msg/mo)', 'More team & admin tools', 'Priority support', '75 AI image generations/month'],
  },
  {
    key: 'enterprise',
    name: 'Organization Enterprise',
    price: '$149',
    limits: { events_per_month: -1, flyers_per_month: -1, rsvp_responses: -1, chatbot_messages: -1, users: -1, storage_gb: 100 },
    features: ['Everything in Organization Pro', 'WhatsApp broadcast (requires a WhatsApp Business number)', 'Unlimited everything', 'Custom domain', 'AI-powered search and summary — upload files, get summaries & action items', 'Public chatbot for devotees', 'Live photo sharing (public)', 'Public messages (multi-channel)', 'Dedicated support'],
  },
];

function fmtSubLimit(n) {
  return n === -1 ? 'Unlimited' : n;
}

function SubUsageTile({ label, used, limit }) {
  const c = { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', value: 'text-black', bar: 'bg-black' };
  const isUnlimited = limit == null || limit === -1;
  const pct = isUnlimited || !limit ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const atLimit = !isUnlimited && used >= limit;
  const nearLimit = !isUnlimited && !atLimit && pct >= 80;
  const barColor = atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : c.bar;

  return (
    <div className={`p-4 rounded-lg ${c.bg} border ${atLimit ? 'border-red-300' : nearLimit ? 'border-amber-300' : c.border}`}>
      <p className={`text-xs font-semibold ${c.text}`}>{label}</p>
      <p className={`text-xl font-bold ${c.value} mt-1`}>
        {used}
        {!isUnlimited && <span className={`text-base font-bold ${c.text}`}> / {fmtSubLimit(limit)}</span>}
      </p>
      <p className={`text-[11px] font-medium ${c.text} mt-0.5`}>
        {isUnlimited ? 'Unlimited on your plan' : `Plan limit: ${fmtSubLimit(limit)}/mo`}
      </p>
      {!isUnlimited && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/70 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {atLimit && <p className="text-[11px] text-red-600 font-semibold mt-1">Limit reached — upgrade to add more</p>}
    </div>
  );
}

function SubLimitOnlyTile({ label, limit, unit }) {
  const c = { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', value: 'text-black' };
  const isUnlimited = limit == null || limit === -1;
  return (
    <div className={`p-4 rounded-lg ${c.bg} border ${c.border}`}>
      <p className={`text-xs font-semibold ${c.text}`}>{label}</p>
      <p className={`text-xl font-bold ${c.value} mt-1`}>{fmtSubLimit(limit)}{!isUnlimited && unit ? ` ${unit}` : ''}</p>
      <p className={`text-[11px] font-medium ${c.text} mt-0.5`}>Included on your plan</p>
    </div>
  );
}

// ── Platform tab helpers — carried over from the old PlatformDashboard ──
const CATEGORY_LABELS = {
  temple: 'Temple',
  nonprofit: 'Nonprofit',
  community: 'Community Org',
  other: 'Other',
  'not set': 'Not set',
};

function formatPlatformDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function PlatformStatCard({ icon: Icon, label, value, sublabel }) {
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

export default function MyProfile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, organization, canManage, updateProfile, changePassword, setOrganizationData } = useAuth();

  // 'profile' | 'team' | 'platform' | 'subscription' — ?tab=team /
  // ?tab=platform / ?tab=subscription opens straight to that tab (used by
  // the old /team, /platform and /subscription routes' redirects, and the
  // account-menu shortcuts).
  const initialTab = ['team', 'platform', 'subscription'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);
  const selectTab = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'profile' ? {} : { tab }, { replace: true });
  };

  const [displayName, setDisplayName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameError, setNameError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (user) setDisplayName(user.displayName || '');
  }, [user]);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setNameSuccess('');
    setNameError('');
    if (!displayName.trim()) {
      setNameError('Display name cannot be empty');
      return;
    }
    setNameSaving(true);
    const result = await updateProfile({ displayName: displayName.trim() });
    setNameSaving(false);
    if (result.success) {
      setNameSuccess('Profile updated');
      setTimeout(() => setNameSuccess(''), 3000);
    } else {
      setNameError(result.error || 'Failed to update profile');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwSuccess('');
    setPwError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('Fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match');
      return;
    }
    setPwSaving(true);
    const result = await changePassword(currentPassword, newPassword);
    setPwSaving(false);
    if (result.success) {
      setPwSuccess('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(''), 3000);
    } else {
      setPwError(result.error || 'Failed to change password');
    }
  };

  // ── Team tab state/logic — carried over from the old TeamManagementPage ──
  const [members, setMembers] = useState([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');
  const [busyUserId, setBusyUserId] = useState(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', displayName: '', password: '', role: 'viewer' });
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [invitedCreds, setInvitedCreds] = useState(null);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    setTeamError('');
    try {
      const res = await fetch('/api/organizations/team', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load team');
      setMembers(data.members || []);
    } catch (err) {
      setTeamError(err.message || 'Failed to load team');
    } finally {
      setTeamLoading(false);
    }
  }, []);

  // Lazy-load the team list the first time the Team tab is opened, rather
  // than fetching it on every /profile visit.
  useEffect(() => {
    if (activeTab === 'team' && !teamLoaded) {
      setTeamLoaded(true);
      loadTeam();
    }
  }, [activeTab, teamLoaded, loadTeam]);

  async function handleRoleChange(member, newRole) {
    setBusyUserId(member.user_id);
    setTeamError('');
    try {
      const res = await fetch(`/api/organizations/team/${member.user_id}/role`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      setMembers(prev => prev.map(m => (m.user_id === member.user_id ? { ...m, role: newRole } : m)));
      setTeamSuccess(`${member.display_name || member.email}'s role is now ${ROLE_META[newRole].label}.`);
    } catch (err) {
      setTeamError(err.message || 'Failed to update role');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRemove(member) {
    if (!window.confirm(`Remove ${member.display_name || member.email} from your team? They'll lose access immediately.`)) {
      return;
    }
    setBusyUserId(member.user_id);
    setTeamError('');
    try {
      const res = await fetch(`/api/organizations/team/${member.user_id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove team member');
      setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
      setTeamSuccess(`${member.display_name || member.email} has been removed.`);
    } catch (err) {
      setTeamError(err.message || 'Failed to remove team member');
    } finally {
      setBusyUserId(null);
    }
  }

  function generatePassword() {
    // Simple, readable-ish random password — good enough for an invite the
    // recipient is expected to change on first login (no "change password
    // on first login" flow exists yet, so this is just a starting point).
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setInviteForm(f => ({ ...f, password: pw }));
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError('');
    if (!inviteForm.email.trim() || !inviteForm.password) {
      setInviteError('Email and password are required.');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/auth/create-guest', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          password: inviteForm.password,
          displayName: inviteForm.displayName.trim(),
          role: inviteForm.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite team member');
      setInvitedCreds({ email: inviteForm.email.trim(), password: inviteForm.password, role: inviteForm.role });
      setInviteForm({ email: '', displayName: '', password: '', role: 'viewer' });
      await loadTeam();
    } catch (err) {
      setInviteError(err.message || 'Failed to invite team member');
    } finally {
      setInviting(false);
    }
  }

  // ── Platform tab state/logic — carried over from the old PlatformDashboard ──
  const [platformAdminCode, setPlatformAdminCode] = useState('');
  const [platformUnlocked, setPlatformUnlocked] = useState(false);
  const [platformStats, setPlatformStats] = useState(null);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformError, setPlatformError] = useState('');
  const [platformSubTab, setPlatformSubTab] = useState('overview'); // 'overview' | 'users' | 'ai-settings' | 'library'
  const [platformLoaded, setPlatformLoaded] = useState(false);

  const loadPlatformStats = async ({ secret, token, silent } = {}) => {
    setPlatformLoading(true);
    if (!silent) setPlatformError('');
    try {
      const res = await fetch('/api/admin/stats', {
        headers: secret ? { 'x-admin-secret': secret } : { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        if (!silent) setPlatformError('Invalid admin code');
        setPlatformLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setPlatformStats(data);
      setPlatformUnlocked(true);
    } catch (err) {
      if (!silent) setPlatformError(err.message || 'Failed to load stats');
    } finally {
      setPlatformLoading(false);
    }
  };

  // Lazy, one-time: the first time the Platform tab is opened, silently try
  // the account's own login token (see PLATFORM_ADMIN_EMAILS in
  // server/routes/admin.js's superAdminGuard) before falling back to the
  // manual admin-code prompt — same as the old PlatformDashboard's mount
  // effect, just deferred until this tab is actually opened.
  useEffect(() => {
    if (activeTab === 'platform' && !platformLoaded) {
      setPlatformLoaded(true);
      const token = localStorage.getItem('cf_token');
      if (token) loadPlatformStats({ token, silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, platformLoaded]);

  // ── Subscription tab state — carried over unchanged from the old
  // SubscriptionPage.jsx, lazy-loaded the first time this tab opens (same
  // pattern as Team/Platform above) rather than eagerly on every profile visit.
  const [subLoaded, setSubLoaded] = useState(false);
  const [subOrg, setSubOrg] = useState(organization);
  const [subLoading, setSubLoading] = useState(true);
  const [subError, setSubError] = useState('');
  const [subSwitching, setSubSwitching] = useState(null); // plan key currently being switched to
  const [subSwitchError, setSubSwitchError] = useState('');
  const [subSwitchSuccess, setSubSwitchSuccess] = useState('');
  const [subAiImageUsage, setSubAiImageUsage] = useState(null);
  const [subCheckoutNotice, setSubCheckoutNotice] = useState(null); // 'success' | 'cancelled' | null
  const [subStartingCheckout, setSubStartingCheckout] = useState(false);
  const [subCheckoutError, setSubCheckoutError] = useState('');

  const loadSubOrg = async () => {
    setSubLoading(true);
    setSubError('');
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch('/api/organizations/me', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load subscription details');
      setSubOrg(data);
      setOrganizationData(data);
    } catch (e) {
      setSubError(e.message);
    } finally {
      setSubLoading(false);
    }
  };

  const loadSubAiImageUsage = async () => {
    try {
      const token = localStorage.getItem('cf_token');
      if (!token) return;
      const res = await fetch('/api/organizations/ai-image-usage', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      setSubAiImageUsage(await res.json());
    } catch (e) { /* non-critical — just don't show the tile */ }
  };

  // Lazy, one-time: load subscription details the first time this tab opens.
  useEffect(() => {
    if (activeTab === 'subscription' && !subLoaded) {
      setSubLoaded(true);
      loadSubOrg();
      loadSubAiImageUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, subLoaded]);

  // Landed back here from Stripe Checkout — reload the org so the new
  // billing/card status shows immediately, surface a notice, and strip the
  // query param so a page refresh doesn't keep re-showing it.
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (!checkout) return;
    setSubCheckoutNotice(checkout);
    if (checkout === 'success') {
      loadSubOrg();
      loadSubAiImageUsage();
    }
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubAddPaymentMethod = async (planKey) => {
    setSubStartingCheckout(true);
    setSubCheckoutError('');
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      window.location.href = data.url;
    } catch (e) {
      setSubCheckoutError(e.message);
      setSubStartingCheckout(false);
    }
  };

  const subCurrentPlanKey = subOrg?.plan || 'free';
  const subBilling = subOrg?.billing || null;
  const subHasCardOnFile = !!(subBilling && subBilling.card_on_file);
  const subTrialEndsAt = subOrg?.trial_ends_at || null;
  const subTrialActive = subCurrentPlanKey !== 'free' && !subHasCardOnFile && subTrialEndsAt && subTrialEndsAt > Date.now();
  const subTrialExpired = subCurrentPlanKey === 'free' && subBilling && subBilling.subscription_status === 'trial_expired';
  const subPastDue = subBilling && subBilling.subscription_status === 'past_due';
  const subTrialDaysLeft = subTrialActive ? Math.max(1, Math.ceil((subTrialEndsAt - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
  const subCheckoutPlanKey = subCurrentPlanKey !== 'free' ? subCurrentPlanKey : 'starter';

  // Downgrading to Free only -- moving to a PAID plan goes through
  // handleSubAddPaymentMethod/Stripe Checkout instead (see the plan-card
  // button below), never this direct path — the server enforces the same
  // rule (POST /api/organizations/change-plan rejects anything but 'free').
  const handleSubSwitchPlan = async (planKey) => {
    if (planKey !== 'free' || planKey === subCurrentPlanKey || subSwitching) return;
    if (!window.confirm('Switch to the Free plan? You\'ll lose access to paid-plan features immediately.')) return;
    setSubSwitching(planKey);
    setSubSwitchError('');
    setSubSwitchSuccess('');
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch('/api/organizations/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change plan');
      setSubOrg(data.organization);
      setOrganizationData(data.organization);
      setSubSwitchSuccess(data.message || `Plan changed to ${planKey}`);
      setTimeout(() => setSubSwitchSuccess(''), 4000);
    } catch (e) {
      setSubSwitchError(e.message);
    } finally {
      setSubSwitching(null);
    }
  };

  // Single entry point for the plan-card button below: Free goes through
  // the direct (no-payment) downgrade path above, any paid plan goes
  // through real Stripe Checkout.
  const handleSubPlanCardClick = (planKey) => {
    if (planKey === 'free') return handleSubSwitchPlan(planKey);
    return handleSubAddPaymentMethod(planKey);
  };

  const subUsage = subOrg?.usage || {};
  const subLimits = subOrg?.limits || SUB_PLANS.find(p => p.key === subCurrentPlanKey)?.limits || {};

  const handlePlatformUnlock = (e) => {
    e.preventDefault();
    if (!platformAdminCode) return;
    loadPlatformStats({ secret: platformAdminCode });
  };

  const refreshPlatformStats = () => {
    const token = localStorage.getItem('cf_token');
    if (!platformAdminCode && token) loadPlatformStats({ token });
    else loadPlatformStats({ secret: platformAdminCode });
  };

  const platformTabBtn = (key, label, Icon) => (
    <button
      key={key}
      onClick={() => setPlatformSubTab(key)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '12px 16px', fontSize: '0.95rem', fontWeight: 800,
        background: 'none', border: 'none', borderBottom: platformSubTab === key ? '2px solid var(--cf-accent)' : '2px solid transparent',
        color: platformSubTab === key ? 'var(--cf-accent)' : 'var(--cf-text-muted)', cursor: 'pointer',
      }}
    >
      {Icon && <Icon size={16} />} {label}
    </button>
  );

  return (
    <div className="min-h-screen" style={HALO_BG}>
      <AdminToolbar activePage="profile" />
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              style={{ ...GLOSS_BLACK, width: 36, height: 36, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <ArrowLeft className="w-4 h-4" style={{ color: '#fff' }} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
              <p className="text-sm text-gray-500">
                {activeTab === 'team' ? 'Who has access to your organization, and what they can do'
                  : activeTab === 'platform' ? "Who's using CalendarFly, and how"
                  : activeTab === 'subscription' ? 'Your plan, usage, and upgrade options'
                  : 'Your personal account details'}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-5 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => selectTab('profile')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTab === 'profile' ? 'text-gray-900 border-black' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
            >
              <User className="w-4 h-4" /> Profile
            </button>
            <button
              onClick={() => selectTab('team')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTab === 'team' ? 'text-gray-900 border-black' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
            >
              <UserCog className="w-4 h-4" /> Team
            </button>
            <button
              onClick={() => selectTab('platform')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTab === 'platform' ? 'text-gray-900 border-black' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
            >
              <Building2 className="w-4 h-4" /> Platform
            </button>
            <button
              onClick={() => selectTab('subscription')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTab === 'subscription' ? 'text-gray-900 border-black' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
            >
              <CreditCard className="w-4 h-4" /> Subscription
            </button>
          </div>
        </div>
      </div>

      {/* ── Profile tab ── */}
      {activeTab === 'profile' && (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Account info (read-only) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div style={{ ...GLOSS_BLACK, width: 40, height: 40, borderRadius: 9 }} className="flex items-center justify-center">
                <User className="w-5 h-5" style={{ color: '#fff' }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Account</h2>
                <p className="text-sm text-gray-500">Basic details tied to your login</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-500 font-semibold flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</p>
                <p className="text-sm font-medium text-gray-900 mt-1 break-all">{user?.email || '—'}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-500 font-semibold flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Role</p>
                <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{user?.role || '—'}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 sm:col-span-2">
                <p className="text-xs text-gray-500 font-semibold flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Organization</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{organization?.name || '—'}</p>
              </div>
            </div>

            {nameSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{nameSuccess}</div>
            )}
            {nameError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{nameError}</div>
            )}
            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Your name"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={nameSaving}
                  style={{ ...GLOSS_BLACK, opacity: nameSaving ? 0.6 : 1, border: 'none', cursor: nameSaving ? 'not-allowed' : 'pointer' }}
                  className="px-5 py-2.5 rounded-lg text-white font-semibold text-sm"
                >
                  {nameSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Change password */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div style={{ ...GLOSS_BLACK, width: 40, height: 40, borderRadius: 9 }} className="flex items-center justify-center">
                <Lock className="w-5 h-5" style={{ color: '#fff' }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Password</h2>
                <p className="text-sm text-gray-500">Change the password used to log in</p>
              </div>
            </div>

            {pwSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{pwSuccess}</div>
            )}
            {pwError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{pwError}</div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                  autoComplete="current-password"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Must be at least 8 characters.</p>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={pwSaving}
                  style={{ ...GLOSS_BLACK, opacity: pwSaving ? 0.6 : 1, border: 'none', cursor: pwSaving ? 'not-allowed' : 'pointer' }}
                  className="px-5 py-2.5 rounded-lg text-white font-semibold text-sm"
                >
                  {pwSaving ? 'Updating…' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Team tab — moved here from the old standalone /team page ── */}
      {activeTab === 'team' && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-end mb-4">
            {canManage && (
              <button
                onClick={() => { setShowInvite(true); setInvitedCreds(null); setInviteError(''); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Invite teammate
              </button>
            )}
          </div>

          {teamSuccess && (
            <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center justify-between">
              {teamSuccess}
              <button onClick={() => setTeamSuccess('')} className="text-green-700/70 hover:text-green-900"><X className="w-4 h-4" /></button>
            </div>
          )}
          {teamError && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-between">
              {teamError}
              <button onClick={() => setTeamError('')} className="text-red-700/70 hover:text-red-900"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Role explainer */}
          <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Owner</span> manages billing and can delete the organization.{' '}
            <span className="font-semibold text-gray-800">Admin</span> can do everything else — events, flyers, broadcasts, settings, and inviting people.{' '}
            <span className="font-semibold text-gray-800">Viewer</span> can see the calendar, events, and RSVP/analytics numbers, but can't create or send anything.
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {teamLoading ? (
              <div className="p-8 text-center text-gray-500">Loading team…</div>
            ) : members.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No team members found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="px-6 py-3 font-medium">Member</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => {
                    const isSelf = m.user_id === user?.user_id;
                    const rowBusy = busyUserId === m.user_id;
                    const canEditThisRow = canManage && !m.isOwner;
                    return (
                      <tr key={m.user_id} className="border-b border-gray-100 last:border-0">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{m.display_name || m.email}{isSelf ? ' (you)' : ''}</div>
                          <div className="text-gray-500">{m.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <RoleBadge role={m.isOwner ? 'owner' : m.role} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {canEditThisRow && (
                              <select
                                value={m.role === 'owner' ? 'admin' : m.role}
                                disabled={rowBusy}
                                onChange={(e) => handleRoleChange(m, e.target.value)}
                                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 disabled:opacity-50"
                              >
                                <option value="admin">Admin</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            )}
                            {canEditThisRow && !isSelf && (
                              <button
                                onClick={() => handleRemove(m)}
                                disabled={rowBusy}
                                title="Remove from team"
                                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Invite modal */}
          {showInvite && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4" onClick={() => setShowInvite(false)}>
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                {invitedCreds ? (
                  <>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Teammate added</h2>
                    <p className="text-sm text-gray-600 mb-4">Share these sign-in details with them directly — they won't be shown again here.</p>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm space-y-1 mb-4">
                      <div><span className="text-gray-500">Email:</span> <span className="font-mono">{invitedCreds.email}</span></div>
                      <div><span className="text-gray-500">Password:</span> <span className="font-mono">{invitedCreds.password}</span></div>
                      <div><span className="text-gray-500">Role:</span> {ROLE_META[invitedCreds.role].label}</div>
                    </div>
                    <button onClick={() => { setShowInvite(false); setInvitedCreds(null); }} className="w-full py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-black">
                      Done
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleInvite}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900">Invite a teammate</h2>
                      <button type="button" onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                    </div>
                    {inviteError && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{inviteError}</div>}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          required
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Name (optional)</label>
                        <input
                          type="text"
                          value={inviteForm.displayName}
                          onChange={(e) => setInviteForm(f => ({ ...f, displayName: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                        <select
                          value={inviteForm.role}
                          onChange={(e) => setInviteForm(f => ({ ...f, role: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                        >
                          <option value="viewer">Viewer — can view only</option>
                          <option value="admin">Admin — can manage everything except billing</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Temporary password</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            value={inviteForm.password}
                            onChange={(e) => setInviteForm(f => ({ ...f, password: e.target.value }))}
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 font-mono focus:outline-none focus:ring-2 focus:ring-black"
                          />
                          <button type="button" onClick={generatePassword} className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                            Generate
                          </button>
                        </div>
                      </div>
                    </div>
                    <button type="submit" disabled={inviting} className="mt-6 w-full py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-black disabled:opacity-50">
                      {inviting ? 'Adding…' : 'Add teammate'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Platform tab — moved here from the old standalone /platform page ── */}
      {activeTab === 'platform' && (
        <div className="px-6 py-8" style={{ maxWidth: 1200, margin: '0 auto' }}>
          {!platformUnlocked ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 360 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--cf-bg-deep)', border: '1px solid var(--cf-border)', color: 'var(--cf-accent)',
                  }}>
                    <Lock size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--cf-text-primary)', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Platform Overview</h2>
                    <p style={{ fontSize: '0.76rem', color: 'var(--cf-text-muted)', margin: 0 }}>Owner-only — enter your admin code</p>
                  </div>
                </div>
                <form onSubmit={handlePlatformUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    type="password"
                    autoFocus
                    value={platformAdminCode}
                    onChange={(e) => setPlatformAdminCode(e.target.value)}
                    placeholder="Admin code"
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 8,
                      border: '1px solid var(--cf-border)', background: 'var(--cf-bg-base)', color: 'var(--cf-text-primary)',
                      fontSize: '0.9rem',
                    }}
                  />
                  {platformError && <p style={{ fontSize: '0.82rem', color: '#dc2626', margin: 0 }}>{platformError}</p>}
                  <button
                    type="submit"
                    disabled={platformLoading}
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: 8, border: 'none',
                      background: 'var(--cf-btn-bg)', color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                      cursor: platformLoading ? 'default' : 'pointer', opacity: platformLoading ? 0.6 : 1,
                    }}
                  >
                    {platformLoading ? 'Checking…' : 'View Stats'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <>
              <style>{`@keyframes pdSpin { to { transform: rotate(360deg); } } .pd-spin { animation: pdSpin 0.8s linear infinite; }`}</style>

              {platformSubTab === 'overview' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button
                    onClick={refreshPlatformStats}
                    disabled={platformLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8,
                      border: '1px solid var(--cf-border)', background: 'var(--cf-bg-surface)', color: 'var(--cf-text-secondary)',
                      fontWeight: 800, fontSize: '0.92rem', cursor: platformLoading ? 'default' : 'pointer', opacity: platformLoading ? 0.6 : 1,
                    }}
                  >
                    <RefreshCw size={15} className={platformLoading ? 'pd-spin' : ''} />
                    Refresh
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--cf-border)', marginBottom: 20, flexWrap: 'wrap' }}>
                {platformTabBtn('overview', '📊 Overview')}
                {platformTabBtn('users', 'Users & Access', ShieldCheck)}
                {platformTabBtn('ai-settings', 'AI Image Settings', Sparkles)}
                {platformTabBtn('library', 'Stock Library', ImagePlus)}
              </div>

              {platformSubTab === 'users' && (
                <UsersAccessPanel adminCode={platformAdminCode} organizations={platformStats?.organizations || []} />
              )}

              {platformSubTab === 'ai-settings' && (
                <AISettingsPanel adminCode={platformAdminCode} />
              )}

              {platformSubTab === 'library' && (
                <StockLibraryGenerator adminCode={platformAdminCode} />
              )}

              {platformSubTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {platformError && (
                  <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626', fontSize: '0.85rem' }}>{platformError}</div>
                )}

                {platformStats && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                      <PlatformStatCard icon={Building2} label="Organizations" value={platformStats.totals.organizations}
                        sublabel={`${platformStats.signups_last_7_days} new in last 7 days · ${platformStats.signups_last_30_days} in last 30`} />
                      <PlatformStatCard icon={Users} label="Users" value={platformStats.totals.users}
                        sublabel="Across all organizations" />
                      <PlatformStatCard icon={CalendarDays} label="Events" value={platformStats.totals.events}
                        sublabel={`${platformStats.events_created_last_7_days} new in last 7 days · ${platformStats.events_created_last_30_days} in last 30`} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                      <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                          <span style={{ width: 4, height: 18, borderRadius: 2, background: 'var(--cf-accent)' }} />
                          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--cf-text-primary)', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Organizations by type</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {Object.entries(platformStats.organizations_by_category).map(([key, count]) => (
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
                          {Object.entries(platformStats.organizations_by_plan).map(([key, count]) => (
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
                            {platformStats.organizations.map(org => (
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
                                <td style={{ padding: '15px 18px', color: 'var(--cf-text-secondary)' }}>{formatPlatformDate(org.created_at)}</td>
                                <td style={{ padding: '15px 18px', color: 'var(--cf-text-secondary)' }}>{formatPlatformDate(org.last_login_at)}</td>
                                <td style={{ padding: '15px 18px' }}>
                                  {org.onboarding_completed ? (
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#15803d', background: 'rgba(34,197,94,0.12)', padding: '3px 10px', borderRadius: 999 }}>Complete</span>
                                  ) : (
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--cf-accent)', background: 'var(--cf-accent-glow)', padding: '3px 10px', borderRadius: 999 }}>In progress</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {platformStats.organizations.length === 0 && (
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
            </>
          )}
        </div>
      )}

      {/* ── Subscription tab — carried over unchanged from the old
          SubscriptionPage.jsx (now reached at /profile?tab=subscription,
          see App.jsx's /subscription redirect) ── */}
      {activeTab === 'subscription' && (
        <div className="px-6 py-8" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="space-y-6">
            {subError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{subError}</div>
            )}
            {subSwitchSuccess && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{subSwitchSuccess}</div>
            )}
            {subSwitchError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{subSwitchError}</div>
            )}
            {subCheckoutError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{subCheckoutError}</div>
            )}
            {subCheckoutNotice === 'success' && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                Payment method added — you're all set for when your trial ends.
              </div>
            )}
            {subCheckoutNotice === 'cancelled' && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-sm">
                Checkout was cancelled — no card was added.
              </div>
            )}

            {!subLoading && (subTrialActive || subTrialExpired || subPastDue) && (
              <div className={`p-4 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${
                subTrialExpired || subPastDue ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${subTrialExpired || subPastDue ? 'text-red-500' : 'text-gray-500'}`} />
                  <div>
                    {subTrialActive && (
                      <>
                        <p className="text-sm font-semibold text-black">
                          {subTrialDaysLeft} day{subTrialDaysLeft === 1 ? '' : 's'} left in your free trial
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Add a payment method now and you won't lose access to your {SUB_PLANS.find(p => p.key === subCurrentPlanKey)?.name || subCurrentPlanKey} features when the trial ends.
                        </p>
                      </>
                    )}
                    {subTrialExpired && (
                      <>
                        <p className="text-sm font-semibold text-red-900">Your free trial has ended</p>
                        <p className="text-xs text-red-700 mt-0.5">
                          No card was added, so this org was moved to the Free plan. Add a payment method to upgrade again.
                        </p>
                      </>
                    )}
                    {subPastDue && (
                      <>
                        <p className="text-sm font-semibold text-red-900">Your last payment failed</p>
                        <p className="text-xs text-red-700 mt-0.5">
                          Update your payment method to keep your {SUB_PLANS.find(p => p.key === subCurrentPlanKey)?.name || subCurrentPlanKey} features.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleSubAddPaymentMethod(subCheckoutPlanKey)}
                  disabled={subStartingCheckout}
                  style={subTrialExpired || subPastDue ? undefined : GLOSS_BLACK}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                    subTrialExpired || subPastDue ? 'bg-red-600 hover:bg-red-700' : ''
                  }`}
                >
                  {subStartingCheckout ? 'Starting checkout…' : subPastDue ? 'Update Payment Method' : 'Add Payment Method'}
                </button>
              </div>
            )}

            {subLoading ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading subscription details…
              </div>
            ) : (
              <>
                {/* Billing & Usage */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)' }} className="w-10 h-10 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Billing &amp; Usage</h2>
                      <p className="text-sm text-gray-500 capitalize">
                        {subCurrentPlanKey} plan
                        {subTrialActive && ' · free trial'}
                        {subPastDue && ' · payment past due'}
                        {subTrialExpired && ' · trial ended'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <SubUsageTile
                      label="Events this month"
                      used={subUsage.events_this_month ?? 0}
                      limit={subLimits.events_per_month}
                    />
                    <SubUsageTile
                      label="Flyers this month"
                      used={subUsage.flyers_this_month ?? 0}
                      limit={subLimits.flyers_per_month}
                    />
                    <SubUsageTile
                      label="RSVP responses"
                      used={subUsage.rsvp_responses_this_month ?? 0}
                      limit={subLimits.rsvp_responses_per_month}
                    />
                    <SubUsageTile
                      label="Chatbot messages"
                      used={subUsage.chatbot_messages_this_month ?? 0}
                      limit={subLimits.chatbot_messages_per_month}
                    />
                    <SubUsageTile
                      label="Team members"
                      used={subOrg?.team_members_used ?? 0}
                      limit={subLimits.users}
                    />
                    <SubLimitOnlyTile
                      label="Storage"
                      limit={subLimits.storage_gb}
                      unit="GB"
                    />
                  </div>

                  {subAiImageUsage && (
                    <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">AI images this month</p>
                        <p className="text-xl font-bold text-black mt-1">
                          {subAiImageUsage.used}
                          {!subAiImageUsage.isUnlimited && <span className="text-sm font-medium text-gray-600"> / {subAiImageUsage.limit} free</span>}
                        </p>
                      </div>
                      {subAiImageUsage.overageCents > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-600 font-semibold">Overage owed</p>
                          <p className="text-lg font-bold text-red-700">${(subAiImageUsage.overageCents / 100).toFixed(2)}</p>
                          <p className="text-[11px] text-gray-500">${(subAiImageUsage.pricePerImageCents / 100).toFixed(2)}/image past your free tier</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Plan comparison */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Available Plans</h2>
                  <p className="text-sm text-gray-500 mb-6">All plans include a 7-day free trial.</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Enterprise is no longer a self-serve option (pricing
                        update, Sept 2026) -- hidden unless an org is already
                        on it (a custom/negotiated deal). */}
                    {SUB_PLANS.filter((plan) => plan.key !== 'enterprise' || plan.key === subCurrentPlanKey).map((plan) => {
                      const isCurrent = plan.key === subCurrentPlanKey;
                      return (
                        <div
                          key={plan.key}
                          className={`rounded-xl border p-5 flex flex-col ${plan.popular ? 'border-gray-900 ring-1 ring-gray-300' : 'border-gray-200'} ${isCurrent ? 'bg-gray-50' : 'bg-white'}`}
                        >
                          {plan.popular && !isCurrent && (
                            <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)' }} className="text-white text-xs font-bold py-1 px-3 rounded-full inline-block mb-3 self-start">
                              Most Popular
                            </div>
                          )}
                          {isCurrent && (
                            <div className="bg-gray-800 text-white text-xs font-bold py-1 px-3 rounded-full inline-block mb-3 self-start">
                              Current Plan
                            </div>
                          )}
                          <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                          <div className="mb-4">
                            <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                            <span className="text-gray-500 text-sm">/month</span>
                          </div>
                          <ul className="space-y-2 mb-6 flex-1">
                            {plan.features.map((f, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                          <button
                            onClick={() => handleSubPlanCardClick(plan.key)}
                            disabled={isCurrent || subSwitching !== null || subStartingCheckout}
                            style={isCurrent ? undefined : GLOSS_BLACK}
                            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                              isCurrent
                                ? 'bg-gray-200 text-gray-500 cursor-default'
                                : 'text-white disabled:opacity-60'
                            }`}
                          >
                            {isCurrent
                              ? 'Current Plan'
                              : subSwitching === plan.key
                              ? 'Switching…'
                              : plan.key === 'free'
                              ? 'Switch to Free'
                              : subStartingCheckout
                              ? 'Starting checkout…'
                              : 'Subscribe'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
