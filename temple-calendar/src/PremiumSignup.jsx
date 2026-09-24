/**
 * PremiumSignup.jsx
 * - Eye icon toggle on password field
 * - Mobile responsive
 * - Redirects to /calendar after signup
 * Black & white — white background, black text — see PremiumLanding.jsx.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import BrandMark from './components/BrandMark';

// Kept in sync with PricingMarketingPage.jsx and server/organizations.js's
// PLAN_FEATURES / PLAN_LIMITS — that's the actual source of truth for what
// each plan includes. (This used to drift on its own with different prices
// and a different top-tier name than the homepage/pricing page — fixed by
// matching all three to the same numbers.)
// Enterprise dropped from self-serve signup (pricing update, Sept 2026) --
// a custom/negotiated deal goes through Contact Sales instead, then gets
// set up on the 'enterprise' plan directly (see organizations.js), never
// picked here.
const PLANS = {
  free:    { name: 'Organization Free', price: '$0',  features: ['Public organization page & calendar', 'Instagram + Facebook broadcast', 'WhatsApp broadcast', 'Event creation \u2014 30 events/month'] },
  starter: { name: 'Organization Plus', price: '$49', features: ['Everything in Organization Free', 'AI Flyer Studio \u2014 30 AI image generations/month', '50 events/month'] },
  pro:     { name: 'Organization Pro',  price: '$79', features: ['Everything in Organization Plus', 'Unlimited events', 'AI-powered analytics', 'AI-powered search and summary'], popular: true },
};

// Reusable password input with eye toggle
function PasswordInput({ value, onChange, placeholder = '••••••••', name = 'password', required = true, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black text-base"
        style={{ paddingRight: 48 }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: 14, top: '50%',
          transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: show ? '#000000' : '#9ca3af',
          padding: 0, display: 'flex', alignItems: 'center',
          transition: 'color 0.15s',
        }}
      >
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}
export default function PremiumSignup() {
  const navigate = useNavigate();
  const { signup, resendVerification } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [formData, setFormData]       = useState({ name: '', subdomain: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Set once signup succeeds — step 2's form is replaced with a
  // "check your email" screen instead of navigating into the app, since
  // the account can't sign in yet until the email link is clicked.
  const [signupResult, setSignupResult] = useState(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'name' && !formData.subdomain) {
      setFormData(prev => ({ ...prev, subdomain: value.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signup({ ...formData, plan: selectedPlan });

    if (result.success) {
      setSignupResult(result);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    await resendVerification(signupResult?.email || formData.email);
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  };

  return (
    <div className="relative min-h-screen bg-white text-black px-4 py-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-gray-50 rounded-full blur-3xl top-20 left-20" />
        <div className="absolute w-96 h-96 bg-gray-50 rounded-full blur-3xl bottom-20 right-20" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-5">
            <BrandMark size={48} />
            <span
              className="text-3xl font-bold text-black"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >CalendarFly</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-3">
            {signupResult ? 'Check Your Email' : step === 1 ? 'Choose Your Plan' : 'Create Your Workspace'}
          </h1>
          {!signupResult && <p className="text-gray-500">7-day free trial · No credit card required</p>}
        </div>

        {/* Step indicator */}
        {!signupResult && (
        <div className="flex items-center justify-center gap-4 mb-10">
          {[1, 2].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <div className={`h-0.5 w-10 sm:w-16 ${step >= s ? 'bg-black' : 'bg-gray-200'}`} />}
              <div className={`flex items-center gap-2 ${step >= s ? 'text-black' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full ${step >= s ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'} flex items-center justify-center font-bold text-sm`}>{s}</div>
                <span className="hidden sm:inline text-sm">{s === 1 ? 'Plan' : 'Details'}</span>
          </div>
            </React.Fragment>
          ))}
        </div>
        )}

        {/* Post-signup — email verification required before sign-in */}
        {signupResult && (
          <div className="max-w-xl mx-auto">
            <GlassCard light className="p-6 sm:p-8 text-center">
              <div className="text-5xl mb-4">📬</div>
              <p className="text-gray-700 mb-2">
                We sent a verification link to <span className="text-black font-semibold">{signupResult.email}</span>.
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Click the link in that email to activate your account, then come back and sign in.
                {signupResult.emailSendFailed && ' If it doesn’t arrive in a few minutes, use the button below to resend it.'}
              </p>

              {resent && (
                <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                  Verification email sent — check your inbox.
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <PremiumButton onClick={() => navigate('/login')} size="lg" variant="dark">
                  Go to Sign In
                </PremiumButton>
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:text-black hover:border-gray-400 transition-colors text-sm font-semibold disabled:opacity-60"
                >
                  {resending ? 'Resending…' : 'Resend verification email'}
                </button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Step 1 — Plan selection */}
        {!signupResult && step === 1 && (
          <div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {Object.entries(PLANS).map(([key, plan]) => (
                <GlassCard
                  key={key}
                  light hover
                  className={`p-6 sm:p-8 cursor-pointer ${selectedPlan === key ? 'ring-2 ring-black' : ''}`}
                  onClick={() => setSelectedPlan(key)}
                >
                  {plan.popular && (
                    <div className="bg-black text-white text-xs font-bold py-1 px-3 rounded-full inline-block mb-3">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-5">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-gray-500 text-sm">/month</span>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="text-gray-400">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  {selectedPlan === key && (
                    <div className="bg-black text-white text-center py-2 rounded-lg font-bold text-sm">Selected ✓</div>
                  )}
                </GlassCard>
              ))}
            </div>

            <div className="text-center">
              <PremiumButton onClick={() => setStep(2)} size="lg" variant="dark">
                Continue with {PLANS[selectedPlan].name} →
              </PremiumButton>
            </div>
          </div>
        )}

        {/* Step 2 — Account details */}
        {!signupResult && step === 2 && (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setStep(1)} className="mb-5 text-gray-500 hover:text-black text-sm">
              ← Back to plans
            </button>

            <GlassCard light className="p-6 sm:p-8">
              <div className="mb-5">
                <h2 className="text-xl font-bold mb-1">Selected: {PLANS[selectedPlan].name}</h2>
                <p className="text-gray-500 text-sm">
                  {selectedPlan === 'free'
                    ? 'Free forever — no card, no trial to track'
                    : `${PLANS[selectedPlan].price}/month after your 7-day free trial`}
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Organization Name *</label>
                  <input
                    type="text" name="name" value={formData.name} onChange={handleInputChange}
                    placeholder="Riverside Community Center" required
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Workspace URL *</label>
                  <div className="flex items-stretch">
                    <input
                      type="text" name="subdomain" value={formData.subdomain} onChange={handleInputChange}
                      placeholder="riverside" required pattern="[a-z0-9]{3,20}"
                      className="flex-1 min-w-0 px-4 py-3 rounded-l-xl bg-gray-50 border border-gray-200 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black text-base"
                    />
                    <div className="px-3 py-3 bg-gray-50 border border-l-0 border-gray-200 rounded-r-xl text-gray-500 text-sm flex items-center whitespace-nowrap">
                      .calendarflyapp.com
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Your workspace: <span className="text-black">{formData.subdomain || 'yourname'}.calendarflyapp.com</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                  <input
                    type="email" name="email" value={formData.email} onChange={handleInputChange}
                    placeholder="admin@yourorg.com" required
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password *</label>
                  <PasswordInput
                    value={formData.password}
                    onChange={handleInputChange}
                    name="password"
                    minLength={8}
                  />
                </div>

                <PremiumButton type="submit" fullWidth size="lg" variant="dark" disabled={loading}>
                  {loading ? 'Creating workspace...' : selectedPlan === 'free' ? 'Create Free Workspace →' : 'Start Free Trial →'}
                </PremiumButton>

                <p className="text-center text-xs text-gray-500">
                  By signing up, you agree to our Terms & Privacy Policy
                </p>
              </form>
            </GlassCard>

            <div className="mt-5 text-center">
              <p className="text-gray-500 text-sm">
                Already have an account?{' '}
                <button onClick={() => navigate('/login')} className="text-black hover:text-gray-600 font-semibold">
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}
        <div className="mt-10 text-center">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-black transition-colors text-sm">
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
