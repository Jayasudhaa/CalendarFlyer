/**
 * SubscriptionPage - dedicated plan & billing page
 * Split out of the old catch-all Settings page. Pulls the org's real plan,
 * limits and usage from GET /api/organizations/me, and wires plan switching
 * to the existing (previously unused by any UI) POST /api/organizations/change-plan.
 * Pricing mirrors what's shown on the public pricing section (PremiumLanding.jsx).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AdminToolbar from './components/AdminToolbar';
import { ArrowLeft, CreditCard, Check, Loader2, AlertTriangle } from 'lucide-react';

// Same soft warm-gold halo background used on the admin calendar page —
// applied consistently across every admin page (Broadcast, Flyer, Analytics,
// My Profile, Subscription, Settings) instead of each having its own look.
// Was a warm-gold radial halo (var(--cf-accent-glow) x3) — dropped for a
// flat pure-white page background as part of the black & white redesign
// (same fix as App.jsx/CalendarGrid.jsx/MyProfile.jsx).
const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    limits: { events_per_month: 30, flyers_per_month: 0, rsvp_responses: 50, chatbot_messages: 0, users: 1, storage_gb: 1 },
    features: ['Calendar', 'Instagram + Facebook broadcast', '30 events/month \u2014 create & broadcast'],
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$49',
    limits: { events_per_month: 50, flyers_per_month: 20, rsvp_responses: 500, chatbot_messages: 500, users: 3, storage_gb: 5 },
    features: ['Everything in Free', 'Flyer Editor (30 AI images/mo)', '50 events/month'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$99',
    popular: true,
    limits: { events_per_month: -1, flyers_per_month: -1, rsvp_responses: -1, chatbot_messages: 2000, users: 10, storage_gb: 20 },
    features: ['Everything in Starter', 'Unlimited events', 'Advanced analytics', 'AI Chatbot (2000 msg/mo)', 'Priority support'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '$149',
    limits: { events_per_month: -1, flyers_per_month: -1, rsvp_responses: -1, chatbot_messages: -1, users: -1, storage_gb: 100 },
    features: ['Everything in Pro', 'WhatsApp broadcast (requires a WhatsApp Business number)', 'Unlimited everything', 'Custom domain', 'AI document search \u2014 upload files, get summaries & action items', 'Public chatbot for devotees', 'Live photo sharing (public)', 'Public messages (multi-channel)', 'Dedicated support'],
  },
];

function fmtLimit(n) {
  return n === -1 ? 'Unlimited' : n;
}

// Usage tile with a progress bar that shifts amber near the limit and red
// once at/over it — a plain number doesn't warn anyone before they hit the
// hard-block on events/flyers/RSVPs/team members. `limit` of -1 or null/
// undefined means unlimited/not tracked: no bar, just the raw count. The
// plan limit itself is rendered at near-equal weight to the used count
// (not a faint footnote) since knowing "what's my cap" matters as much as
// "where am I now" on a page whose whole job is answering both.
// Black & white redesign — was a different Tailwind color per tile
// (orange/blue/purple/teal/pink). All tiles now share one neutral chrome;
// the at-limit/near-limit bar colors stay red/amber since those are a real
// status signal (like the plan's own success/error messaging), not
// decoration.
function UsageTile({ label, used, limit, colorKey }) {
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
        {!isUnlimited && <span className={`text-base font-bold ${c.text}`}> / {fmtLimit(limit)}</span>}
      </p>
      <p className={`text-[11px] font-medium ${c.text} mt-0.5`}>
        {isUnlimited ? 'Unlimited on your plan' : `Plan limit: ${fmtLimit(limit)}/mo`}
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

// Static plan-allowance line for resources we don't meter usage for yet
// (storage). Still answers "what's my limit", just without a used/pct bar.
function LimitOnlyTile({ label, limit, unit, colorKey }) {
  const c = { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', value: 'text-black' };
  const isUnlimited = limit == null || limit === -1;
  return (
    <div className={`p-4 rounded-lg ${c.bg} border ${c.border}`}>
      <p className={`text-xs font-semibold ${c.text}`}>{label}</p>
      <p className={`text-xl font-bold ${c.value} mt-1`}>{fmtLimit(limit)}{!isUnlimited && unit ? ` ${unit}` : ''}</p>
      <p className={`text-[11px] font-medium ${c.text} mt-0.5`}>Included on your plan</p>
    </div>
  );
}

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organization: cachedOrg, setOrganizationData } = useAuth();

  const [org, setOrg] = useState(cachedOrg);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(null); // plan key currently being switched to
  const [switchError, setSwitchError] = useState('');
  const [switchSuccess, setSwitchSuccess] = useState('');
  // AI image usage/overage — separate from `org.usage` (which only reflects
  // whatever GET /me happened to return) since this has its own endpoint
  // that also computes remaining/overage in one place.
  const [aiImageUsage, setAiImageUsage] = useState(null);
  // Stripe Checkout return state — set once we've read (and cleared) the
  // ?checkout= query param, so the banner survives even after the param
  // is stripped from the URL.
  const [checkoutNotice, setCheckoutNotice] = useState(null); // 'success' | 'cancelled' | null
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const loadOrg = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch('/api/organizations/me', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load subscription details');
      setOrg(data);
      setOrganizationData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAiImageUsage = async () => {
    try {
      const token = localStorage.getItem('cf_token');
      if (!token) return;
      const res = await fetch('/api/organizations/ai-image-usage', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      setAiImageUsage(await res.json());
    } catch (e) { /* non-critical — just don't show the tile */ }
  };

  useEffect(() => { loadOrg(); loadAiImageUsage(); }, []);

  // Landed back here from Stripe Checkout — reload the org so the new
  // billing/card status shows immediately, surface a notice, and strip the
  // query param so a page refresh doesn't keep re-showing it.
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (!checkout) return;
    setCheckoutNotice(checkout);
    if (checkout === 'success') {
      loadOrg();
      loadAiImageUsage();
    }
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleAddPaymentMethod = async (planKey) => {
    setStartingCheckout(true);
    setCheckoutError('');
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
      setCheckoutError(e.message);
      setStartingCheckout(false);
    }
  };

  const currentPlanKey = org?.plan || 'free';
  const billing = org?.billing || null;
  const hasCardOnFile = !!(billing && billing.card_on_file);
  const trialEndsAt = org?.trial_ends_at || null;
  const trialActive = currentPlanKey !== 'free' && !hasCardOnFile && trialEndsAt && trialEndsAt > Date.now();
  const trialExpired = currentPlanKey === 'free' && billing && billing.subscription_status === 'trial_expired';
  const pastDue = billing && billing.subscription_status === 'past_due';
  const trialDaysLeft = trialActive ? Math.max(1, Math.ceil((trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
  // Which plan "Add Payment Method" should check out into: the plan they're
  // trialing/on now, falling back to Starter if somehow on free with no plan
  // context (e.g. after a trial already expired).
  const checkoutPlanKey = currentPlanKey !== 'free' ? currentPlanKey : 'starter';

  // Downgrading to Free only -- moving to a PAID plan goes through
  // handleAddPaymentMethod/Stripe Checkout instead (see the plan-card
  // button below), never this direct path. The server enforces the same
  // rule (POST /api/organizations/change-plan now rejects anything but
  // 'free'), so this is a matching, not a redundant, client-side guard.
  const handleSwitchPlan = async (planKey) => {
    if (planKey !== 'free' || planKey === currentPlanKey || switching) return;
    if (!window.confirm('Switch to the Free plan? You\'ll lose access to paid-plan features immediately.')) return;
    setSwitching(planKey);
    setSwitchError('');
    setSwitchSuccess('');
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch('/api/organizations/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change plan');
      setOrg(data.organization);
      setOrganizationData(data.organization);
      setSwitchSuccess(data.message || `Plan changed to ${planKey}`);
      setTimeout(() => setSwitchSuccess(''), 4000);
    } catch (e) {
      setSwitchError(e.message);
    } finally {
      setSwitching(null);
    }
  };

  // Single entry point for the plan-card button below: Free goes through
  // the direct (no-payment) downgrade path above, any paid plan goes
  // through real Stripe Checkout. Keeping this as one function means the
  // button's onClick can't accidentally call the free-only path with a
  // paid plan key.
  const handlePlanCardClick = (planKey) => {
    if (planKey === 'free') return handleSwitchPlan(planKey);
    return handleAddPaymentMethod(planKey);
  };

  const usage = org?.usage || {};
  const limits = org?.limits || PLANS.find(p => p.key === currentPlanKey)?.limits || {};

  return (
    <div className="min-h-screen" style={HALO_BG}>
      <AdminToolbar activePage="subscription" />
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
              <p className="text-sm text-gray-500">Your plan, usage, and upgrade options</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}
        {switchSuccess && (
          <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{switchSuccess}</div>
        )}
        {switchError && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{switchError}</div>
        )}
        {checkoutError && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{checkoutError}</div>
        )}
        {checkoutNotice === 'success' && (
          <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            Payment method added — you're all set for when your trial ends.
          </div>
        )}
        {checkoutNotice === 'cancelled' && (
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-sm">
            Checkout was cancelled — no card was added.
          </div>
        )}

        {/* Black & white redesign — the "still fine, just a heads-up" trial
            notice was amber before; now neutral black/white/gray. The
            genuinely bad states (trial already ended, payment failed) keep
            red — that's real alert signal, not decoration. */}
        {!loading && (trialActive || trialExpired || pastDue) && (
          <div className={`p-4 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${
            trialExpired || pastDue ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${trialExpired || pastDue ? 'text-red-500' : 'text-gray-500'}`} />
              <div>
                {trialActive && (
                  <>
                    <p className="text-sm font-semibold text-black">
                      {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left in your free trial
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Add a payment method now and you won't lose access to your {PLANS.find(p => p.key === currentPlanKey)?.name || currentPlanKey} features when the trial ends.
                    </p>
                  </>
                )}
                {trialExpired && (
                  <>
                    <p className="text-sm font-semibold text-red-900">Your free trial has ended</p>
                    <p className="text-xs text-red-700 mt-0.5">
                      No card was added, so this org was moved to the Free plan. Add a payment method to upgrade again.
                    </p>
                  </>
                )}
                {pastDue && (
                  <>
                    <p className="text-sm font-semibold text-red-900">Your last payment failed</p>
                    <p className="text-xs text-red-700 mt-0.5">
                      Update your payment method to keep your {PLANS.find(p => p.key === currentPlanKey)?.name || currentPlanKey} features.
                    </p>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => handleAddPaymentMethod(checkoutPlanKey)}
              disabled={startingCheckout}
              style={trialExpired || pastDue ? undefined : { background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)', boxShadow: '0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.16)' }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                trialExpired || pastDue ? 'bg-red-600 hover:bg-red-700' : ''
              }`}
            >
              {startingCheckout ? 'Starting checkout…' : pastDue ? 'Update Payment Method' : 'Add Payment Method'}
            </button>
          </div>
        )}

        {loading ? (
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
                    {currentPlanKey} plan
                    {trialActive && ' · free trial'}
                    {pastDue && ' · payment past due'}
                    {trialExpired && ' · trial ended'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <UsageTile
                  label="Events this month"
                  used={usage.events_this_month ?? 0}
                  limit={limits.events_per_month}
                  colorKey="orange"
                />
                <UsageTile
                  label="Flyers this month"
                  used={usage.flyers_this_month ?? 0}
                  limit={limits.flyers_per_month}
                  colorKey="blue"
                />
                <UsageTile
                  label="RSVP responses"
                  used={usage.rsvp_responses_this_month ?? 0}
                  limit={limits.rsvp_responses_per_month}
                  colorKey="pink"
                />
                <UsageTile
                  label="Chatbot messages"
                  used={usage.chatbot_messages_this_month ?? 0}
                  limit={limits.chatbot_messages_per_month}
                  colorKey="purple"
                />
                <UsageTile
                  label="Team members"
                  used={org?.team_members_used ?? 0}
                  limit={limits.users}
                  colorKey="teal"
                />
                <LimitOnlyTile
                  label="Storage"
                  limit={limits.storage_gb}
                  unit="GB"
                  colorKey="amber"
                />
              </div>

              {aiImageUsage && (
                <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">AI images this month</p>
                    <p className="text-xl font-bold text-black mt-1">
                      {aiImageUsage.used}
                      {!aiImageUsage.isUnlimited && <span className="text-sm font-medium text-gray-600"> / {aiImageUsage.limit} free</span>}
                    </p>
                  </div>
                  {aiImageUsage.overageCents > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-600 font-semibold">Overage owed</p>
                      <p className="text-lg font-bold text-red-700">${(aiImageUsage.overageCents / 100).toFixed(2)}</p>
                      <p className="text-[11px] text-gray-500">${(aiImageUsage.pricePerImageCents / 100).toFixed(2)}/image past your free tier</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Plan comparison */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Available Plans</h2>
              <p className="text-sm text-gray-500 mb-6">All plans include a 7-day free trial.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PLANS.map((plan) => {
                  const isCurrent = plan.key === currentPlanKey;
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
                        onClick={() => handlePlanCardClick(plan.key)}
                        disabled={isCurrent || switching !== null || startingCheckout}
                        style={isCurrent ? undefined : { background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)', boxShadow: '0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.16)' }}
                        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                          isCurrent
                            ? 'bg-gray-200 text-gray-500 cursor-default'
                            : 'text-white disabled:opacity-60'
                        }`}
                      >
                        {isCurrent
                          ? 'Current Plan'
                          : switching === plan.key
                          ? 'Switching…'
                          : plan.key === 'free'
                          ? 'Switch to Free'
                          : startingCheckout
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
  );
}
