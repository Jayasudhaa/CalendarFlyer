/**
 * PremiumSignup.jsx
 * - Eye icon toggle on password field
 * - Mobile responsive
 * - Redirects to /calendar after signup
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';

const PLANS = {
  starter: { name: 'Starter', price: '$19', features: ['50 events/month', '3 users', 'AI Chatbot'] },
  pro:        { name: 'Pro',        price: '$79',  features: ['Unlimited events', '10 users', 'Analytics'], popular: true },
  enterprise: { name: 'Temple Plus', price: '$149', features: ['Everything', 'Custom domain', 'API access'] },
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
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
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
          color: show ? '#a78bfa' : '#6b7280',
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
  const { signup } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [formData, setFormData]       = useState({ name: '', subdomain: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      navigate('/calendar');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white px-4 py-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl top-20 left-20 animate-pulse" />
        <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl bottom-20 right-20 animate-pulse" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-2xl">CF</div>
            <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">CalendarFly</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-3">
            {step === 1 ? 'Choose Your Plan' : 'Create Your Workspace'}
          </h1>
          <p className="text-gray-400">7-day free trial · No credit card required</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {[1, 2].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <div className={`h-0.5 w-10 sm:w-16 ${step >= s ? 'bg-purple-500' : 'bg-gray-700'}`} />}
              <div className={`flex items-center gap-2 ${step >= s ? 'text-purple-400' : 'text-gray-600'}`}>
                <div className={`w-8 h-8 rounded-full ${step >= s ? 'bg-purple-500' : 'bg-gray-700'} flex items-center justify-center font-bold text-sm`}>{s}</div>
                <span className="hidden sm:inline text-sm">{s === 1 ? 'Plan' : 'Details'}</span>
          </div>
            </React.Fragment>
          ))}
        </div>

        {/* Step 1 — Plan selection */}
        {step === 1 && (
          <div>
            <div className="grid sm:grid-cols-3 gap-5 mb-8">
              {Object.entries(PLANS).map(([key, plan]) => (
                <GlassCard
                  key={key}
                  hover gradient
                  className={`p-6 sm:p-8 cursor-pointer ${selectedPlan === key ? 'ring-2 ring-purple-500' : ''}`}
                  onClick={() => setSelectedPlan(key)}
                >
                  {plan.popular && (
                    <div className="bg-gradient-to-r from-yellow-400 to-emerald-400 text-gray-900 text-xs font-bold py-1 px-3 rounded-full inline-block mb-3">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-5">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-gray-400 text-sm">/month</span>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-emerald-400">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  {selectedPlan === key && (
                    <div className="bg-purple-500 text-white text-center py-2 rounded-lg font-bold text-sm">Selected ✓</div>
                  )}
                </GlassCard>
              ))}
            </div>

            <div className="text-center">
              <PremiumButton onClick={() => setStep(2)} size="lg" variant="gold">
                Continue with {PLANS[selectedPlan].name} →
              </PremiumButton>
            </div>
          </div>
        )}

        {/* Step 2 — Account details */}
        {step === 2 && (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setStep(1)} className="mb-5 text-purple-400 hover:text-purple-300 text-sm">
              ← Back to plans
            </button>

            <GlassCard gradient className="p-6 sm:p-8">
              <div className="mb-5">
                <h2 className="text-xl font-bold mb-1">Selected: {PLANS[selectedPlan].name}</h2>
                <p className="text-gray-400 text-sm">{PLANS[selectedPlan].price}/month after 7-day free trial</p>
              </div>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-300 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Organization Name *</label>
                  <input
                    type="text" name="name" value={formData.name} onChange={handleInputChange}
                    placeholder="SV Temple Colorado" required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Workspace URL *</label>
                  <div className="flex items-stretch">
                    <input
                      type="text" name="subdomain" value={formData.subdomain} onChange={handleInputChange}
                      placeholder="svtemple" required pattern="[a-z0-9]{3,20}"
                      className="flex-1 min-w-0 px-4 py-3 rounded-l-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
                    />
                    <div className="px-3 py-3 bg-white/5 border border-l-0 border-white/10 rounded-r-xl text-gray-400 text-sm flex items-center whitespace-nowrap">
                      .calendarflyapp.com
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Your workspace: <span className="text-purple-400">{formData.subdomain || 'yourname'}.calendarflyapp.com</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Email Address *</label>
                  <input
                    type="email" name="email" value={formData.email} onChange={handleInputChange}
                    placeholder="admin@temple.org" required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                  <PasswordInput
                    value={formData.password}
                    onChange={handleInputChange}
                    name="password"
                    minLength={8}
                  />
                </div>

                <PremiumButton type="submit" fullWidth size="lg" variant="gold" disabled={loading}>
                  {loading ? 'Creating workspace...' : 'Start Free Trial →'}
                </PremiumButton>

                <p className="text-center text-xs text-gray-400">
                  By signing up, you agree to our Terms & Privacy Policy
                </p>
              </form>
            </GlassCard>

            <div className="mt-5 text-center">
              <p className="text-gray-400 text-sm">
                Already have an account?{' '}
                <button onClick={() => navigate('/login')} className="text-purple-400 hover:text-purple-300 font-semibold">
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}
        <div className="mt-10 text-center">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
